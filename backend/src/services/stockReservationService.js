const mongoose = require('mongoose');
const AppError = require('../utils/AppError');
const { calculateStockAvailability, logStockInconsistency } = require('../utils/stockAvailability');
const { ORDER_TRANSITIONS, isAllowedTransition } = require('../utils/orderStates');

const TRANSFER_RESERVATION_MS = 24 * 60 * 60 * 1000;
const MAX_RESERVED_PER_VARIANT = 100;
const RESERVATION_INDEX = 'uniq_reserva_pedido_variante';
const MOVEMENT_INDEX = 'uniq_movimiento_id_operacion';

function run(query, session) {
  if (session && query && typeof query.session === 'function') query = query.session(session);
  if (query && typeof query.lean === 'function') query = query.lean();
  return query && typeof query.exec === 'function' ? query.exec() : Promise.resolve(query);
}

function isTransientConflict(error) {
  return error?.code === 'STOCK_RESERVATION_RETRY'
    || error?.hasErrorLabel?.('TransientTransactionError')
    || error?.codeName === 'WriteConflict';
}

function retryConflict() {
  const error = new Error('La variante cambió durante la reserva');
  error.code = 'STOCK_RESERVATION_RETRY';
  return error;
}

function revisionFilter(variant) {
  return Number.isSafeInteger(variant.revisionReservas)
    ? { revisionReservas: variant.revisionReservas }
    : { revisionReservas: { $exists: false } };
}

function groupByVariant(reservations) {
  const groups = new Map();
  for (const reservation of reservations) {
    if (!reservation?.varianteId || !Number.isSafeInteger(reservation.cantidad) || reservation.cantidad < 1) {
      throw AppError.solicitudInvalida('La reserva contiene una variante o cantidad no válida');
    }
    const id = String(reservation.varianteId);
    const current = groups.get(id) || { varianteId: reservation.varianteId, cantidad: 0 };
    current.cantidad += reservation.cantidad;
    if (!Number.isSafeInteger(current.cantidad) || current.cantidad > MAX_RESERVED_PER_VARIANT) {
      throw AppError.solicitudInvalida('La cantidad a reservar supera el máximo por variante');
    }
    groups.set(id, current);
  }
  return [...groups.values()].sort((a, b) => String(a.varianteId).localeCompare(String(b.varianteId)));
}

