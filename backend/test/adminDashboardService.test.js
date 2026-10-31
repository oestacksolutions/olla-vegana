const test = require('node:test');
const assert = require('node:assert/strict');
const { createAdminDashboardService, periodRange, argentinaDayStart, subtractDecimalStrings } = require('../src/services/adminDashboardService');

function model(result, collectionName = 'test') {
  const pipelines = [];
  return { collection: { name: collectionName }, pipelines, aggregate(pipeline) { pipelines.push(pipeline); return Promise.resolve(result); } };
}

test('periodos soportados calculan ventana móvil y día argentino', () => {
  const now = new Date('2026-10-30T12:34:56.000Z');
  assert.deepEqual(periodRange('today', now), { start: new Date('2026-10-30T03:00:00.000Z'), end: now });
  assert.deepEqual(periodRange('7d', now), { start: new Date('2026-10-23T12:34:56.000Z'), end: now });
  assert.deepEqual(periodRange('30d', now), { start: new Date('2026-09-30T12:34:56.000Z'), end: now });
  assert.equal(argentinaDayStart(now).toISOString(), '2026-10-30T03:00:00.000Z');
});

test('rechaza períodos no permitidos', () => {
  assert.throws(() => periodRange('all', new Date()), { statusCode: 400 });
});

test('resume pedidos, pagos acreditados, reintegros completados y alertas sin incluir datos personales', async () => {
  const Pedido = model([{ placed: [{ count: 3 }], pendingPayment: [{ count: 1 }], credited: [{ count: 2, amount: { toString: () => '1000.50' }, malformed: 0 }], pendingTransfers: [{ count: 1 }], awaitingPickup: [{ count: 2 }] }]);
  const Reintegro = model([{ completed: [{ count: 1, amount: { toString: () => '125.25' } }], malformedCompleted: [] }]);
  const Producto = model([], 'productos');
  const Variante = model([{ low: [{ count: 1 }], lowProducts: [{ name: 'Producto', available: 3 }], out: [{ count: 1 }], outProducts: [{ name: 'Agotado', available: 0 }] }], 'variantes');
  const ReservaStock = model([], 'reservas');
  const service = createAdminDashboardService({ Pedido, Reintegro, Producto, Variante, ReservaStock }, { ahora: () => new Date('2026-10-30T12:00:00Z'), lowStockThreshold: 5 });
  const result = await service.getSummary('30d');
  assert.equal(result.orders.placed, 3);
  assert.equal(result.orders.pendingPayment, 1);
  assert.equal(result.payments.confirmedCount, 2);
  assert.equal(result.payments.creditedGross, '1000.50');
  assert.equal(result.payments.confirmedRefunds, '125.25');
  assert.equal(result.payments.netMovement, '875.25');
  assert.equal(result.payments.netReliable, true);
  assert.equal(result.attention.transferPaymentsPending, 1);
  assert.equal(result.attention.pickupsPending, 2);
  assert.equal(result.attention.lowStockCount, 1);
  assert.equal(result.attention.outOfStockCount, 1);
  assert.equal(Object.hasOwn(result, 'compradores'), false);
  assert.equal(Pedido.pipelines[0][0].$facet.credited[0].$match.estadoPago.$in.includes('PENDIENTE'), false);
  assert.equal(Reintegro.pipelines[0][0].$facet.completed[0].$match.estado, 'COMPLETADO');
  assert.equal(Variante.pipelines[0].some((stage) => stage.$lookup?.from === 'reservas'), true);
});

test('no declara neto confiable con reintegros históricos incompletos', async () => {
  const service = createAdminDashboardService({
    Pedido: model([{ placed: [], pendingPayment: [], credited: [{ count: 1, amount: '100', malformed: 0 }], pendingTransfers: [], awaitingPickup: [] }]),
    Reintegro: model([{ completed: [], malformedCompleted: [{ count: 1 }] }]),
    Producto: model([], 'productos'), Variante: model([{}], 'variantes'), ReservaStock: model([], 'reservas')
  });
  const result = await service.getSummary('today');
  assert.equal(result.payments.netReliable, false);
  assert.equal(result.payments.netMovement, null);
});

test('neto monetario utiliza centavos enteros', () => {
  assert.equal(subtractDecimalStrings('10.00', '3.75'), '6.25');
  assert.equal(subtractDecimalStrings('1.00', '1.25'), '-0.25');
});
