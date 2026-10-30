const crypto = require('node:crypto');
const mongoose = require('mongoose');
const { parseMoneyToCents } = require('./cartValidationService');
const { validateWebhookSignature, ORDER_ID_PATTERN } = require('./mercadoPagoWebhookSecurity');

const WEBHOOK_INDEX = 'uniq_evento_pago_idempotencia';
const ATTEMPT_INDEX = 'uniq_intento_pago_order_externa';
const IDEMPOTENCY_INDEX = 'uniq_intento_pago_idempotencia';

function run(query, session) {
  if (session && query && typeof query.session === 'function') query = query.session(session);
  if (query && typeof query.lean === 'function') query = query.lean();
  return query && typeof query.exec === 'function' ? query.exec() : Promise.resolve(query);
}

function safeStatus(value) {
  return typeof value === 'string' ? value.slice(0, 80) : '';
}

function providerStateRank(status, detail) {
  if (status === 'refunded' || detail === 'partially_refunded') return 3;
  if (status === 'processed' && detail === 'accredited') return 2;
  if (status === 'failed' || status === 'canceled') return 1;
  if (['created', 'processing', 'action_required'].includes(status)) return 0;
  return -1;
}

function isOlderProviderSnapshot(incoming, current) {
  if (!current) return false;
  const incomingDate = incoming?.last_updated_date ? new Date(incoming.last_updated_date) : null;
  const currentDate = current?.ultimaActualizacionProveedor ? new Date(current.ultimaActualizacionProveedor) : null;
  if (incomingDate && Number.isFinite(incomingDate.getTime()) && currentDate
    && Number.isFinite(currentDate.getTime()) && incomingDate.getTime() < currentDate.getTime()) return true;
  const oldRank = providerStateRank(current.estadoProveedor, current.detalleEstadoProveedor);
  const newRank = providerStateRank(incoming?.status, incoming?.status_detail);
  return oldRank >= 0 && newRank >= 0 && newRank < oldRank;
}

function providerSnapshot(order) {
  const payments = Array.isArray(order?.transactions?.payments) ? order.transactions.payments : [];
  return {
    orderId: String(order?.id || ''),
    status: safeStatus(order?.status),
    detail: safeStatus(order?.status_detail),
    updatedAt: typeof order?.last_updated_date === 'string' ? order.last_updated_date : null,
    total: typeof order?.total_amount === 'string' ? order.total_amount : String(order?.total_amount ?? ''),
    paid: typeof order?.total_paid_amount === 'string' ? order.total_paid_amount : String(order?.total_paid_amount ?? ''),
    currency: safeStatus(order?.currency),
    paymentIds: payments.map((payment) => ({
      id: typeof payment?.id === 'string' ? payment.id : '',
      status: safeStatus(payment?.status),
      detail: safeStatus(payment?.status_detail),
      paid: typeof payment?.paid_amount === 'string' ? payment.paid_amount : String(payment?.paid_amount ?? ''),
      currency: safeStatus(payment?.currency_id || order?.currency)
    })).sort((a, b) => a.id.localeCompare(b.id))
  };
}

