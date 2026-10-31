const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createStockReservationService, TRANSFER_RESERVATION_MS } = require('../src/services/stockReservationService');

const variantId = 'variant-1';
const varianteId = variantId;
const orderId = 'order-1';
const start = new Date('2026-10-29T12:00:00.000Z');

function matches(row, filter) {
  return Object.entries(filter).every(([key, expected]) => {
    const actual = row[key];
    if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
      if ('$exists' in expected) return expected.$exists ? actual !== undefined : actual === undefined;
      if ('$lte' in expected && !(actual <= expected.$lte)) return false;
      if ('$lt' in expected && !(actual < expected.$lt)) return false;
      if ('$gt' in expected && !(actual > expected.$gt)) return false;
      if ('$ne' in expected && actual === expected.$ne) return false;
      if ('$in' in expected && !expected.$in.includes(actual)) return false;
      return true;
    }
    return String(actual) === String(expected);
  });
}

function fixture({ stock = 5, reservations = [], orderState = 'NUEVO', paymentState = 'PENDIENTE', authorized = true } = {}) {
  const rows = {
    variants: [{ _id: variantId, stock, revisionReservas: 0 }, { _id: 'variant-2', stock: 4, revisionReservas: 0 }],
    reservations: reservations.map((row) => ({ ...row })),
    orders: [{ _id: orderId, numero: 123, metodoPago: 'MERCADO_PAGO', estado: orderState, estadoPago: paymentState }],
    history: [], movements: []
  };
  function query(getValue) {
    const state = { sort: null, limit: null };
    const q = {
      session() { return q; },
      lean() { return q; },
      sort(spec) { state.sort = spec; return q; },
      limit(value) { state.limit = value; return q; },
      async exec() {
        let result = getValue();
        if (Array.isArray(result) && state.sort) {
          const [[field, direction]] = Object.entries(state.sort);
          result = [...result].sort((a, b) => (a[field] > b[field] ? 1 : a[field] < b[field] ? -1 : 0) * direction);
        }
        if (Array.isArray(result) && state.limit != null) result = result.slice(0, state.limit);
        return result;
      }
    };
    return q;
  }
  const clone = (value) => value.map((row) => ({ ...row }));
  const sessions = [];
  const fenceOrder = [];
  const sessionFactory = async () => {
    const session = {
      async withTransaction(callback) {
        const before = Object.fromEntries(Object.entries(rows).map(([key, value]) => [key, clone(value)]));
        try { await callback(); }
        catch (error) {
          for (const key of Object.keys(rows)) rows[key] = before[key];
          throw error;
        }
      },
      async endSession() { this.ended = true; }
    };
    sessions.push(session);
    return session;
  };
  const Modelo = {
    collection: { indexes: async () => [
      { name: 'uniq_reserva_pedido_variante', key: { pedidoId: 1, varianteId: 1 }, unique: true },
      { name: 'uniq_movimiento_id_operacion', key: { idOperacion: 1 }, unique: true, partialFilterExpression: { idOperacion: { $type: 'string' } } }
    ] }
  };
  const Variante = {
    findById: (id) => query(() => rows.variants.find((row) => String(row._id) === String(id)) || null),
    updateOne: async (filter, update) => {
      const row = rows.variants.find((candidate) => String(candidate._id) === String(filter._id));
      if (!row || !matches(row, Object.fromEntries(Object.entries(filter).filter(([key]) => key !== '_id')))) return { matchedCount: 0 };
      if (filter.stock?.$gte !== undefined && row.stock < filter.stock.$gte) return { matchedCount: 0 };
      fenceOrder.push(String(row._id));
      for (const [key, amount] of Object.entries(update.$inc || {})) row[key] = (row[key] || 0) + amount;
      return { matchedCount: 1 };
    }
  };
  const ReservaStock = {
    ...Modelo,
    find: (filter) => query(() => rows.reservations.filter((row) => matches(row, filter))),
    create: async (documents) => {
      const created = documents.map((row, index) => ({ _id: `reservation-${rows.reservations.length + index + 1}`, ...row }));
      rows.reservations.push(...created);
      return created;
    },
    updateMany: async (filter, update) => {
      const matched = rows.reservations.filter((row) => matches(row, filter));
      matched.forEach((row) => Object.assign(row, update.$set));
      return { modifiedCount: matched.length };
    }
  };
  const Pedido = {
    collection: { indexes: async () => [
      { name: 'uniq_pedido_numero', key: { numero: 1 }, unique: true },
      { name: 'uniq_pedido_id_operacion', key: { idOperacion: 1 }, unique: true, partialFilterExpression: { idOperacion: { $type: 'string' } } }
    ] },
    findById: (id) => query(() => rows.orders.find((row) => String(row._id) === String(id)) || null),
    updateOne: async (filter, update) => {
      const row = rows.orders.find((candidate) => String(candidate._id) === String(filter._id) && matches(candidate, Object.fromEntries(Object.entries(filter).filter(([key]) => key !== '_id'))));
      if (!row) return { modifiedCount: 0 };
      Object.assign(row, update.$set);
      return { modifiedCount: 1 };
    }
  };
  const HistorialEstadoPedido = { create: async (documents) => { rows.history.push(...documents); return documents; } };
  const MovimientoStock = { ...Modelo, create: async (documents) => { rows.movements.push(...documents); return documents; } };
  const service = createStockReservationService(
    { Pedido, Variante, ReservaStock, MovimientoStock, HistorialEstadoPedido },
    { startSession: sessionFactory, ahora: () => new Date(start), logger: () => {}, verifyPaymentAuthorization: async () => authorized }
  );
  return { service, rows, sessions, fenceOrder, models: { Pedido, Variante, ReservaStock, MovimientoStock } };
}

