const crypto = require('node:crypto');
const mongoose = require('mongoose');
const AppError = require('../utils/AppError');
const { parseMoneyToCents, formatCents } = require('./cartValidationService');
const logger = require('../utils/observability');

const RESERVED_STATES = ['SOLICITADO', 'PREPARADO', 'EN_PROCESO', 'INDETERMINADO', 'PENDIENTE_MANUAL', 'EN_REVISION', 'COMPLETADO'];
const REQUEST_INDEX = 'uniq_reintegro_id_operacion';

function execute(query, session) {
  if (session && query && typeof query.session === 'function') query = query.session(session);
  if (query && typeof query.lean === 'function') query = query.lean();
  return query && typeof query.exec === 'function' ? query.exec() : Promise.resolve(query);
}

function fingerprint(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function normalizeAmount(value) {
  if (typeof value !== 'string' || !/^\d{1,12}(?:\.\d{1,2})?$/.test(value.trim())) {
    throw AppError.solicitudInvalida('El importe debe ser un monto positivo con hasta dos decimales');
  }
  const cents = parseMoneyToCents(value.trim());
  if (cents === null || cents <= 0n) throw AppError.solicitudInvalida('El importe debe ser un monto positivo válido');
  return cents;
}

function normalizeIdempotency(value) {
  if (typeof value !== 'string' || value.length < 8 || value.length > 128 || !/^[\w.:/-]+$/.test(value)) {
    throw AppError.solicitudInvalida('Falta una clave Idempotency-Key válida');
  }
  return value;
}

function getProviderRefunds(official, payment) {
  const fromOrder = official?.transactions?.refunds;
  const fromPayment = payment?.refunds;
  if (Array.isArray(fromOrder)) {
    return fromOrder.filter((entry) => !entry.transaction_id || String(entry.transaction_id) === String(payment?.id));
  }
  return Array.isArray(fromPayment) ? fromPayment : [];
}

function createRefundService(models, {
  stockReservationService,
  transferPaymentAuthorization,
  orderClient,
  env = {},
  startSession = () => models.Pedido.db.startSession(),
  ahora = () => new Date()
} = {}) {
  const { Pedido, ReservaStock, IntentoPago, ConfirmacionTransferencia, Reintegro } = models;
  if (![Pedido, ReservaStock, IntentoPago, ConfirmacionTransferencia, Reintegro].every(Boolean)) {
    throw new TypeError('El servicio de reintegros requiere los modelos de pedidos, reservas y pagos');
  }

  async function transaction(operation) {
    const session = await startSession();
    try {
      let result;
      await session.withTransaction(async () => { result = await operation(session); });
      return result;
    } finally { await session.endSession(); }
  }

  async function assertIndexes() {
    try {
      const indexes = await Reintegro.collection.indexes();
      const unique = indexes.some((index) => index.name === REQUEST_INDEX && index.unique === true && index.key?.idOperacion === 1);
      if (!unique) throw new Error('missing refund idempotency index');
      const confirm = indexes.some((index) => index.name === 'uniq_reintegro_id_confirmacion' && index.unique === true
        && index.key?.idConfirmacion === 1 && index.partialFilterExpression?.idConfirmacion?.$type === 'string');
      const providerRefund = indexes.some((index) => index.name === 'uniq_reintegro_proveedor_id' && index.unique === true
        && index.partialFilterExpression?.proveedorReintegroId?.$type === 'string');
      const reference = indexes.some((index) => index.name === 'uniq_reintegro_pedido_referencia_devolucion' && index.unique === true
        && index.key?.pedidoId === 1 && index.key?.referenciaDevolucion === 1
        && index.partialFilterExpression?.referenciaDevolucion?.$type === 'string');
      if (!confirm || !providerRefund || !reference) throw new Error('missing refund idempotency/audit indexes');
    } catch {
      throw new AppError('Las operaciones de reintegro están deshabilitadas hasta verificar los índices requeridos', 503);
    }
  }

  async function findRequest(idOperacion, session, includeHash = false) {
    let query = Reintegro.findOne({ idOperacion });
    if (includeHash && query && typeof query.select === 'function') query = query.select('+huellaSolicitud');
    return execute(query, session);
  }

  function assertAdmin(adminId) {
    if (!mongoose.isObjectIdOrHexString(adminId)) throw AppError.prohibido('Se requiere una sesión administrativa autorizada');
  }

  async function lockOrder(order, session, nextRefundState) {
    const revisionFilter = Number.isSafeInteger(order.revisionReintegros)
      ? { revisionReintegros: order.revisionReintegros }
      : { revisionReintegros: { $exists: false } };
    const result = await Pedido.updateOne({ _id: order._id, ...revisionFilter }, {
      $inc: { revisionReintegros: 1 },
      ...(nextRefundState ? { $set: { estadoReintegro: nextRefundState } } : {})
    }, { session });
    if ((result?.matchedCount ?? result?.n ?? 0) !== 1) throw AppError.conflicto('El pedido cambió durante la operación; volvé a consultar su estado');
  }

  async function verifiedPayment(order, session) {
    if (order.estadoPago !== 'APROBADO' && order.estadoPago !== 'REEMBOLSADO') {
      throw AppError.conflicto('Solo puede solicitarse un reintegro de un pago acreditado');
    }
    if (order.metodoPago === 'TRANSFERENCIA') {
      const confirmation = await execute(ConfirmacionTransferencia.findOne({ pedidoId: order._id, resultado: 'ACREDITADA' }).sort({ recibidoEn: -1 }), session);
      if (!confirmation) throw AppError.conflicto('No existe una acreditación administrativa válida para esta transferencia');
      return { proveedor: 'TRANSFERENCIA', pagoId: null, orderId: null };
    }
    if (order.metodoPago !== 'MERCADO_PAGO') throw AppError.conflicto('El método de pago no admite este proceso de reintegro');
    const attempt = await execute(IntentoPago.findOne({
      pedidoId: order._id, proveedor: 'MERCADO_PAGO', estadoCreacion: 'CREADO',
      estadoProveedor: 'processed', detalleEstadoProveedor: 'accredited', moneda: 'ARS',
      pagoExternoId: { $type: 'string' }
    }).sort({ creadoEn: -1 }), session);
    if (!attempt?.orderExternaId || !attempt?.pagoExternoId) {
      throw AppError.conflicto('No hay una acreditación de Mercado Pago verificada y asociada al pedido');
    }
    return { proveedor: 'MERCADO_PAGO', pagoId: attempt.pagoExternoId, orderId: attempt.orderExternaId };
  }

  async function allocatedRefundCents(pedidoId, session, excludeId = null) {
    let query = Reintegro.find({ pedidoId, estado: { $in: RESERVED_STATES }, ...(excludeId ? { _id: { $ne: excludeId } } : {}) });
    const rows = await execute(query, session);
    return rows.reduce((sum, row) => {
      const cents = parseMoneyToCents(row.importeConfirmado ?? row.importeSolicitado);
      if (cents === null || cents < 0n) throw AppError.conflicto('El historial de reintegros requiere conciliación');
      return sum + cents;
    }, 0n);
  }

  async function confirmedRefundCents(pedidoId, session, excludeId = null) {
    const rows = await execute(Reintegro.find({ pedidoId, estado: 'COMPLETADO', ...(excludeId ? { _id: { $ne: excludeId } } : {}) }), session);
    return rows.reduce((sum, row) => {
      const cents = parseMoneyToCents(row.importeConfirmado);
      if (cents === null || cents < 0n) throw AppError.conflicto('El historial de reintegros requiere conciliación');
      return sum + cents;
    }, 0n);
  }

  async function requestRefund({ pedidoId, adminId, importe, motivo, idOperacion }) {
    assertAdmin(adminId);
    if (!mongoose.isObjectIdOrHexString(pedidoId)) throw AppError.solicitudInvalida('El identificador del pedido no es válido');
    if (typeof motivo !== 'string' || !motivo.trim() || motivo.trim().length > 500) {
      throw AppError.solicitudInvalida('El motivo es obligatorio y debe tener hasta 500 caracteres');
    }
    const key = normalizeIdempotency(idOperacion);
    const explicitCents = importe === undefined ? null : normalizeAmount(importe);
    const requestFingerprint = fingerprint({ pedidoId: String(pedidoId), importe: explicitCents?.toString() ?? 'RESTANTE', motivo: motivo.trim() });
    await assertIndexes();

    const existing = await findRequest(key, null, true);
    if (existing) {
      if (existing.huellaSolicitud !== requestFingerprint) throw AppError.conflicto('La clave de operación ya se utilizó con otros datos');
      return { reintegro: existing, idempotente: true };
    }

    try {
      const result = await transaction(async (session) => {
        const prior = await findRequest(key, session, true);
        if (prior) {
          if (prior.huellaSolicitud !== requestFingerprint) throw AppError.conflicto('La clave de operación ya se utilizó con otros datos');
          return { reintegro: prior, idempotente: true };
        }
        const order = await execute(Pedido.findById(pedidoId), session);
        if (!order) throw AppError.noEncontrado('Pedido no encontrado');
        if (order.estado === 'RETIRADO') {
          throw AppError.conflicto('El pedido fue retirado; el reintegro requiere la política de devolución y una revisión manual');
        }
        const payment = await verifiedPayment(order, session);
        const originalCents = parseMoneyToCents(order.total);
        if (originalCents === null || originalCents <= 0n) throw AppError.conflicto('El importe histórico del pedido requiere conciliación');
        await lockOrder(order, session, 'PENDIENTE');
        const alreadyAllocated = await allocatedRefundCents(order._id, session);
        const remaining = originalCents - alreadyAllocated;
        if (remaining <= 0n) throw AppError.conflicto('El importe acreditado ya fue reintegrado o está reservado en solicitudes anteriores');
        const cents = explicitCents ?? remaining;
        if (cents > remaining) throw AppError.conflicto('Los reintegros acumulados no pueden superar el importe acreditado');
        const state = payment.proveedor === 'TRANSFERENCIA' ? 'PENDIENTE_MANUAL' : 'SOLICITADO';
        const now = ahora();
        const [reintegro] = await Reintegro.create([{
          pedidoId: order._id,
          metodoPago: order.metodoPago,
          proveedor: payment.proveedor,
          tipo: cents === remaining ? 'TOTAL' : 'PARCIAL',
          importeSolicitado: mongoose.Types.Decimal128.fromString(formatCents(cents)),
          moneda: 'ARS', estado: state, motivo: motivo.trim(),
          adminSolicitanteId: adminId, idOperacion: key, huellaSolicitud: requestFingerprint,
          proveedorOrderId: payment.orderId, proveedorPagoId: payment.pagoId,
          solicitadoEn: now,
          historial: [{ estado: state, adminId, nota: motivo.trim(), creadoEn: now }]
        }], { session });
        return { reintegro, idempotente: false };
      });
      return result;
    } catch (error) {
      if (error?.code !== 11000) throw error;
      const retry = await findRequest(key, null, true);
      if (retry?.huellaSolicitud === requestFingerprint) return { reintegro: retry, idempotente: true };
      throw AppError.conflicto('La clave de operación ya fue utilizada o el reintegro se creó simultáneamente');
    }
  }

  async function confirmManualTransferRefund({ reintegroId, adminId, importeConfirmado, referencia, idOperacion }) {
    assertAdmin(adminId);
    if (!mongoose.isObjectIdOrHexString(reintegroId)) throw AppError.solicitudInvalida('El identificador del reintegro no es válido');
    if (typeof referencia !== 'string' || referencia.trim().length < 3 || referencia.trim().length > 120) {
      throw AppError.solicitudInvalida('La referencia de la devolución efectuada es obligatoria');
    }
    const key = normalizeIdempotency(idOperacion);
    const cents = normalizeAmount(importeConfirmado);
    const confirmFingerprint = fingerprint({ reintegroId: String(reintegroId), importeConfirmado: cents.toString(), referencia: referencia.trim() });
    await assertIndexes();

    return transaction(async (session) => {
      let query = Reintegro.findById(reintegroId);
      if (query && typeof query.select === 'function') query = query.select('+huellaConfirmacion');
      const refund = await execute(query, session);
      if (!refund) throw AppError.noEncontrado('Reintegro no encontrado');
      if (refund.idConfirmacion) {
        if (refund.idConfirmacion === key && refund.huellaConfirmacion === confirmFingerprint) return { reintegro: refund, idempotente: true };
        throw AppError.conflicto('El reintegro ya fue confirmado con otros datos');
      }
      if (refund.proveedor !== 'TRANSFERENCIA' || refund.estado !== 'PENDIENTE_MANUAL') {
        throw AppError.conflicto('El reintegro no está pendiente de confirmación manual');
      }
      const order = await execute(Pedido.findById(refund.pedidoId), session);
      if (!order) throw AppError.noEncontrado('Pedido no encontrado');
      const requested = parseMoneyToCents(refund.importeSolicitado);
      const original = parseMoneyToCents(order.total);
      if (requested === null || cents > requested || original === null) throw AppError.conflicto('El importe confirmado excede el reintegro solicitado');
      await lockOrder(order, session, null);
      const previous = await confirmedRefundCents(order._id, session, refund._id);
      if (previous + cents > original) throw AppError.conflicto('Los reintegros confirmados superarían el importe acreditado');
      const when = ahora();
      const fullyRefunded = previous + cents === original;
      const changed = await Reintegro.updateOne({ _id: refund._id, estado: 'PENDIENTE_MANUAL', idConfirmacion: { $exists: false } }, {
        $set: {
          estado: 'COMPLETADO', importeConfirmado: mongoose.Types.Decimal128.fromString(formatCents(cents)),
          adminResponsableId: adminId, referenciaDevolucion: referencia.trim(), idConfirmacion: key,
          huellaConfirmacion: confirmFingerprint, confirmadoEn: when, procesadoEn: when,
          tipo: fullyRefunded ? 'TOTAL' : 'PARCIAL'
        },
        $push: { historial: { estado: 'COMPLETADO', adminId, nota: `Devolución verificada: ${referencia.trim()}`, creadoEn: when } }
      }, { session });
      if ((changed?.modifiedCount ?? changed?.nModified ?? 0) !== 1) throw AppError.conflicto('El reintegro cambió durante la confirmación');
      const update = { estadoReintegro: fullyRefunded ? 'COMPLETO' : 'PARCIAL' };
      if (fullyRefunded) update.estadoPago = 'REEMBOLSADO';
      await Pedido.updateOne({ _id: order._id }, { $set: update }, { session });
      return { confirmado: true, idempotente: false, reintegroId: String(refund._id), estado: 'COMPLETADO' };
    });
  }

  async function submitMarketplaceRefund(reintegroId) {
    if (env.MP_ENVIRONMENT !== 'test' || env.MP_REFUND_OPERATIONS_ENABLED !== true
      || env.MP_ORDER_FLOW_READY !== true || env.MP_WEBHOOKS_READY !== true
      || !orderClient || typeof orderClient.refundOrder !== 'function' || typeof orderClient.getOrder !== 'function') {
      throw new AppError('Los reintegros de Mercado Pago están deshabilitados; no se realizó ninguna llamada externa', 503);
    }
    const refund = await execute(Reintegro.findById(reintegroId));
    if (!refund || refund.proveedor !== 'MERCADO_PAGO') throw AppError.noEncontrado('Solicitud de reintegro no encontrada');
    if (!['SOLICITADO', 'INDETERMINADO'].includes(refund.estado)) throw AppError.conflicto('La solicitud no puede enviarse en su estado actual; primero debe conciliarse');
    if (!orderClient || typeof orderClient.getOrder !== 'function' || typeof orderClient.refundOrder !== 'function') {
      throw new AppError('La integración de reintegros no está disponible', 503);
    }
    const official = await orderClient.getOrder(refund.proveedorOrderId);
    const payment = official?.transactions?.payments?.find((entry) => String(entry.id) === String(refund.proveedorPagoId));
    const order = await execute(Pedido.findById(refund.pedidoId));
    if (!order || String(official?.id) !== String(refund.proveedorOrderId) || !payment
      || official?.external_reference !== `OV-${order.numero}`
      || official?.currency !== 'ARS' || official?.status !== 'processed' || official?.status_detail !== 'accredited'
      || payment.status !== 'processed' || payment.status_detail !== 'accredited') {
      throw AppError.conflicto('La acreditación oficial no coincide; el reintegro requiere conciliación');
    }
    const amountCents = parseMoneyToCents(refund.importeSolicitado);
    const totalCents = parseMoneyToCents(order?.total);
    const paidCents = parseMoneyToCents(payment.paid_amount || official.total_paid_amount || '');
    const officialTotalCents = parseMoneyToCents(official.total_amount);
    const officialPaidCents = parseMoneyToCents(official.total_paid_amount || '');
    const providerRefunds = getProviderRefunds(official, payment);
    const providerRefunded = providerRefunds.reduce((sum, entry) => {
      // También reservamos reembolsos en curso: no deben liberar capacidad para otra solicitud.
      if (['rejected', 'cancelled', 'canceled'].includes(entry.status)) return sum;
      const entryCents = parseMoneyToCents(entry.amount);
      return entryCents === null ? null : sum === null ? null : sum + entryCents;
    }, 0n);
    const localAllocatedOther = await allocatedRefundCents(refund.pedidoId, null, refund._id);
    const localCompleted = await confirmedRefundCents(refund.pedidoId);
    const localPendingOther = localAllocatedOther - localCompleted;
    if (amountCents === null || totalCents === null || paidCents !== totalCents || officialTotalCents !== totalCents
      || officialPaidCents !== totalCents || providerRefunded === null || localPendingOther < 0n
      || providerRefunded + localPendingOther + amountCents > totalCents) {
      throw AppError.conflicto('El importe a reintegrar supera el importe acreditado oficialmente');
    }
    const claimed = await Reintegro.updateOne({ _id: refund._id, estado: { $in: ['SOLICITADO', 'INDETERMINADO'] } }, {
      $set: { estado: 'EN_PROCESO', procesadoEn: ahora() },
      $push: { historial: { estado: 'EN_PROCESO', nota: 'Solicitud transmitida con clave externa idempotente', creadoEn: ahora() } }
    });
    if ((claimed?.modifiedCount ?? claimed?.nModified ?? 0) !== 1) throw AppError.conflicto('La solicitud ya está siendo procesada o requiere conciliación');
    try {
      const isWholeOrder = amountCents === totalCents && refund.tipo === 'TOTAL';
      const response = await orderClient.refundOrder(refund.proveedorOrderId, refund.idOperacion, isWholeOrder
        ? {}
        : { paymentId: refund.proveedorPagoId, importe: formatCents(amountCents) });
      if (String(response?.id) !== String(refund.proveedorOrderId) || typeof response?.status !== 'string') {
        throw new Error('La respuesta del proveedor no se puede conciliar');
      }
      const responsePayment = response?.transactions?.payments?.find((entry) => String(entry.id) === String(refund.proveedorPagoId))
        || { id: refund.proveedorPagoId };
      const providerRefundId = getProviderRefunds(response, responsePayment).find((entry) => entry.id)?.id || null;
      await Reintegro.updateOne({ _id: refund._id, estado: 'EN_PROCESO' }, {
        $set: { estado: 'EN_REVISION', estadoProveedor: response.status, estadoDetalleProveedor: response.status_detail || null, proveedorReintegroId: providerRefundId, incidencia: 'Respuesta del proveedor pendiente de conciliación oficial' },
        $push: { historial: { estado: 'EN_REVISION', nota: 'La respuesta del proveedor requiere conciliación; no se marcó como completado', creadoEn: ahora() } }
      });
      logger.warn('refund.marketplace.pending_reconciliation', { refundId: String(refund._id), orderId: String(refund.pedidoId), provider: 'MERCADO_PAGO', state: 'EN_REVISION' });
      void logger.alerts?.dispatch('refund:marketplace:reconciliation', 'refund.marketplace.pending_reconciliation', { refundId: String(refund._id), orderId: String(refund.pedidoId) });
      return { enviado: true, estado: 'EN_REVISION', requiereConciliacion: true };
    } catch (error) {
      const estado = error?.providerStatus >= 400 && error.providerStatus < 500 && error.providerStatus !== 409 ? 'FALLIDO' : 'INDETERMINADO';
      await Reintegro.updateOne({ _id: refund._id, estado: 'EN_PROCESO' }, {
        $set: { estado, incidencia: estado === 'INDETERMINADO' ? 'Respuesta externa no confirmada; reintentar con la misma clave o conciliar' : 'El proveedor rechazó la solicitud' },
        $push: { historial: { estado, nota: estado === 'INDETERMINADO' ? 'Respuesta externa no confirmada' : 'Solicitud rechazada por el proveedor', creadoEn: ahora() } }
      });
      (estado === 'INDETERMINADO' ? logger.error : logger.warn)('refund.marketplace.submission_failed', {
        refundId: String(refund._id), orderId: String(refund.pedidoId), provider: 'MERCADO_PAGO', state: estado,
        errorCode: String(error?.providerStatus || error?.code || error?.name || 'PROVIDER_ERROR')
      });
      if (estado === 'INDETERMINADO') void logger.alerts?.dispatch('refund:marketplace:indeterminate', 'refund.marketplace.indeterminate', { refundId: String(refund._id), orderId: String(refund.pedidoId) });
      if (estado === 'INDETERMINADO') throw new AppError('El resultado del proveedor es indeterminado; requiere conciliación antes de reintentar', 503);
      throw AppError.conflicto('Mercado Pago rechazó la solicitud de reintegro');
    }
  }

  async function reconcileMarketplaceRefund(reintegroId) {
    if (env.MP_ENVIRONMENT !== 'test' || env.MP_REFUND_OPERATIONS_ENABLED !== true) {
      throw new AppError('La conciliación de reintegros externos permanece cerrada por configuración', 503);
    }
    if (!orderClient || typeof orderClient.getOrder !== 'function') throw new AppError('La consulta a Mercado Pago no está disponible', 503);
    const refund = await execute(Reintegro.findById(reintegroId));
    if (!refund || refund.proveedor !== 'MERCADO_PAGO') throw AppError.noEncontrado('Solicitud de reintegro no encontrada');
    const official = await orderClient.getOrder(refund.proveedorOrderId);
    if (String(official?.id) !== String(refund.proveedorOrderId)) throw AppError.conflicto('La order consultada no coincide con el reintegro');
    const payment = official?.transactions?.payments?.find((entry) => String(entry.id) === String(refund.proveedorPagoId));
    const refunds = getProviderRefunds(official, payment);
    const match = refunds.find((entry) => String(entry.id) === String(refund.proveedorReintegroId));
    if (!match) {
      await Reintegro.updateOne({ _id: refund._id, estado: { $ne: 'COMPLETADO' } }, {
        $set: { estado: 'EN_REVISION', estadoProveedor: official.status || null, estadoDetalleProveedor: official.status_detail || null, incidencia: 'El proveedor no devolvió una referencia de reintegro individual conciliable' }
      });
      return { conciliado: false, estado: 'EN_REVISION' };
    }
    const refundedCents = parseMoneyToCents(match.amount);
    const requestedCents = parseMoneyToCents(refund.importeSolicitado);
    if (!['processed', 'refunded'].includes(match.status) || refundedCents !== requestedCents) {
      return { conciliado: false, estado: 'EN_REVISION' };
    }
    // La conciliación externa registra evidencia. La confirmación financiera local sigue siendo una acción administrativa auditada.
    await Reintegro.updateOne({ _id: refund._id, estado: 'EN_REVISION' }, {
      $set: { estadoProveedor: official.status, estadoDetalleProveedor: official.status_detail || null, incidencia: 'El proveedor informa el reintegro; pendiente de confirmación administrativa local' }
    });
    return { conciliado: true, estado: 'EN_REVISION', requiereConfirmacionAdministrativa: true };
  }

  async function confirmMarketplaceRefund({ reintegroId, adminId, idOperacion }) {
    assertAdmin(adminId);
    if (!orderClient || typeof orderClient.getOrder !== 'function') throw new AppError('La consulta del proveedor no estÃ¡ disponible', 503);
    if (env.MP_ENVIRONMENT !== 'test' || env.MP_REFUND_OPERATIONS_ENABLED !== true) {
      throw new AppError('La confirmación de reintegros externos permanece cerrada por configuración', 503);
    }
    if (!mongoose.isObjectIdOrHexString(reintegroId)) throw AppError.solicitudInvalida('El identificador del reintegro no es válido');
    const key = normalizeIdempotency(idOperacion);
    const refund = await execute(Reintegro.findById(reintegroId));
    if (!refund || refund.proveedor !== 'MERCADO_PAGO' || refund.estado !== 'EN_REVISION' || !refund.proveedorReintegroId) {
      throw AppError.conflicto('El reintegro no tiene una respuesta externa conciliable');
    }
    const [order, official] = await Promise.all([
      execute(Pedido.findById(refund.pedidoId)),
      orderClient.getOrder(refund.proveedorOrderId)
    ]);
    const payment = official?.transactions?.payments?.find((entry) => String(entry.id) === String(refund.proveedorPagoId));
    const providerRefund = getProviderRefunds(official, payment).find((entry) => String(entry.id) === String(refund.proveedorReintegroId));
    const cents = parseMoneyToCents(providerRefund?.amount);
    const requested = parseMoneyToCents(refund.importeSolicitado);
    if (!order || String(official?.id) !== String(refund.proveedorOrderId)
      || official?.external_reference !== `OV-${order.numero}` || official?.currency !== 'ARS'
      || !['processed', 'refunded'].includes(providerRefund?.status) || cents === null || cents !== requested) {
      throw AppError.conflicto('La respuesta oficial no confirma exactamente este reintegro; continúa en revisión');
    }
    const confirmFingerprint = fingerprint({ reintegroId: String(reintegroId), idProveedor: refund.proveedorReintegroId, importe: cents.toString() });
    await assertIndexes();
    return transaction(async (session) => {
      let selected = Reintegro.findById(reintegroId);
      if (selected && typeof selected.select === 'function') selected = selected.select('+huellaConfirmacion');
      const current = await execute(selected, session);
      if (current?.idConfirmacion) {
        if (current.idConfirmacion === key && current.huellaConfirmacion === confirmFingerprint) return { confirmado: true, idempotente: true };
        throw AppError.conflicto('El reintegro ya fue confirmado con otros datos');
      }
      if (!current || current.estado !== 'EN_REVISION' || current.proveedorReintegroId !== refund.proveedorReintegroId) {
        throw AppError.conflicto('El reintegro cambió durante la conciliación');
      }
      const currentOrder = await execute(Pedido.findById(current.pedidoId), session);
      if (!currentOrder) throw AppError.noEncontrado('Pedido no encontrado');
      const original = parseMoneyToCents(currentOrder.total);
      await lockOrder(currentOrder, session, null);
      const previous = await confirmedRefundCents(currentOrder._id, session, current._id);
      if (original === null || previous + cents > original) throw AppError.conflicto('Los reintegros confirmados superarían el importe acreditado');
      const when = ahora();
      const full = previous + cents === original;
      const changed = await Reintegro.updateOne({ _id: current._id, estado: 'EN_REVISION', idConfirmacion: { $exists: false } }, {
        $set: {
          estado: 'COMPLETADO', importeConfirmado: mongoose.Types.Decimal128.fromString(formatCents(cents)),
          adminResponsableId: adminId, idConfirmacion: key, huellaConfirmacion: confirmFingerprint,
          confirmadoEn: when, procesadoEn: when, tipo: full ? 'TOTAL' : 'PARCIAL', incidencia: null
        },
        $push: { historial: { estado: 'COMPLETADO', adminId, nota: 'Reintegro confirmado contra la respuesta oficial de Orders API', creadoEn: when } }
      }, { session });
      if ((changed?.modifiedCount ?? changed?.nModified ?? 0) !== 1) throw AppError.conflicto('El reintegro cambió durante la confirmación');
      await Pedido.updateOne({ _id: currentOrder._id }, { $set: {
        estadoReintegro: full ? 'COMPLETO' : 'PARCIAL', ...(full ? { estadoPago: 'REEMBOLSADO' } : {})
      } }, { session });
      return { confirmado: true, idempotente: false, estado: 'COMPLETADO' };
    });
  }

  return { requestRefund, confirmManualTransferRefund, submitMarketplaceRefund, reconcileMarketplaceRefund, confirmMarketplaceRefund, assertIndexes };
}

module.exports = { createRefundService, RESERVED_STATES, REQUEST_INDEX, normalizeAmount };
