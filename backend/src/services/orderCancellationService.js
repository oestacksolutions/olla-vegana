const crypto = require('node:crypto');
const mongoose = require('mongoose');
const AppError = require('../utils/AppError');
const { parseMoneyToCents } = require('./cartValidationService');
const { ORDER_TRANSITIONS, isAllowedTransition } = require('../utils/orderStates');

function execute(query) {
  if (query && typeof query.lean === 'function') query = query.lean();
  return query && typeof query.exec === 'function' ? query.exec() : Promise.resolve(query);
}

function createOrderCancellationService({ Pedido, IntentoPago, HistorialEstadoPedido }, {
  stockReservationService,
  orderClient,
  emailOutbox = null,
  env = {},
  ahora = () => new Date()
} = {}) {
  if (!Pedido || !HistorialEstadoPedido || !stockReservationService) throw new TypeError('La cancelación requiere Pedido, historial y el servicio CAR-06');

  async function cancelPending({ pedidoId, adminId, motivo }) {
    if (!mongoose.isObjectIdOrHexString(pedidoId)) throw AppError.solicitudInvalida('El identificador del pedido no es válido');
    if (!mongoose.isObjectIdOrHexString(adminId)) throw AppError.prohibido('Se requiere una sesión administrativa válida');
    if (typeof motivo !== 'string' || !motivo.trim() || motivo.trim().length > 500) {
      throw AppError.solicitudInvalida('El motivo es obligatorio y debe tener hasta 500 caracteres');
    }
    const order = await execute(Pedido.findById(pedidoId));
    if (!order) throw AppError.noEncontrado('Pedido no encontrado');
    if (order.estado === 'RETIRADO') throw AppError.conflicto('Un pedido retirado requiere una evaluación de devolución; no puede cancelarse desde este flujo');
    if (order.estadoPago !== 'PENDIENTE') throw AppError.conflicto('El pago ya fue procesado; debe gestionarse mediante un reintegro separado');
    if (order.estado === 'CANCELADO') {
      return stockReservationService.cancelOrder(pedidoId, { motivo: motivo.trim(), adminId });
    }

    if (order.metodoPago === 'MERCADO_PAGO' && IntentoPago) {
      const attempt = await execute(IntentoPago.findOne({ proveedor: 'MERCADO_PAGO', pedidoId }).sort({ creadoEn: -1 }));
      if (attempt?.orderExternaId) {
        if (env.MP_ENVIRONMENT !== 'test' || env.MP_ORDER_CANCELLATION_ENABLED !== true
          || !orderClient || typeof orderClient.getOrder !== 'function' || typeof orderClient.cancelOrder !== 'function') {
          throw new AppError('La cancelación externa de Mercado Pago está deshabilitada; el pedido y su reserva no se modificaron', 503);
        }
        let official;
        try { official = await orderClient.getOrder(attempt.orderExternaId); }
        catch { throw new AppError('No se pudo verificar la operación de Mercado Pago; el pedido y su reserva no se modificaron', 503); }
        if (String(official?.id) !== String(attempt.orderExternaId)
          || official?.external_reference !== `OV-${order.numero}`
          || parseMoneyToCents(official?.total_amount) !== parseMoneyToCents(order.total)
          || official?.currency !== 'ARS') {
          throw AppError.conflicto('La operación externa no coincide con el pedido y requiere conciliación');
        }
        if (official.status === 'processed' || official.status === 'refunded') {
          throw AppError.conflicto('La operación externa ya no está pendiente; requiere conciliación de pago');
        }
        if (official.status !== 'canceled') {
          if (!['created', 'action_required'].includes(official.status)) {
            throw AppError.conflicto('El estado externo no admite cancelación segura; requiere revisión');
          }
          const idempotency = `cancel-${crypto.createHash('sha256').update(`${pedidoId}:${attempt.orderExternaId}`).digest('hex')}`;
          let cancelled;
          try { cancelled = await orderClient.cancelOrder(attempt.orderExternaId, idempotency); }
          catch { throw new AppError('Mercado Pago no confirmó la cancelación. Reintentá la conciliación antes de cambiar el pedido', 503); }
          if (cancelled?.status !== 'canceled') {
            throw new AppError('La cancelación externa requiere conciliación; no se liberaron las reservas', 503);
          }
        }
      }
    }

    // CAR-06 serializa la cancelación, el cambio del pedido y la liberación de reservas.
    return stockReservationService.cancelOrder(pedidoId, { motivo: motivo.trim(), adminId });
  }

  async function cancelPaidBeforePickup({ pedidoId, adminId, motivo }) {
    if (!mongoose.isObjectIdOrHexString(pedidoId)) throw AppError.solicitudInvalida('El identificador del pedido no es válido');
    if (!mongoose.isObjectIdOrHexString(adminId)) throw AppError.prohibido('Se requiere una sesión administrativa autorizada');
    if (typeof motivo !== 'string' || !motivo.trim() || motivo.trim().length > 500) {
      throw AppError.solicitudInvalida('El motivo es obligatorio y debe tener hasta 500 caracteres');
    }
    const session = await Pedido.db.startSession();
    try {
      let result;
      await session.withTransaction(async () => {
        const order = await execute(Pedido.findById(pedidoId).session(session));
        if (!order) throw AppError.noEncontrado('Pedido no encontrado');
        if (order.estado === 'CANCELADO' && order.estadoPago === 'APROBADO') {
          result = { cancelado: false, idempotente: true, estadoPago: order.estadoPago, estadoReintegro: order.estadoReintegro || 'EN_REVISION' };
          return;
        }
        if (order.estadoPago !== 'APROBADO') throw AppError.conflicto('Esta operación requiere un pago previamente acreditado');
        if (order.estado === 'RETIRADO') throw AppError.conflicto('El pedido fue retirado; requiere la política de devolución y evaluación de mercadería');
        if (!isAllowedTransition(ORDER_TRANSITIONS, order.estado, 'CANCELADO')) throw AppError.conflicto('El estado del pedido no admite cancelación');
        const changed = await Pedido.updateOne({
          _id: order._id, estado: order.estado, estadoPago: 'APROBADO',
          ...(Number.isSafeInteger(order.revisionReintegros) ? { revisionReintegros: order.revisionReintegros } : { revisionReintegros: { $exists: false } })
        }, {
          $set: {
            estado: 'CANCELADO', estadoReintegro: order.estadoReintegro === 'SIN_REINTEGRO' || !order.estadoReintegro ? 'EN_REVISION' : order.estadoReintegro,
            canceladoEn: ahora(), canceladoPorAdminId: adminId, cancelacionMotivo: motivo.trim()
          },
          $inc: { revisionReintegros: 1 }
        }, { session });
        if ((changed?.modifiedCount ?? changed?.nModified ?? 0) !== 1) throw AppError.conflicto('El pedido cambió durante la cancelación');
        await HistorialEstadoPedido.create([{
          pedidoId: order._id, estadoAnterior: order.estado, estadoNuevo: 'CANCELADO',
          nota: `Cancelación de pedido pagado: ${motivo.trim()}`, adminId
        }], { session });
        if (emailOutbox) await emailOutbox.enqueue({ pedidoId: order._id, tipo: 'PEDIDO_CANCELADO', session });
        // No se liberan reservas confirmadas ni se repone stock físico. Un reintegro es un flujo separado.
        result = { cancelado: true, idempotente: false, estadoPago: 'APROBADO', estadoReintegro: 'EN_REVISION' };
      });
      return result;
    } finally { await session.endSession(); }
  }

  return { cancelPending, cancelPaidBeforePickup };
}

module.exports = { createOrderCancellationService };