test('reserva transferencia durante exactamente 24 horas sin descontar stock físico', async () => {
  const { service, rows, sessions } = fixture();
  const venceEn = new Date(start.getTime() + TRANSFER_RESERVATION_MS);
  const created = await service.reserveForOrder({
    pedidoId: orderId, articulos: [{ varianteId, cantidad: 3 }], creadoEn: start, venceEn, session: { marker: true }
  });
  assert.equal(created[0].estado, 'ACTIVA');
  assert.equal(created[0].venceEn.getTime() - created[0].creadoEn.getTime(), 24 * 60 * 60 * 1000);
  assert.equal(rows.variants[0].stock, 5);
  assert.equal(rows.variants[0].revisionReservas, 1, 'la escritura CAS serializa esta variante');
});

test('reserva varias variantes en orden determinista sin tocar el stock físico', async () => {
  const { service, rows, fenceOrder } = fixture();
  const createdAt = start;
  const expiresAt = new Date(start.getTime() + TRANSFER_RESERVATION_MS);
  const created = await service.reserveForOrder({
    pedidoId: orderId,
    articulos: [{ varianteId: 'variant-2', cantidad: 2 }, { varianteId, cantidad: 3 }],
    creadoEn: createdAt, venceEn: expiresAt, session: {}
  });
  assert.deepEqual(fenceOrder, ['variant-1', 'variant-2']);
  assert.equal(created.length, 2);
  assert.equal(rows.variants[0].stock, 5);
  assert.equal(rows.variants[1].stock, 4);
});

test('reserva ignora reservas vencidas y rechaza si las vigentes dejan stock insuficiente', async () => {
  const { service, rows } = fixture({ reservations: [
    { varianteId, estado: 'ACTIVA', cantidad: 4, venceEn: new Date(start.getTime() - 1) },
    { varianteId, estado: 'ACTIVA', cantidad: 2, venceEn: new Date(start.getTime() + 1000) }
  ] });
  await assert.rejects(service.reserveForOrder({
    pedidoId: orderId, articulos: [{ varianteId, cantidad: 4 }], creadoEn: start,
    venceEn: new Date(start.getTime() + TRANSFER_RESERVATION_MS), session: {}
  }), { statusCode: 422 });
  assert.equal(rows.reservations.length, 2, 'la transacción revierte si falta disponibilidad');
});

test('cancelación libera una sola vez y no altera el stock físico', async () => {
  const { service, rows } = fixture({ reservations: [
    { _id: 'r1', pedidoId: orderId, varianteId, estado: 'ACTIVA', cantidad: 2, venceEn: new Date(start.getTime() + 5000) }
  ] });
  const result = await service.cancelOrder(orderId);
  assert.equal(result.cancelado, true);
  assert.equal(rows.reservations[0].estado, 'LIBERADA');
  assert.equal(rows.variants[0].stock, 5);
  assert.equal((await service.cancelOrder(orderId)).idempotente, true);
  assert.equal(rows.history.length, 1);
});