function classifyOrder(order, expectedCents) {
  const view = providerSnapshot(order);
  const amount = parseMoneyToCents(view.total);
  const paid = parseMoneyToCents(view.paid);
  if (amount === null || amount !== expectedCents || view.currency !== 'ARS') return { state: 'REVIEW', reason: 'IMPORTE_O_MONEDA_NO_COINCIDE', view };
  const payments = view.paymentIds;
  const paidPayments = payments.filter((payment) => payment.status === 'processed' && payment.detail === 'accredited');
  const paidSum = paidPayments.reduce((sum, payment) => {
    const cents = parseMoneyToCents(payment.paid);
    return cents === null || payment.currency !== 'ARS' ? null : sum === null ? null : sum + cents;
  }, 0n);
  const anyPaymentMoney = payments.some((payment) => {
    const amountPaid = parseMoneyToCents(payment.paid);
    return amountPaid !== null && amountPaid > 0n;
  });
  const hasMoney = (paid !== null && paid > 0n) || anyPaymentMoney;
  if (view.status === 'processed' && view.detail === 'accredited'
    && paid === expectedCents && paidPayments.length > 0 && paidPayments.length === payments.length
    && paidSum === expectedCents) {
    return { state: 'APPROVED', view, paymentId: paidPayments[0].id };
  }
  if (view.status === 'failed' || view.status === 'canceled') {
    return hasMoney ? { state: 'REVIEW', reason: 'ESTADO_TERMINAL_CON_IMPORTE_PAGADO', view } : { state: 'REJECTED', view };
  }
  if (view.status === 'created' || view.status === 'processing' || view.status === 'action_required') {
    return hasMoney ? { state: 'REVIEW', reason: 'IMPORTE_PARCIAL_O_ESTADO_INCONSISTENTE', view } : { state: 'PENDING', view };
  }
  if (view.status === 'refunded' || view.detail === 'partially_refunded') {
    return { state: 'REVIEW', reason: 'REEMBOLSO_FUERA_DE_ALCANCE', view };
  }
  return { state: 'UNSUPPORTED', reason: 'ESTADO_NO_SOPORTADO', view };
}

function fingerprintSnapshot(orderId, snapshot) {
  return crypto.createHash('sha256').update(`${orderId}:${JSON.stringify(snapshot)}`).digest('hex');
}