function createStockReservationService(models, {
  startSession = () => mongoose.startSession(),
  ahora = () => new Date(),
  logger = console.error,
  verifyPaymentAuthorization = async () => false
} = {}) {
  const { Pedido, Variante, ReservaStock, MovimientoStock, HistorialEstadoPedido } = models;

  async function transaction(operation) {
    const session = await startSession();
    try {
      let result;
      await session.withTransaction(async () => { result = await operation(session); });
      return result;
    } finally {
      await session.endSession();
    }
  }

  async function requireIndexes({ movements = false } = {}) {
    try {
      const orderIndexes = await Pedido.collection.indexes();
      const numberIndex = orderIndexes.find((index) => index.key?.numero === 1 && index.unique);
      const operationIndex = orderIndexes.find((index) => index.key?.idOperacion === 1 && index.unique);
      if (!numberIndex || operationIndex?.partialFilterExpression?.idOperacion?.$type !== 'string') {
        throw new Error('missing order indexes');
      }
      const reservationIndexes = await ReservaStock.collection.indexes();
      const reservationIndex = reservationIndexes.find((index) => index.key?.pedidoId === 1 && index.key?.varianteId === 1);
      if (!reservationIndex?.unique || reservationIndex.partialFilterExpression) {
        throw new Error('missing reservation index');
      }
      if (movements) {
        const movementIndexes = await MovimientoStock.collection.indexes();
        const movementIndex = movementIndexes.find((index) => index.key?.idOperacion === 1);
        if (!movementIndex?.unique
          || movementIndex.partialFilterExpression?.idOperacion?.$type !== 'string') {
          throw new Error('missing movement index');
        }
      }
    } catch {
      throw new AppError('La operación de reservas está deshabilitada hasta verificar los índices requeridos', 503);
    }
  }

  async function acquireVariantFence(variantId, { session, decrementStock = 0 } = {}) {
    const variant = await run(Variante.findById(variantId), session);
    if (!variant) throw AppError.conflicto('Una variante del pedido ya no existe');
    const stock = Number(variant.stock);
    if (!Number.isSafeInteger(stock) || stock < 0) {
      throw AppError.conflicto('El stock físico requiere revisión antes de operar reservas');
    }
    if (decrementStock > stock) throw AppError.conflicto('El stock físico no alcanza para confirmar la venta');
    const filter = { _id: variantId, ...revisionFilter(variant) };
    if (decrementStock) filter.stock = { $gte: decrementStock };
    const update = { $inc: { revisionReservas: 1 } };
    if (decrementStock) update.$inc.stock = -decrementStock;
    const result = await Variante.updateOne(filter, update, { session, runValidators: true });
    if ((result?.matchedCount ?? result?.n ?? 0) !== 1) throw retryConflict();
    return { variant, stock };
  }

  async function reserveForOrder({ pedidoId, articulos, creadoEn, venceEn, session }) {
    if (!pedidoId || !Array.isArray(articulos) || !session) throw new TypeError('La reserva requiere pedido, artículos y sesión transaccional');
    const createdAt = creadoEn instanceof Date ? creadoEn : ahora();
    if (!Number.isFinite(createdAt.getTime())) throw AppError.solicitudInvalida('La fecha de creación de la reserva no es válida');
    const expiry = venceEn instanceof Date ? venceEn : new Date(createdAt.getTime() + TRANSFER_RESERVATION_MS);
    if (expiry.getTime() !== createdAt.getTime() + TRANSFER_RESERVATION_MS) {
      throw new TypeError('Las reservas de transferencia deben vencer exactamente 24 horas después de su creación');
    }
    const grouped = groupByVariant(articulos.map((item) => ({ varianteId: item.varianteId, cantidad: item.cantidad })));
    const reservationsToCreate = [];
    for (const group of grouped) {
      const { variant, stock } = await acquireVariantFence(group.varianteId, { session });
      const active = await run(ReservaStock.find({ varianteId: group.varianteId, estado: 'ACTIVA' }), session);
      const availability = calculateStockAvailability(stock, active, ahora());
      logStockInconsistency(group.varianteId, availability, logger);
      if (availability.inconsistente) throw AppError.conflicto('La disponibilidad de una variante requiere revisión');
      if (group.cantidad > availability.stockDisponible) {
        throw new AppError('El stock disponible cambió; revisá las cantidades del carrito', 422, [{ varianteId: String(group.varianteId) }]);
      }
      reservationsToCreate.push({ pedidoId, varianteId: group.varianteId, cantidad: group.cantidad, estado: 'ACTIVA', creadoEn: createdAt, venceEn: expiry });
    }
    if (!reservationsToCreate.length) throw AppError.solicitudInvalida('El pedido debe incluir al menos una variante');
    return ReservaStock.create(reservationsToCreate, { session });
  }

  async function updateOrderToCancelled(order, session, note) {
    if (order.estado === 'CANCELADO') return false;
    if (!isAllowedTransition(ORDER_TRANSITIONS, order.estado, 'CANCELADO')) {
      throw AppError.conflicto('El estado actual del pedido no permite cancelarlo');
    }
    const changed = await Pedido.updateOne(
      { _id: order._id, estado: order.estado, estadoPago: 'PENDIENTE' },
      { $set: { estado: 'CANCELADO' } }, { session }
    );
    if ((changed?.modifiedCount ?? changed?.nModified ?? 0) !== 1) throw retryConflict();
    await HistorialEstadoPedido.create([{
      pedidoId: order._id, estadoAnterior: order.estado, estadoNuevo: 'CANCELADO', nota: note
    }], { session });
    return true;
  }

  async function releaseOrderReservations(order, session, releasedAt) {
    const active = await run(ReservaStock.find({ pedidoId: order._id, estado: 'ACTIVA' }), session);
    if (!active.length) return 0;
    const result = await ReservaStock.updateMany(
      { pedidoId: order._id, estado: 'ACTIVA' },
      { $set: { estado: 'LIBERADA', liberadaEn: releasedAt } }, { session }
    );
    return result?.modifiedCount ?? result?.nModified ?? active.length;
  }

  async function cancelOrder(pedidoId, { motivo = 'Pedido cancelado' } = {}) {
    const cancelledAt = ahora();
    return transaction(async (session) => {
      const order = await run(Pedido.findById(pedidoId), session);
      if (!order) throw AppError.noEncontrado('Pedido no encontrado');
      if (order.estado === 'CANCELADO' && order.estadoPago === 'PENDIENTE') {
        const liberadas = await releaseOrderReservations(order, session, cancelledAt);
        return { cancelado: false, reservasLiberadas: liberadas, idempotente: true };
      }
      if (order.estadoPago !== 'PENDIENTE') throw AppError.conflicto('No se puede cancelar un pedido cuyo pago ya fue procesado');
      const changed = await updateOrderToCancelled(order, session, motivo);
      const liberadas = await releaseOrderReservations(order, session, cancelledAt);
      return { cancelado: changed, reservasLiberadas: liberadas, idempotente: false };
    });
  }

  async function confirmPayment(pedidoId, authorization) {
    const authorized = await verifyPaymentAuthorization({ pedidoId, authorization });
    if (authorized !== true) throw AppError.prohibido('No existe una acreditación de pago autorizada');
    await requireIndexes({ movements: true });
    const confirmedAt = ahora();
    return transaction(async (session) => {
      const order = await run(Pedido.findById(pedidoId), session);
      if (!order) throw AppError.noEncontrado('Pedido no encontrado');
      const reservations = await run(ReservaStock.find({ pedidoId: order._id }).sort({ varianteId: 1 }), session);
      if (order.estadoPago === 'APROBADO') {
        if (reservations.length && reservations.every((reservation) => reservation.estado === 'CONFIRMADA')) {
          return { confirmado: true, idempotente: true, pedidoId: String(order._id) };
        }
        throw AppError.conflicto('El estado de pago y las reservas requieren revisión');
      }
      if (order.estadoPago !== 'PENDIENTE' || order.estado === 'CANCELADO') throw AppError.conflicto('El pedido ya no admite confirmar el pago');
      if (!reservations.length || reservations.some((reservation) => reservation.estado !== 'ACTIVA' || !(reservation.venceEn > confirmedAt))) {
        throw AppError.conflicto('Una o más reservas vencieron o ya no están activas');
      }
      for (const group of groupByVariant(reservations)) {
        const { variant, stock } = await acquireVariantFence(group.varianteId, { session, decrementStock: group.cantidad });
        if (stock < group.cantidad) throw AppError.conflicto('El stock físico no alcanza para confirmar la venta');
        const operationId = `venta:${order._id}:${group.varianteId}`;
        await MovimientoStock.create([{
          varianteId: group.varianteId, tipo: 'VENTA', cantidad: -group.cantidad,
          motivo: `Pedido ${order.numero} confirmado`, stockAnterior: stock,
          stockResultante: stock - group.cantidad, idOperacion: operationId, creadoEn: confirmedAt
        }], { session });
      }
      const reservationUpdate = await ReservaStock.updateMany(
        { pedidoId: order._id, estado: 'ACTIVA', venceEn: { $gt: confirmedAt } },
        { $set: { estado: 'CONFIRMADA', confirmadaEn: confirmedAt } }, { session }
      );
      if ((reservationUpdate?.modifiedCount ?? reservationUpdate?.nModified ?? 0) !== reservations.length) throw retryConflict();
      const orderUpdate = await Pedido.updateOne(
        { _id: order._id, estadoPago: 'PENDIENTE', estado: { $ne: 'CANCELADO' } },
        { $set: { estadoPago: 'APROBADO', pagoVerificadoEn: confirmedAt, pagadoEn: confirmedAt } }, { session }
      );
      if ((orderUpdate?.modifiedCount ?? orderUpdate?.nModified ?? 0) !== 1) throw retryConflict();
      return { confirmado: true, idempotente: false, pedidoId: String(order._id) };
    });
  }

  async function expireDueReservations({ hasta = ahora(), limite = 100 } = {}) {
    if (!(hasta instanceof Date) || !Number.isFinite(hasta.getTime()) || !Number.isSafeInteger(limite) || limite < 1 || limite > 1000) {
      throw AppError.solicitudInvalida('El rango de expiración no es válido');
    }
    const due = await run(ReservaStock.find({ estado: 'ACTIVA', venceEn: { $lte: hasta } }).sort({ venceEn: 1, pedidoId: 1 }).limit(limite));
    const orderIds = [...new Set(due.map((reservation) => String(reservation.pedidoId)))];
    const results = [];
    for (const orderId of orderIds) {
      try {
        const result = await transaction(async (session) => {
          const order = await run(Pedido.findById(orderId), session);
          if (!order || order.estadoPago !== 'PENDIENTE') return { pedidoId: orderId, expirado: false, idempotente: true };
          if (order.estado === 'CANCELADO') {
            const liberadas = await releaseOrderReservations(order, session, hasta);
            return { pedidoId: orderId, expirado: false, reservasLiberadas: liberadas, idempotente: true };
          }
          const active = await run(ReservaStock.find({ pedidoId: order._id, estado: 'ACTIVA' }), session);
          if (!active.length || active.some((reservation) => reservation.venceEn > hasta)) return { pedidoId: orderId, expirado: false, idempotente: true };
          await updateOrderToCancelled(order, session, 'Reserva de stock vencida');
          const liberadas = await releaseOrderReservations(order, session, hasta);
          return { pedidoId: orderId, expirado: true, reservasLiberadas: liberadas };
        });
        results.push(result);
      } catch (error) {
        if (!isTransientConflict(error)) throw error;
        results.push({ pedidoId: orderId, expirado: false, reintentar: true });
      }
    }
    return { procesados: results.length, resultados: results };
  }

  async function assertReservationIndex() { return requireIndexes(); }

  return { reserveForOrder, cancelOrder, confirmPayment, expireDueReservations, assertReservationIndex };
}

module.exports = {
  createStockReservationService,
  TRANSFER_RESERVATION_MS,
  MAX_RESERVED_PER_VARIANT,
  RESERVATION_INDEX,
  MOVEMENT_INDEX,
  isTransientConflict
};