test('confirmación autorizada consume el stock físico una vez y convierte la reserva', async () => {
  const { service, rows } = fixture({ reservations: [
    { _id: 'r1', pedidoId: orderId, varianteId, estado: 'ACTIVA', cantidad: 2, venceEn: new Date(start.getTime() + 5000) }
  ] });
  const first = await service.confirmPayment(orderId, { verified: true });
  assert.equal(first.idempotente, false);
  assert.equal(rows.variants[0].stock, 3);
  assert.equal(rows.reservations[0].estado, 'CONFIRMADA');
  assert.equal(rows.movements.length, 1);
  assert.equal(rows.movements[0].cantidad, -2);
  assert.equal((await service.confirmPayment(orderId, { verified: true })).idempotente, true);
  assert.equal(rows.variants[0].stock, 3);
  assert.equal(rows.movements.length, 1);
});

test('rechaza pago no autorizado y confirmación de reserva vencida', async () => {
  const unauthorized = fixture({ authorized: false, reservations: [
    { _id: 'r1', pedidoId: orderId, varianteId, estado: 'ACTIVA', cantidad: 1, venceEn: new Date(start.getTime() + 5000) }
  ] });
  await assert.rejects(unauthorized.service.confirmPayment(orderId, {}), { statusCode: 403 });
  const expired = fixture({ reservations: [
    { _id: 'r1', pedidoId: orderId, varianteId, estado: 'ACTIVA', cantidad: 1, venceEn: new Date(start.getTime() - 1) }
  ] });
  await assert.rejects(expired.service.confirmPayment(orderId, {}), { statusCode: 409 });
  assert.equal(expired.rows.variants[0].stock, 5);
});

test('el worker puede expirar pedidos pendientes de forma idempotente sin descontar stock', async () => {
  const expiry = new Date(start.getTime() + TRANSFER_RESERVATION_MS);
  const context = fixture({ reservations: [
    { _id: 'r1', pedidoId: orderId, varianteId, estado: 'ACTIVA', cantidad: 2, venceEn: expiry }
  ] });
  const first = await context.service.expireDueReservations({ hasta: expiry });
  assert.equal(first.resultados[0].expirado, true);
  assert.equal(context.rows.orders[0].estado, 'CANCELADO');
  assert.equal(context.rows.orders[0].estadoPago, 'PENDIENTE');
  assert.equal(context.rows.reservations[0].estado, 'LIBERADA');
  assert.equal(context.rows.variants[0].stock, 5);
  const second = await context.service.expireDueReservations({ hasta: expiry });
  assert.equal(second.procesados, 0);
  assert.equal(context.rows.history.length, 1);
});

test('la creación falla cerrada si falta un índice requerido', async () => {
  const context = fixture();
  context.models.ReservaStock.collection.indexes = async () => [];
  await assert.rejects(context.service.assertReservationIndex(), { statusCode: 503 });
});

test('rechazo Mercado Pago libera reservas de forma idempotente sin modificar stock físico', async () => {
  const context = fixture({ reservations: [
    { _id: 'r1', pedidoId: orderId, varianteId, estado: 'ACTIVA', cantidad: 2, venceEn: new Date(start.getTime() + 5000) }
  ] });
  const first = await context.service.rejectVerifiedMarketplacePayment(orderId, { provider: 'MERCADO_PAGO', verified: true });
  assert.equal(first.rechazado, true);
  assert.equal(context.rows.orders[0].estadoPago, 'RECHAZADO');
  assert.equal(context.rows.orders[0].estado, 'CANCELADO');
  assert.equal(context.rows.reservations[0].estado, 'LIBERADA');
  assert.equal(context.rows.variants[0].stock, 5);
  const retry = await context.service.rejectVerifiedMarketplacePayment(orderId, { provider: 'MERCADO_PAGO', verified: true });
  assert.equal(retry.idempotente, true);
  assert.equal(context.rows.history.length, 1);
  assert.equal(context.rows.movements.length, 0);
});