function createMercadoPagoWebhookService(models, {
  env,
  orderClient,
  stockReservationService,
  paymentAuthorization,
  startSession = () => mongoose.startSession(),
  ahora = () => new Date(),
  toleranceSeconds = 300
} = {}) {
  const { Pedido, IntentoPago, EventoPago } = models;
  const processingEnabled = env?.MP_ENVIRONMENT === 'test'
    && env?.MP_ORDER_CREATION_ENABLED === true
    && env?.MP_WEBHOOK_EFFECTS_ENABLED === true
    && env?.MP_ORDER_FLOW_READY === true
    && env?.MP_WEBHOOKS_READY === true
    && Boolean(env?.MP_ACCESS_TOKEN && env?.MP_WEBHOOK_SECRET && env?.MP_APPLICATION_ID && env?.MP_USER_ID)
    && Boolean(orderClient && stockReservationService && paymentAuthorization);

  async function assertIndexes() {
    const eventIndexes = await EventoPago.collection.indexes();
    const eventIndex = eventIndexes.find((index) => index.name === WEBHOOK_INDEX && index.unique
      && index.key?.idempotencia === 1 && index.partialFilterExpression?.idempotencia?.$type === 'string');
    const attemptIndexes = await IntentoPago.collection.indexes();
    const externalIndex = attemptIndexes.find((index) => index.name === ATTEMPT_INDEX && index.unique
      && index.key?.orderExternaId === 1 && index.partialFilterExpression?.orderExternaId?.$type === 'string');
    const idempotencyIndex = attemptIndexes.find((index) => index.name === IDEMPOTENCY_INDEX && index.unique
      && index.key?.proveedor === 1 && index.key?.claveIdempotencia === 1);
    if (!eventIndex || !externalIndex || !idempotencyIndex) {
      const error = new Error('Faltan índices únicos requeridos para procesar webhooks');
      error.statusCode = 503;
      error.code = 'WEBHOOK_INDEXES_MISSING';
      throw error;
    }
  }

  function validateNotification(request) {
    const signature = request?.headers?.['x-signature'];
    const requestId = request?.headers?.['x-request-id'];
    const queryId = request?.query?.['data.id'];
    const bodyId = request?.body?.data?.id;
    if (typeof queryId !== 'string' || !ORDER_ID_PATTERN.test(queryId)
      || typeof bodyId !== 'string' || bodyId !== queryId
      || typeof request?.body?.type !== 'string'
      || (request.query?.type !== undefined && request.query.type !== request.body.type)) {
      const error = new Error('La notificación recibida no es válida');
      error.statusCode = 400;
      error.code = 'WEBHOOK_INVALID_PAYLOAD';
      throw error;
    }
    if (!env?.MP_WEBHOOK_SECRET) {
      const error = new Error('La verificación de webhooks no está configurada');
      error.statusCode = 503;
      error.code = 'WEBHOOK_NOT_CONFIGURED';
      throw error;
    }
    const valid = validateWebhookSignature({
      signature,
      requestId,
      dataId: queryId,
      secret: env.MP_WEBHOOK_SECRET,
      now: () => ahora().getTime(),
      toleranceSeconds
    });
    if (!valid) {
      const error = new Error('La firma de la notificación no es válida');
      error.statusCode = 401;
      error.code = 'WEBHOOK_INVALID_SIGNATURE';
      throw error;
    }
    return { orderId: queryId, requestId, body: request.body };
  }

  async function saveEvent({ order, requestId, attempt, idempotency, state = 'RECIBIDO', reason = null }) {
    const view = providerSnapshot(order);
    const snapshot = {
      orderId: view.orderId,
      status: view.status,
      detail: view.detail,
      updatedAt: view.updatedAt,
      total: view.total,
      paid: view.paid,
      currency: view.currency,
      paymentIds: view.paymentIds
    };
    try {
      const [created] = await EventoPago.create([{
        proveedor: 'MERCADO_PAGO',
        idExterno: String(order?.id || ''),
        tipo: `${view.status}:${view.detail}`.slice(0, 80),
        contenido: { snapshot, accion: safeStatus(order?.status_detail), revision: reason },
        idempotencia: idempotency,
        estadoProcesamiento: state,
        xRequestId: requestId || null,
        pedidoId: attempt?.pedidoId || null,
        creadoEn: ahora()
      }]);
      return { event: created.toObject ? created.toObject() : created, created: true };
    } catch (error) {
      if (error?.code !== 11000) throw error;
      const existing = await run(EventoPago.findOne({ idempotencia: idempotency }));
      if (!existing) throw error;
      return { event: existing, created: false };
    }
  }

  async function markReview({ eventId, attempt, pedido, reason, providerOrder, paymentId }) {
    const session = await startSession();
    try {
      await session.withTransaction(async () => {
        const when = ahora();
        const currentAttempt = attempt ? await run(IntentoPago.findById(attempt._id), session) : null;
        if (isOlderProviderSnapshot(providerOrder, currentAttempt)) {
          await EventoPago.updateOne({ _id: eventId, estadoProcesamiento: 'RECIBIDO' }, {
            $set: { estadoProcesamiento: 'NO_APLICA', errorCodigo: 'EVENTO_ANTERIOR', procesadoEn: when }
          }, { session });
          return;
        }
        if (attempt) {
          await IntentoPago.updateOne({ _id: currentAttempt?._id || attempt._id }, { $set: {
            estadoProveedor: safeStatus(providerOrder.status),
            detalleEstadoProveedor: safeStatus(providerOrder.status_detail),
            pagoExternoId: paymentId || null,
            moneda: safeStatus(providerOrder.currency),
            ultimaActualizacionProveedor: providerOrder.last_updated_date ? new Date(providerOrder.last_updated_date) : null,
            pagoVerificadoEn: when,
            incidencia: reason
          } }, { session });
        }
        if (reason === 'ACREDITACION_SIN_RESERVA' && pedido) {
          await Pedido.updateOne({ _id: pedido._id, metodoPago: 'MERCADO_PAGO', estadoPago: { $in: ['PENDIENTE', 'APROBADO', 'RECHAZADO'] } }, {
            $set: {
              estadoPago: 'APROBADO',
              pagoVerificadoEn: when,
              pagadoEn: pedido.pagadoEn || when,
              mpPagoId: paymentId || pedido.mpPagoId || null,
              notaPago: 'Acreditación de Mercado Pago verificada; reserva no disponible. Requiere conciliación administrativa.'
            }
          }, { session });
        }
        await EventoPago.updateOne({ _id: eventId, estadoProcesamiento: 'RECIBIDO' }, {
          $set: { estadoProcesamiento: 'REVISION', errorCodigo: reason, procesadoEn: when }
        }, { session });
      });
    } finally {
      await session.endSession();
    }
  }

  async function processSnapshot({ event, attempt, pedido, officialOrder, classified }) {
    const session = await startSession();
    try {
      let result = { recibido: true, estado: classified.state };
      await session.withTransaction(async () => {
        const currentEvent = await run(EventoPago.findById(event._id), session);
        if (!currentEvent || currentEvent.estadoProcesamiento !== 'RECIBIDO') {
          result = { recibido: true, repetido: true, estado: currentEvent?.estadoProcesamiento || 'NO_APLICA' };
          return;
        }
        const claimedEvent = await EventoPago.updateOne({ _id: event._id, estadoProcesamiento: 'RECIBIDO' }, {
          $set: { estadoProcesamiento: 'PROCESANDO' }
        }, { session });
        if ((claimedEvent?.modifiedCount ?? claimedEvent?.nModified ?? 0) !== 1) {
          const conflict = new Error('El evento ya está siendo procesado');
          conflict.code = 'WEBHOOK_EVENT_CLAIM_CONFLICT';
          throw conflict;
        }

        const currentAttempt = await run(IntentoPago.findById(attempt._id), session);
        const updateDate = officialOrder.last_updated_date ? new Date(officialOrder.last_updated_date) : null;
        if (isOlderProviderSnapshot(officialOrder, currentAttempt)) {
          await EventoPago.updateOne({ _id: event._id }, { $set: { estadoProcesamiento: 'NO_APLICA', errorCodigo: 'EVENTO_ANTERIOR', procesadoEn: ahora() } }, { session });
          result = { recibido: true, obsoleto: true };
          return;
        }

        const paymentId = classified.paymentId || classified.view.paymentIds.find((item) => item.id)?.id || null;
        let finalState = 'PROCESADO';
        if (classified.state === 'APPROVED') {
          const proof = paymentAuthorization.issue({ pedidoId: pedido._id, orderId: officialOrder.id, snapshotHash: event.idempotencia });
          try {
            await stockReservationService.confirmPayment(pedido._id, proof, { session });
            await Pedido.updateOne({ _id: pedido._id }, { $set: { mpPagoId: paymentId, notaPago: null } }, { session });
          } catch (error) {
            if (error?.statusCode !== 409) throw error;
            // La order está acreditada, pero las reservas pueden haber vencido/liberado.
            // Abortamos esta transacción y persistimos la evidencia financiera para revisión.
            const unavailable = new Error('RESERVATION_REVIEW_REQUIRED');
            unavailable.code = 'RESERVATION_REVIEW_REQUIRED';
            unavailable.providerOrder = officialOrder;
            unavailable.paymentId = paymentId;
            throw unavailable;
          }
        } else if (classified.state === 'REJECTED') {
          const proof = paymentAuthorization.issue({ pedidoId: pedido._id, orderId: officialOrder.id, snapshotHash: event.idempotencia });
          await stockReservationService.rejectVerifiedMarketplacePayment(pedido._id, proof, { session });
        }
        await IntentoPago.updateOne({ _id: currentAttempt._id }, { $set: {
          estadoProveedor: classified.view.status,
          detalleEstadoProveedor: classified.view.detail,
          pagoExternoId: paymentId,
          moneda: classified.view.currency,
          ultimaActualizacionProveedor: updateDate && Number.isFinite(updateDate.getTime()) ? updateDate : null,
          pagoVerificadoEn: ahora(),
          incidencia: null
        } }, { session });
        await EventoPago.updateOne({ _id: event._id }, { $set: { estadoProcesamiento: finalState, errorCodigo: null, procesadoEn: ahora() } }, { session });
        result = { recibido: true, estado: classified.state };
      });
      return result;
    } finally {
      await session.endSession();
    }
  }

  async function handle(request) {
    const notification = validateNotification(request);
    if (notification.body.type !== 'order') return { recibido: true, soportado: false };
    if (!processingEnabled) {
      const error = new Error('El procesamiento de pagos está deshabilitado hasta completar las verificaciones de integración');
      error.statusCode = 503;
      error.code = 'WEBHOOK_EFFECTS_DISABLED';
      throw error;
    }
    if (notification.body.live_mode !== false
      || String(notification.body.application_id || '') !== String(env.MP_APPLICATION_ID)
      || String(notification.body.user_id || '') !== String(env.MP_USER_ID)) {
      const error = new Error('La notificación no pertenece al entorno de pruebas configurado');
      error.statusCode = 401;
      error.code = 'WEBHOOK_WRONG_ENVIRONMENT';
      throw error;
    }
    await assertIndexes();
    const officialOrder = await orderClient.getOrder(notification.orderId);
    if (String(officialOrder?.id || '') !== notification.orderId
      || officialOrder?.type !== 'online' || officialOrder?.processing_mode !== 'manual'
      || String(officialOrder?.integration_data?.application_id || '') !== String(env.MP_APPLICATION_ID)
      || String(officialOrder?.user_id || '') !== String(env.MP_USER_ID)) {
      const error = new Error('No se pudo verificar la order de Mercado Pago');
      error.statusCode = 503;
      error.code = 'WEBHOOK_PROVIDER_RESPONSE_INVALID';
      throw error;
    }
    const attempt = await run(IntentoPago.findOne({ proveedor: 'MERCADO_PAGO', orderExternaId: notification.orderId }));
    if (!attempt) {
      const snapshot = providerSnapshot(officialOrder);
      const key = fingerprintSnapshot(notification.orderId, snapshot);
      const saved = await saveEvent({ order: officialOrder, requestId: notification.requestId, idempotency: key, reason: 'INTENTO_NO_ENCONTRADO' });
      if (!saved.created && saved.event.estadoProcesamiento !== 'RECIBIDO') {
        return { recibido: true, noAplicable: true, repetido: true };
      }
      const retry = new Error('La order aún no está asociada a un intento persistido');
      retry.statusCode = 503;
      retry.code = 'WEBHOOK_ATTEMPT_NOT_READY';
      throw retry;
    }
    const pedido = await run(Pedido.findById(attempt.pedidoId));
    const pedidoAttempts = await run(IntentoPago.find({
      pedidoId: attempt.pedidoId,
      proveedor: 'MERCADO_PAGO',
      orderExternaId: { $type: 'string' }
    }));
    const conflictingAttempts = (pedidoAttempts || []).filter((candidate) =>
      String(candidate._id) !== String(attempt._id) && candidate.orderExternaId !== notification.orderId);
    if (conflictingAttempts.length) {
      const snapshot = providerSnapshot(officialOrder);
      const key = fingerprintSnapshot(notification.orderId, snapshot);
      const saved = await saveEvent({ order: officialOrder, requestId: notification.requestId, attempt, idempotency: key });
      if (!saved.created && ['PROCESADO', 'REVISION', 'NO_APLICA'].includes(saved.event.estadoProcesamiento)) {
        return { recibido: true, repetido: true, estado: saved.event.estadoProcesamiento };
      }
      await markReview({ eventId: saved.event._id, attempt, pedido, reason: 'INTENTOS_MP_CONFLICTIVOS', providerOrder: officialOrder });
      return { recibido: true, requiereRevision: true };
    }
    const expected = pedido && parseMoneyToCents(pedido.total);
    const referenceMatches = Boolean(pedido && officialOrder.external_reference === `OV-${pedido.numero}`);
    const appMatches = String(officialOrder?.integration_data?.application_id || '') === String(env.MP_APPLICATION_ID);
    const sellerMatches = String(officialOrder?.user_id || '') === String(env.MP_USER_ID);
    const versionMatches = officialOrder?.type === 'online' && officialOrder?.processing_mode === 'manual'
      && String(officialOrder.currency || '') === 'ARS'
      && typeof expected === 'bigint' && expected > 0n
      && parseMoneyToCents(officialOrder.total_amount) === expected
      && referenceMatches && appMatches && sellerMatches;
    const classified = versionMatches ? classifyOrder(officialOrder, expected)
      : { state: 'REVIEW', reason: !referenceMatches ? 'REFERENCIA_NO_COINCIDE' : !appMatches ? 'APLICACION_NO_COINCIDE' : !sellerMatches ? 'CUENTA_VENDEDORA_NO_COINCIDE' : 'IMPORTE_MONEDA_O_TIPO_NO_COINCIDE', view: providerSnapshot(officialOrder) };
    const snapshot = classified.view || providerSnapshot(officialOrder);
    const key = fingerprintSnapshot(notification.orderId, snapshot);
    const saved = await saveEvent({
      order: officialOrder,
      requestId: notification.requestId,
      attempt,
      idempotency: key,
      reason: classified.reason
    });
    if (!saved.created && ['PROCESADO', 'REVISION', 'NO_APLICA'].includes(saved.event.estadoProcesamiento)) {
      return { recibido: true, repetido: true, estado: saved.event.estadoProcesamiento };
    }
    if (!pedido) {
      await EventoPago.updateOne({ _id: saved.event._id, estadoProcesamiento: 'RECIBIDO' }, { $set: { estadoProcesamiento: 'REVISION', errorCodigo: 'PEDIDO_NO_ENCONTRADO', procesadoEn: ahora() } });
      return { recibido: true, noAplicable: true };
    }
    if (classified.state === 'REVIEW') {
      await markReview({ eventId: saved.event._id, attempt, pedido, reason: classified.reason, providerOrder: officialOrder, paymentId: snapshot.paymentIds.find((item) => item.id)?.id });
      return { recibido: true, requiereRevision: true };
    }
    if (classified.state === 'UNSUPPORTED') {
      await EventoPago.updateOne({ _id: saved.event._id, estadoProcesamiento: 'RECIBIDO' }, { $set: { estadoProcesamiento: 'NO_APLICA', errorCodigo: classified.reason, procesadoEn: ahora() } });
      return { recibido: true, soportado: false };
    }
    if (pedido.metodoPago !== 'MERCADO_PAGO') {
      await markReview({ eventId: saved.event._id, attempt, pedido, reason: 'METODO_PAGO_NO_COINCIDE', providerOrder: officialOrder });
      return { recibido: true, requiereRevision: true };
    }
    if (classified.state === 'PENDING' && pedido.estadoPago !== 'PENDIENTE') {
      await EventoPago.updateOne({ _id: saved.event._id, estadoProcesamiento: 'RECIBIDO' }, { $set: { estadoProcesamiento: 'NO_APLICA', errorCodigo: 'ESTADO_INTERNO_MAS_AVANZADO', procesadoEn: ahora() } });
      return { recibido: true, obsoleto: true };
    }
    if (classified.state === 'REJECTED' && pedido.estadoPago !== 'PENDIENTE'
      && pedido.estadoPago !== 'RECHAZADO') {
      await EventoPago.updateOne({ _id: saved.event._id, estadoProcesamiento: 'RECIBIDO' }, { $set: { estadoProcesamiento: 'NO_APLICA', errorCodigo: 'ESTADO_INTERNO_MAS_AVANZADO', procesadoEn: ahora() } });
      return { recibido: true, obsoleto: true };
    }
    try {
      return await processSnapshot({ event: saved.event, attempt, pedido, officialOrder, classified });
    } catch (error) {
      if (error?.code === 'RESERVATION_REVIEW_REQUIRED') {
        await markReview({ eventId: saved.event._id, attempt, pedido, reason: 'ACREDITACION_SIN_RESERVA', providerOrder: error.providerOrder, paymentId: error.paymentId });
        return { recibido: true, requiereRevision: true };
      }
      throw error;
    }
  }

  return { handle, processingEnabled, assertIndexes };
}

module.exports = { createMercadoPagoWebhookService, providerSnapshot, classifyOrder, fingerprintSnapshot, providerStateRank, isOlderProviderSnapshot };
