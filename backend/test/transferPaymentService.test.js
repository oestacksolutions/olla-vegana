const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const { createTransferPaymentService } = require('../src/services/transferPaymentService');
const { createTransferPaymentAuthorization } = require('../src/services/transferPaymentAuthorization');
const { createTransferInstructionsService, CONFIG_KEYS } = require('../src/services/transferInstructionsService');

const ORDER = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011');
const ADMIN = new mongoose.Types.ObjectId('507f1f77bcf86cd799439012');
const VARIANT = new mongoose.Types.ObjectId('507f1f77bcf86cd799439013');
const NOW = new Date('2026-10-30T12:00:00.000Z');

function query(value) {
  const q = {
    session() { return q; }, select() { return q; }, sort() { return q; }, lean() { return q; },
    exec: async () => typeof value === 'function' ? value() : value
  };
  return q;
}

function setup({ late = false, expiredActive = false, method = 'TRANSFERENCIA', indexes = true } = {}) {
  const data = {
    order: { _id: ORDER, numero: 20261030000001, metodoPago: method, estadoPago: 'PENDIENTE', estado: late ? 'CANCELADO' : 'NUEVO', total: mongoose.Types.Decimal128.fromString('20.00') },
    reservations: [{ pedidoId: ORDER, varianteId: VARIANT, cantidad: 2, estado: late ? 'LIBERADA' : 'ACTIVA', venceEn: new Date(NOW.getTime() + (expiredActive ? 0 : 1000)) }],
    events: []
  };
  const session = { withTransaction: async (fn) => fn(), endSession: async () => {} };
  const Pedido = {
    db: { startSession: async () => session },
    findById: () => query(data.order),
    updateOne: async (_filter, update) => { Object.assign(data.order, update.$set); return { modifiedCount: 1 }; }
  };
  const ReservaStock = { find: () => query(data.reservations) };
  const ConfirmacionTransferencia = {
    collection: { indexes: async () => indexes ? [
      { name: 'uniq_confirmacion_transferencia_operacion', unique: true },
      { name: 'uniq_confirmacion_transferencia_referencia', unique: true }
    ] : [] },
    findOne: (filter) => query(data.events.find((event) => Object.entries(filter).every(([key, value]) => String(event[key]) === String(value))) || null),
    create: async (rows) => { data.events.push(...rows); return rows; }
  };
  const confirmations = [];
  const stockReservationService = {
    confirmPayment: async (id, proof, options) => {
      confirmations.push({ id, proof, options });
      data.order.estadoPago = 'APROBADO';
    }
  };
  const auth = createTransferPaymentAuthorization();
  const service = createTransferPaymentService(
    { Pedido, ReservaStock, ConfirmacionTransferencia },
    { stockReservationService, transferPaymentAuthorization: auth, startSession: async () => session, ahora: () => NOW }
  );
  return { service, data, confirmations };
}

function input(overrides = {}) {
  return { pedidoId: String(ORDER), adminId: String(ADMIN), referencia: 'TRX-12345', importeAcreditado: '20.00', idOperacion: 'transfer:once-001', ...overrides };
}

test('confirma transferencia pendiente usando autorización administrativa y delega a CAR-06', async () => {
  const { service, data, confirmations } = setup();
  const result = await service.confirmTransfer(input());
  assert.equal(result.confirmado, true);
  assert.equal(data.order.estadoPago, 'APROBADO');
  assert.equal(data.events[0].resultado, 'ACREDITADA');
  assert.equal(String(data.events[0].adminId), String(ADMIN));
  assert.equal(confirmations.length, 1);
  assert.deepEqual(confirmations[0].options.paymentAudit, { adminId: String(ADMIN), referencia: 'TRX-12345' });
});

