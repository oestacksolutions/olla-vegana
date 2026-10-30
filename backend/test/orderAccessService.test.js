const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { createOrderAccessTokenService } = require('../src/services/orderAccessToken');
const { createTransferInstructionsService, CONFIG_KEYS } = require('../src/services/transferInstructionsService');

const ID = '507f1f77bcf86cd799439011';
const OTHER_ID = '507f1f77bcf86cd799439012';
const NOW = new Date('2026-10-30T12:00:00.000Z');
const tokenService = createOrderAccessTokenService('unit-test-access-secret-with-enough-entropy-123456');

function query(value) {
  const q = {
    select() { return q; }, lean() { return q; },
    exec: async () => typeof value === 'function' ? value() : value
  };
  return q;
}

function fixture({ state = 'PENDIENTE', orderState = 'NUEVO', expired = false, config = true } = {}) {
  const order = {
    _id: new mongoose.Types.ObjectId(ID),
    numero: 20261030001234,
    metodoPago: 'TRANSFERENCIA',
    estadoPago: state,
    estado: orderState,
    total: mongoose.Types.Decimal128.fromString('45000.00'),
    venceEn: new Date(NOW.getTime() + (expired ? -1000 : 60_000)),
    accesoPublicoHasta: new Date(NOW.getTime() + 30 * 24 * 60 * 60 * 1000),
    accesoPublicoHash: tokenService.hash(tokenService.issue({ pedidoId: ID, idOperacion: 'order-access-op-001' })),
    correo: 'private@example.test', nombre: 'Nombre privado'
  };
  const reservations = [{ estado: expired ? 'LIBERADA' : 'ACTIVA', venceEn: order.venceEn }];
  const rows = config ? [
    { _id: CONFIG_KEYS.alias, valor: 'alias.configurado' },
    { _id: CONFIG_KEYS.cbuCvu, valor: '0000000000000000000000' },
    { _id: CONFIG_KEYS.titular, valor: 'Titular configurado' }
  ] : [];
  const Pedido = { findById: (id) => query(String(id) === ID ? order : null) };
  const ReservaStock = { find: () => query(reservations) };
  const Configuracion = { find: () => query(rows) };
  const service = createTransferInstructionsService({ Pedido, ReservaStock, Configuracion }, { ahora: () => NOW, orderAccessTokens: tokenService });
  return { service, order, token: tokenService.issue({ pedidoId: ID, idOperacion: 'order-access-op-001' }) };
}

test('devuelve al token autorizado importe y datos bancarios persistidos sin datos personales', async () => {
  const { service, token } = fixture();
  const result = await service.getForBuyer(ID, token);
  assert.equal(result.estado, 'PENDIENTE');
  assert.equal(result.pedidoNumero, 20261030001234);
  assert.equal(result.importeDecimal, '45000.00');
  assert.equal(result.instrucciones.alias, 'alias.configurado');
  assert.equal(result.instrucciones.cbuCvu, '0000000000000000000000');
  assert.equal('correo' in result, false);
  assert.equal('nombre' in result, false);
});

test('un token de otro pedido, ausente o vencido no revela si existe el pedido', async () => {
  const { service, token } = fixture();
  await assert.rejects(service.getForBuyer(OTHER_ID, token), { statusCode: 404 });
  await assert.rejects(service.getForBuyer(ID, ''), { statusCode: 404 });
});

test('muestra estado pagado, vencido o cancelado sin devolver instrucciones', async () => {
  const paid = fixture({ state: 'APROBADO' });
  assert.deepEqual((await paid.service.getForBuyer(ID, paid.token)).estado, 'PAGADO');
  const expired = fixture({ expired: true });
  assert.equal((await expired.service.getForBuyer(ID, expired.token)).estado, 'VENCIDO');
  const cancelled = fixture({ orderState: 'CANCELADO' });
  assert.equal((await cancelled.service.getForBuyer(ID, cancelled.token)).estado, 'CANCELADO');
  assert.equal((await cancelled.service.getForBuyer(ID, cancelled.token)).instrucciones, null);
});

test('la configuración bancaria incompleta bloquea las instrucciones y no altera el pedido', async () => {
  const { service, order, token } = fixture({ config: false });
  const result = await service.getForBuyer(ID, token);
  assert.equal(result.estado, 'CONFIGURACION_PENDIENTE');
  assert.equal(result.instrucciones, null);
  assert.equal(order.estadoPago, 'PENDIENTE');
});
