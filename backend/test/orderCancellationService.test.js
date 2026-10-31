const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { createOrderCancellationService } = require('../src/services/orderCancellationService');

const ORDER = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011');
const ADMIN = new mongoose.Types.ObjectId('507f1f77bcf86cd799439012');

function query(value) {
  const q = { sort() { return q; }, lean() { return q; }, session() { return q; }, exec: async () => typeof value === 'function' ? value() : value };
  return q;
}

function setup({ method = 'TRANSFERENCIA', payment = 'PENDIENTE', state = 'NUEVO', external = null, gate = false } = {}) {
  const data = { order: { _id: ORDER, numero: 20261030000001, metodoPago: method, estadoPago: payment, estado: state, total: mongoose.Types.Decimal128.fromString('100.00') }, history: [] };
  const session = { withTransaction: async (fn) => fn(), endSession: async () => {} };
  const Pedido = {
    db: { startSession: async () => session },
    findById: () => query(data.order),
    updateOne: async (filter, update) => {
      if (filter.estado && data.order.estado !== filter.estado) return { modifiedCount: 0 };
      if (filter.estadoPago && data.order.estadoPago !== filter.estadoPago) return { modifiedCount: 0 };
      if (filter.revisionReintegros?.$exists === false && data.order.revisionReintegros !== undefined) return { modifiedCount: 0 };
      if (typeof filter.revisionReintegros === 'number' && data.order.revisionReintegros !== filter.revisionReintegros) return { modifiedCount: 0 };
      Object.assign(data.order, update.$set);
      for (const [key, value] of Object.entries(update.$inc || {})) data.order[key] = (data.order[key] || 0) + value;
      return { modifiedCount: 1 };
    }
  };
  const HistorialEstadoPedido = { create: async (rows) => { data.history.push(...rows); return rows; } };
  const IntentoPago = { findOne: () => query(external) };
  const stockCalls = [];
  const stockReservationService = { cancelOrder: async (...args) => { stockCalls.push(args); return { cancelado: true, reservasLiberadas: 1 }; } };
  const providerCalls = [];
  const orderClient = {
    getOrder: async () => ({ id: external?.orderExternaId, external_reference: `OV-${data.order.numero}`, total_amount: '100.00', currency: 'ARS', status: 'created' }),
    cancelOrder: async (...args) => { providerCalls.push(args); return { id: external.orderExternaId, status: 'canceled' }; }
  };
  const service = createOrderCancellationService({ Pedido, IntentoPago, HistorialEstadoPedido }, {
    stockReservationService, orderClient, env: { MP_ENVIRONMENT: 'test', MP_ORDER_CANCELLATION_ENABLED: gate }, ahora: () => new Date('2026-10-30T12:00:00Z')
  });
  return { service, data, stockCalls, providerCalls };
}

test('cancela transferencia pendiente vía CAR-06 con actor y motivo, sin reponer stock en este servicio', async () => {
  const context = setup();
  const result = await context.service.cancelPending({ pedidoId: String(ORDER), adminId: String(ADMIN), motivo: 'Solicitud administrativa' });
  assert.equal(result.cancelado, true);
  assert.equal(context.stockCalls.length, 1);
  assert.equal(context.stockCalls[0][1].adminId.toString(), String(ADMIN));
  assert.equal(context.stockCalls[0][1].motivo, 'Solicitud administrativa');
  assert.equal(context.providerCalls.length, 0);
});

test('no libera reserva si la order externa de Mercado Pago todavía requiere cancelación y la compuerta está cerrada', async () => {
  const context = setup({ method: 'MERCADO_PAGO', external: { orderExternaId: 'ORD01J49MMW3SSBK5PSV3DFR32959' } });
  await assert.rejects(context.service.cancelPending({ pedidoId: String(ORDER), adminId: String(ADMIN), motivo: 'Prueba' }), { statusCode: 503 });
  assert.equal(context.stockCalls.length, 0);
  assert.equal(context.providerCalls.length, 0);
});

test('cancela primero la operación no pagada verificada y recién entonces delega la liberación', async () => {
  const context = setup({ method: 'MERCADO_PAGO', external: { orderExternaId: 'ORD01J49MMW3SSBK5PSV3DFR32959' }, gate: true });
  await context.service.cancelPending({ pedidoId: String(ORDER), adminId: String(ADMIN), motivo: 'Duplicado' });
  assert.equal(context.providerCalls.length, 1);
  assert.match(context.providerCalls[0][1], /^cancel-/);
  assert.equal(context.stockCalls.length, 1);
});

test('la cancelación de pedido pagado conserva APROBADO, registra auditoría y no toca inventario', async () => {
  const context = setup({ payment: 'APROBADO', state: 'LISTO_PARA_RETIRAR' });
  const result = await context.service.cancelPaidBeforePickup({ pedidoId: String(ORDER), adminId: String(ADMIN), motivo: 'Caso revisado' });
  assert.equal(result.estadoPago, 'APROBADO');
  assert.equal(result.estadoReintegro, 'EN_REVISION');
  assert.equal(context.data.order.estado, 'CANCELADO');
  assert.equal(context.data.order.estadoPago, 'APROBADO');
  assert.equal(context.data.history[0].adminId.toString(), String(ADMIN));
  assert.equal(context.stockCalls.length, 0);
});

test('no permite cancelar un pedido retirado ni cancelar con JWT sin administrador activo', async () => {
  const delivered = setup({ payment: 'APROBADO', state: 'RETIRADO' });
  await assert.rejects(delivered.service.cancelPaidBeforePickup({ pedidoId: String(ORDER), adminId: String(ADMIN), motivo: 'Devolver' }), { statusCode: 409 });
  await assert.rejects(setup().service.cancelPending({ pedidoId: String(ORDER), adminId: 'invalid', motivo: 'x' }), { statusCode: 403 });
});