test('transfiere tardía se registra para conciliación sin llamar a CAR-06 ni aprobar el pago', async () => {
  const { service, data, confirmations } = setup({ late: true });
  const result = await service.confirmTransfer(input());
  assert.equal(result.tardia, true);
  assert.equal(data.order.estadoPago, 'PENDIENTE');
  assert.equal(data.order.transferenciaRequiereConciliacion, true);
  assert.equal(data.events[0].resultado, 'TARDIA');
  assert.equal(confirmations.length, 0);
});

test('una reserva activa vencida se trata como tardía y un pedido cancelado con reserva vigente requiere revisión', async () => {
  const expired = setup({ expiredActive: true });
  const lateResult = await expired.service.confirmTransfer(input());
  assert.equal(lateResult.tardia, true);
  assert.equal(expired.confirmations.length, 0);
  const inconsistent = setup({ late: true });
  inconsistent.data.order.estado = 'CANCELADO';
  inconsistent.data.reservations[0].estado = 'ACTIVA';
  inconsistent.data.reservations[0].venceEn = new Date(NOW.getTime() + 1000);
  await assert.rejects(inconsistent.service.confirmTransfer(input()), { statusCode: 409 });
});

test('el reintento idempotente recupera el registro y reutilizar clave con otros datos da conflicto', async () => {
  const { service, confirmations } = setup();
  const request = input();
  await service.confirmTransfer(request);
  const repeated = await service.confirmTransfer(request);
  assert.equal(repeated.idempotente, true);
  assert.equal(confirmations.length, 1);
  await assert.rejects(service.confirmTransfer({ ...request, referencia: 'TRX-OTRA' }), { statusCode: 409 });
});

test('rechaza pedidos de Mercado Pago, referencias inválidas y ausencia de índices requeridos', async () => {
  await assert.rejects(setup({ method: 'MERCADO_PAGO' }).service.confirmTransfer(input()), { statusCode: 409 });
  await assert.rejects(setup().service.confirmTransfer(input({ referencia: ' ' })), { statusCode: 400 });
  await assert.rejects(setup({ indexes: false }).service.confirmTransfer(input()), { statusCode: 503 });
});

test('rechaza un importe distinto del total histórico del pedido', async () => {
  await assert.rejects(setup().service.confirmTransfer(input({ importeAcreditado: '19.99' })), { statusCode: 409 });
  await assert.rejects(setup().service.confirmTransfer(input({ importeAcreditado: '2e1' })), { statusCode: 400 });
});

test('instrucciones usa únicamente Configuracion validada y nunca inventa cuentas', async () => {
  const withoutConfig = createTransferInstructionsService({ Configuracion: { find: () => query([]) } });
  const order = { metodoPago: 'TRANSFERENCIA', estadoPago: 'PENDIENTE', estado: 'NUEVO', numero: 123, total: mongoose.Types.Decimal128.fromString('27000.00'), venceEn: new Date(NOW.getTime() + 1000) };
  await assert.rejects(withoutConfig.getInstructions(order), { statusCode: 503 });

  const rows = [
    { _id: CONFIG_KEYS.alias, valor: 'olla.vegana' },
    { _id: CONFIG_KEYS.titular, valor: 'Titular configurado' }
  ];
  const service = createTransferInstructionsService({ Configuracion: { find: () => query(rows) } }, { ahora: () => NOW });
  const instructions = await service.getInstructions(order);
  assert.equal(instructions.alias, 'olla.vegana');
  assert.equal(instructions.cbuCvu, null);
  assert.equal(instructions.importeDecimal, '27000.00');
  assert.equal(instructions.venceEn, new Date(NOW.getTime() + 1000).toISOString());
});

test('la ruta administrativa queda protegida y POST público de pedidos sigue deshabilitado', () => {
  const app = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');
  const routes = fs.readFileSync(path.join(__dirname, '../src/routes/orderRoutes.js'), 'utf8');
  assert.match(app, /app\.use\('\/api\/admin\/orders',\s*authenticate,\s*authorizeAdmin/);
  assert.match(routes, /status\(503\)/);
});
