const crypto = require('node:crypto');
const { createEmailContent } = require('./emailTemplates');
const logger = require('../utils/observability');

const EVENTS = Object.freeze(['PEDIDO_CREADO', 'PAGO_CONFIRMADO', 'PEDIDO_CANCELADO', 'LISTO_PARA_RETIRAR']);
const MAX_ATTEMPTS = 5;
const LOCK_MS = 2 * 60 * 1000;

function execute(query) { return query && typeof query.exec === 'function' ? query.exec() : Promise.resolve(query); }
function eventKey(orderId, type) { return crypto.createHash('sha256').update(`${orderId}:${type}`).digest('hex'); }
function safeErrorCode(error) { return String(error?.code || error?.name || 'EMAIL_PROVIDER_ERROR').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 100); }

function createEmailOutboxService({ EmailOutbox, Pedido, ItemPedido }, { provider, transferInstructionsService, now = () => new Date() } = {}) {
  if (!EmailOutbox || !Pedido || !ItemPedido) throw new TypeError('El outbox requiere sus modelos persistentes');

  async function enqueue({ pedidoId, tipo, session }) {
    if (!pedidoId || !EVENTS.includes(tipo)) throw new TypeError('Evento de correo inválido');
    const id = eventKey(pedidoId, tipo);
    await EmailOutbox.updateOne({ _id: id }, { $setOnInsert: {
      _id: id, pedidoId, tipo, estado: 'PENDIENTE', intentos: 0,
      proximoIntentoEn: now(), creadoEn: now(), actualizadoEn: now()
    } }, { upsert: true, ...(session ? { session } : {}) });
    return id;
  }

  async function render(event) {
    const order = await execute(Pedido.findById(event.pedidoId).lean?.() || Pedido.findById(event.pedidoId));
    if (!order) throw Object.assign(new Error('Pedido histórico no encontrado'), { code: 'ORDER_SNAPSHOT_MISSING', definitive: true });
    const items = await execute(ItemPedido.find({ pedidoId: order._id }).sort({ _id: 1 }).lean?.() || ItemPedido.find({ pedidoId: order._id }).sort({ _id: 1 }));
    let instructions = null;
    if (event.tipo === 'PEDIDO_CREADO' && order.metodoPago === 'TRANSFERENCIA' && transferInstructionsService) {
      try { instructions = await transferInstructionsService.getInstructions(order); } catch { instructions = null; }
    }
    return createEmailContent({ tipo: event.tipo, order, items, transferInstructions: instructions });
  }

  async function claimOne() {
    const instant = now();
    const claimId = crypto.randomUUID();
    const filter = {
      proximoIntentoEn: { $lte: instant },
      $or: [
        { estado: { $in: ['PENDIENTE', 'FALLIDO'] }, intentos: { $lt: MAX_ATTEMPTS } },
        { estado: 'EN_PROCESO', claimHasta: { $lte: instant } }
      ]
    };
    const event = await EmailOutbox.findOneAndUpdate(filter, { $set: {
      estado: 'EN_PROCESO', claimId, claimHasta: new Date(instant.getTime() + LOCK_MS), actualizadoEn: instant
    } }, { new: true, sort: { creadoEn: 1 } });
    if (event) logger.info('email.outbox.claimed', { eventId: event._id, orderId: String(event.pedidoId), eventType: event.tipo, attempt: Number(event.intentos || 0) + 1 });
    return event;
  }

  async function processOne() {
    if (!provider?.enabled) return { procesado: false, bloqueado: true, razon: 'EMAIL_SENDING_DISABLED' };
    const event = await claimOne();
    if (!event) return { procesado: false, vacio: true };
    if (event.envioIniciadoEn && event.estado === 'EN_PROCESO' && event.intentos > 0) {
      await EmailOutbox.updateOne({ _id: event._id, claimId: event.claimId }, { $set: {
        estado: 'INDETERMINADO', errorCodigo: 'PREVIOUS_SEND_OUTCOME_UNKNOWN', claimId: null, claimHasta: null, actualizadoEn: now()
      } });
      logger.error('email.outbox.indeterminate', { eventId: event._id, orderId: String(event.pedidoId), eventType: event.tipo });
      void logger.alerts?.dispatch(`email:indeterminate:${event.tipo}`, 'email.outbox.indeterminate', { eventId: event._id, orderId: String(event.pedidoId) });
      return { procesado: true, estado: 'INDETERMINADO' };
    }
    try {
      const message = await render(event);
      const marked = await EmailOutbox.updateOne({ _id: event._id, claimId: event.claimId, estado: 'EN_PROCESO' }, {
        $set: { envioIniciadoEn: now(), actualizadoEn: now() }, $inc: { intentos: 1 }
      });
      if ((marked?.modifiedCount ?? marked?.nModified ?? 0) !== 1) {
        return { procesado: false, perdido: true };
      }
      const result = await provider.send({ ...message, messageId: `<${event._id}@olla-vegana>` });
      const saved = await EmailOutbox.updateOne({ _id: event._id, claimId: event.claimId, estado: 'EN_PROCESO' }, { $set: {
        estado: 'ENVIADO', enviadoEn: now(), proveedorMessageId: result?.messageId || null,
        claimId: null, claimHasta: null, errorCodigo: null, actualizadoEn: now()
      } });
      if ((saved?.modifiedCount ?? saved?.nModified ?? 0) !== 1) {
        logger.error('email.outbox.delivery_state_indeterminate', { eventId: event._id, orderId: String(event.pedidoId), eventType: event.tipo });
        return { procesado: true, estado: 'INDETERMINADO' };
      }
      logger.info('email.outbox.sent', { eventId: event._id, orderId: String(event.pedidoId), eventType: event.tipo });
      return { procesado: true, estado: 'ENVIADO' };
    } catch (error) {
      const attempts = Number(event.intentos || 0) + 1;
      const uncertain = event.envioIniciadoEn || !error?.definitive;
      const status = uncertain ? 'INDETERMINADO' : attempts >= MAX_ATTEMPTS ? 'FALLIDO' : 'PENDIENTE';
      const backoff = Math.min(60 * 60 * 1000, 30 * 1000 * (2 ** Math.max(0, attempts - 1)));
      await EmailOutbox.updateOne({ _id: event._id, claimId: event.claimId }, { $set: {
        estado: status, intentos: attempts,
        proximoIntentoEn: status === 'PENDIENTE' ? new Date(now().getTime() + backoff) : now(),
        ...(status === 'PENDIENTE' ? { envioIniciadoEn: null } : {}),
        errorCodigo: safeErrorCode(error), claimId: null, claimHasta: null, actualizadoEn: now()
      } });
      const fields = { eventId: event._id, orderId: String(event.pedidoId), eventType: event.tipo, state: status, errorCode: safeErrorCode(error) };
      (status === 'INDETERMINADO' || status === 'FALLIDO' ? logger.error : logger.warn)('email.outbox.attempt_failed', fields);
      if (status === 'INDETERMINADO' || status === 'FALLIDO') {
        void logger.alerts?.dispatch(`email:${status}:${event.tipo}`, `email.outbox.${status.toLowerCase()}`, { eventId: event._id, orderId: String(event.pedidoId) });
      }
      return { procesado: true, estado: status };
    }
  }

  async function processBatch(limit = 20) {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new TypeError('Límite de proceso inválido');
    const results = [];
    for (let index = 0; index < limit; index += 1) {
      const result = await processOne();
      if (result.vacio || result.bloqueado) break;
      results.push(result);
    }
    return { procesados: results.length, resultados: results };
  }

  async function reconcile(eventId, action) {
    if (!['sent', 'retry', 'failed'].includes(action)) throw new TypeError('Acción de conciliación inválida');
    const update = action === 'sent'
      ? { estado: 'ENVIADO', enviadoEn: now(), errorCodigo: null }
      : action === 'retry'
        ? { estado: 'PENDIENTE', proximoIntentoEn: now(), envioIniciadoEn: null, errorCodigo: null }
        : { estado: 'FALLIDO', errorCodigo: 'OPERATOR_MARKED_FAILED' };
    const result = await EmailOutbox.updateOne({ _id: eventId, estado: 'INDETERMINADO' }, { $set: { ...update, actualizadoEn: now() } });
    return (result?.modifiedCount ?? result?.nModified ?? 0) === 1;
  }

  return { enqueue, processOne, processBatch, reconcile, eventKey };
}

module.exports = { createEmailOutboxService, EVENTS, MAX_ATTEMPTS, eventKey };
