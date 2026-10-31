const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createAdminOrderService, parseListQuery } = require('../src/services/adminOrderService');

const id = '64b000000000000000000001';

test('parsea filtros administrativos y convierte el límite de fecha en exclusivo', () => {
  const parsed = parseListQuery({ q: 'OV-20261030', estado: 'NUEVO', estadoPago: 'PENDIENTE', metodoPago: 'TRANSFERENCIA', retiro: 'Morón', desde: '2026-10-01', hasta: '2026-10-30', page: '2', limit: '15' });
  assert.equal(parsed.q, 'OV-20261030');
  assert.equal(parsed.page, 2);
  assert.equal(parsed.limit, 15);
  assert.equal(parsed.desde.toISOString(), '2026-10-01T00:00:00.000Z');
  assert.equal(parsed.hasta.toISOString(), '2026-10-31T00:00:00.000Z');
});

test('rechaza estados, fechas, límites y filtros desconocidos', () => {
  for (const query of [
    { estado: 'PAGADO' }, { estadoPago: 'EN_PREPARACION' }, { metodoPago: 'EFECTIVO' },
    { desde: '2026-02-30' }, { hasta: '2026/10/30' }, { page: '0' }, { limit: '1000' }, { adminId: id }
  ]) assert.throws(() => parseListQuery(query));
});

test('mantiene bloqueados por defecto los cambios operativos críticos', async () => {
  let openedSession = false;
  const service = createAdminOrderService({ Pedido: { db: { startSession: async () => { openedSession = true; } } } });
  await assert.rejects(
    service.transitionOrder(id, { estado: 'EN_PREPARACION' }, id),
    (error) => error.statusCode === 503
  );
  assert.equal(openedSession, false);
});
