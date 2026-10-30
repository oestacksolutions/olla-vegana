const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { createRefundService } = require('../src/services/refundService');

const ORDER = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011');
const ADMIN = new mongoose.Types.ObjectId('507f1f77bcf86cd799439012');
const REFUND = new mongoose.Types.ObjectId('507f1f77bcf86cd799439013');

function match(row, filter) {
  return Object.entries(filter).every(([key, expected]) => {
    const actual = row[key];
    if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
      if ('$exists' in expected && (actual !== undefined) !== expected.$exists) return false;
      if ('$in' in expected && !expected.$in.includes(actual)) return false;
      if ('$ne' in expected && String(actual) === String(expected.$ne)) return false;
      if ('$type' in expected && typeof actual !== expected.$type) return false;
      return true;
    }
    return String(actual) === String(expected);
  });
}

function setup({ method = 'TRANSFERENCIA', payment = 'APROBADO', existing = [], orderClient = null, env = {} } = {}) {
  const data = {
    order: { _id: ORDER, numero: 20261030000001, metodoPago: method, estadoPago: payment, estado: 'NUEVO', total: mongoose.Types.Decimal128.fromString('100.00') },
    refunds: [...existing], transferConfirmations: method === 'TRANSFERENCIA' ? [{ pedidoId: ORDER, resultado: 'ACREDITADA' }] : [],
    attempts: method === 'MERCADO_PAGO' ? [{ pedidoId: ORDER, proveedor: 'MERCADO_PAGO', estadoCreacion: 'CREADO', estadoProveedor: 'processed', detalleEstadoProveedor: 'accredited', moneda: 'ARS', pagoExternoId: 'PAY-TEST', orderExternaId: 'ORD-TEST' }] : []
  };
  const session = { withTransaction: async (fn) => fn(), endSession: async () => {} };
  function query(get) {
    const state = { selected: false };
    const q = {
      session() { return q; }, lean() { return q; }, sort() { return q; },
      select() { state.selected = true; return q; },
      exec: async () => typeof get === 'function' ? get(state.selected) : get
    };
    return q;
  }
  const Pedido = {
    db: { startSession: async () => session },
    findById: () => query(() => data.order),
    updateOne: async (filter, update) => {
      if (filter.estadoPago && !filter.estadoPago.$in && data.order.estadoPago !== filter.estadoPago) return { matchedCount: 0 };
      if (filter.revisionReintegros?.$exists === false && data.order.revisionReintegros !== undefined) return { matchedCount: 0 };
      if (typeof filter.revisionReintegros === 'number' && data.order.revisionReintegros !== filter.revisionReintegros) return { matchedCount: 0 };
      Object.assign(data.order, update.$set || {});
      for (const [key, amount] of Object.entries(update.$inc || {})) data.order[key] = (data.order[key] || 0) + amount;
      return { matchedCount: 1, modifiedCount: 1 };
    }
  };
  const Reintegro = {
    collection: { indexes: async () => [
      { name: 'uniq_reintegro_id_operacion', key: { idOperacion: 1 }, unique: true },
      { name: 'uniq_reintegro_id_confirmacion', key: { idConfirmacion: 1 }, unique: true, partialFilterExpression: { idConfirmacion: { $type: 'string' } } },
      { name: 'uniq_reintegro_proveedor_id', key: { proveedorReintegroId: 1 }, unique: true, partialFilterExpression: { proveedorReintegroId: { $type: 'string' } } },
      { name: 'uniq_reintegro_pedido_referencia_devolucion', key: { pedidoId: 1, referenciaDevolucion: 1 }, unique: true, partialFilterExpression: { referenciaDevolucion: { $type: 'string' } } }
    ] },
    findOne: (filter) => query(() => data.refunds.find((row) => match(row, filter)) || null),
    find: (filter) => query(() => data.refunds.filter((row) => match(row, filter))),
    findById: (id) => query((selected) => {
      const row = data.refunds.find((entry) => String(entry._id) === String(id));
      return row ? (selected ? row : { ...row, huellaConfirmacion: undefined }) : null;
    }),
    create: async (documents) => {
      const rows = documents.map((document, index) => ({ _id: REFUND, ...document }));
      data.refunds.push(...rows);
      return rows;
    },
    updateOne: async (filter, update) => {
      const row = data.refunds.find((entry) => match(entry, filter));
      if (!row) return { modifiedCount: 0 };
      Object.assign(row, update.$set || {});
      if (update.$push?.historial) row.historial.push(update.$push.historial);
      return { modifiedCount: 1 };
    }
  };
  const models = {
    Pedido,
    ReservaStock: { find: () => query([]) },
    IntentoPago: { findOne: (filter) => query(data.attempts.find((row) => match(row, filter)) || null) },
    ConfirmacionTransferencia: { findOne: (filter) => query(data.transferConfirmations.find((row) => match(row, filter)) || null) },
    Reintegro
  };
  const service = createRefundService(models, { startSession: async () => session, ahora: () => new Date('2026-10-30T12:00:00Z'), orderClient, env });
  return { service, data, models };
}

function request(overrides = {}) {
  return { pedidoId: String(ORDER), adminId: String(ADMIN), motivo: 'Ajuste revisado', idOperacion: 'refund-op-0001', ...overrides };
}

test('registra solicitud de transferencia como pendiente manual, idempotente y sin inventario', async () => {
  const context = setup();
  const first = await context.service.requestRefund(request({ importe: '25.50' }));
  assert.equal(first.reintegro.estado, 'PENDIENTE_MANUAL');
  assert.equal(first.reintegro.tipo, 'PARCIAL');
  assert.equal(first.reintegro.importeSolicitado.toString(), '25.50');
  assert.equal(context.data.order.estadoReintegro, 'PENDIENTE');
  const retry = await context.service.requestRefund(request({ importe: '25.50' }));
  assert.equal(retry.idempotente, true);
  assert.equal(context.data.refunds.length, 1);
});

test('rechaza reutilizar clave con otros datos, exceso acumulado, importes inválidos y falta de pago acreditado', async () => {
  const context = setup();
  await context.service.requestRefund(request({ importe: '80.00' }));
  await assert.rejects(context.service.requestRefund(request({ importe: '79.00' })), { statusCode: 409 });
  await assert.rejects(context.service.requestRefund(request({ importe: '30.00', idOperacion: 'refund-op-0002' })), { statusCode: 409 });
  await assert.rejects(context.service.requestRefund(request({ importe: '1.003', idOperacion: 'refund-op-0003' })), { statusCode: 400 });
  await assert.rejects(setup({ payment: 'PENDIENTE' }).service.requestRefund(request()), { statusCode: 409 });
});

test('valida acreditación Mercado Pago oficial persistida y no llama al proveedor al crear la solicitud', async () => {
  const context = setup({ method: 'MERCADO_PAGO' });
  const result = await context.service.requestRefund(request({ importe: '40.00' }));
  assert.equal(result.reintegro.estado, 'SOLICITADO');
  assert.equal(result.reintegro.proveedorOrderId, 'ORD-TEST');
  assert.equal(result.reintegro.proveedorPagoId, 'PAY-TEST');
});

test('rechaza confirmar devolución manual de transferencia con importe excesivo y conserva auditoría en la confirmación', async () => {
  const context = setup();
  const { reintegro } = await context.service.requestRefund(request({ importe: '25.00' }));
  await assert.rejects(context.service.confirmManualTransferRefund({ reintegroId: String(reintegro._id), adminId: String(ADMIN), importeConfirmado: '26.00', referencia: 'TRX-DEV-1', idOperacion: 'refund-confirm-01' }), { statusCode: 409 });
  const result = await context.service.confirmManualTransferRefund({ reintegroId: String(reintegro._id), adminId: String(ADMIN), importeConfirmado: '25.00', referencia: 'TRX-DEV-1', idOperacion: 'refund-confirm-01' });
  assert.equal(result.confirmado, true);
  assert.equal(context.data.refunds[0].estado, 'COMPLETADO');
  assert.equal(context.data.refunds[0].adminResponsableId.toString(), String(ADMIN));
  assert.equal(context.data.order.estadoPago, 'APROBADO', 'un reintegro parcial no cambia el estado a totalmente reembolsado');
  assert.equal(context.data.order.estadoReintegro, 'PARCIAL');
});

test('un reintegro manual total cambia el estado financiero a REEMBOLSADO sin reponer stock', async () => {
  const context = setup();
  const { reintegro } = await context.service.requestRefund(request());
  await context.service.confirmManualTransferRefund({ reintegroId: String(reintegro._id), adminId: String(ADMIN), importeConfirmado: '100.00', referencia: 'TRX-DEV-2', idOperacion: 'refund-confirm-02' });
  assert.equal(context.data.order.estadoPago, 'REEMBOLSADO');
  assert.equal(context.data.order.estadoReintegro, 'COMPLETO');
});

test('Mercado Pago permanece cerrado por defecto y no realiza llamadas externas', async () => {
  const context = setup({ method: 'MERCADO_PAGO' });
  const { reintegro } = await context.service.requestRefund(request());
  await assert.rejects(context.service.submitMarketplaceRefund(String(reintegro._id)), { statusCode: 503 });
});

test('Mercado Pago queda en revisión tras enviar; lee la forma oficial transactions.refunds y no acredita el pedido', async () => {
  const orderClient = {
    getOrder: async () => ({
      id: 'ORD-TEST', external_reference: 'OV-20261030000001', currency: 'ARS', status: 'processed', status_detail: 'accredited',
      total_amount: '100.00', total_paid_amount: '100.00',
      transactions: { payments: [{ id: 'PAY-TEST', status: 'processed', status_detail: 'accredited', paid_amount: '100.00' }] }
    }),
    refundOrder: async (_orderId, _key, payload) => {
      assert.deepEqual(payload, { paymentId: 'PAY-TEST', importe: '25.00' });
      return { id: 'ORD-TEST', status: 'processed', transactions: { refunds: [{ id: 'REF-TEST', transaction_id: 'PAY-TEST', amount: '25.00', status: 'processed' }] } };
    }
  };
  const context = setup({ method: 'MERCADO_PAGO', orderClient, env: { MP_ENVIRONMENT: 'test', MP_REFUND_OPERATIONS_ENABLED: true, MP_ORDER_FLOW_READY: true, MP_WEBHOOKS_READY: true } });
  const { reintegro } = await context.service.requestRefund(request({ importe: '25.00' }));
  assert.equal(String(context.data.refunds[0]._id), String(reintegro._id));
  const result = await context.service.submitMarketplaceRefund(String(reintegro._id));
  assert.equal(result.estado, 'EN_REVISION');
  assert.equal(context.data.refunds[0].proveedorReintegroId, 'REF-TEST');
  assert.equal(context.data.refunds[0].estado, 'EN_REVISION');
  assert.equal(context.data.order.estadoPago, 'APROBADO');
});

test('una respuesta externa perdida queda indeterminada y el reintento conserva la misma clave', async () => {
  let idempotencyKey;
  let attempts = 0;
  const orderClient = {
    getOrder: async () => ({
      id: 'ORD-TEST', external_reference: 'OV-20261030000001', currency: 'ARS', status: 'processed', status_detail: 'accredited',
      total_amount: '100.00', total_paid_amount: '100.00',
      transactions: { payments: [{ id: 'PAY-TEST', status: 'processed', status_detail: 'accredited', paid_amount: '100.00', refunds: [] }] }
    }),
    refundOrder: async (_orderId, key) => {
      idempotencyKey = idempotencyKey || key;
      assert.equal(key, idempotencyKey);
      attempts += 1;
      if (attempts === 1) throw Object.assign(new Error('timeout'), { name: 'AbortError' });
      return { id: 'ORD-TEST', status: 'processed', transactions: { refunds: [{ id: 'REF-RETRY', transaction_id: 'PAY-TEST', amount: '20.00', status: 'processed' }] } };
    }
  };
  const context = setup({ method: 'MERCADO_PAGO', orderClient, env: { MP_ENVIRONMENT: 'test', MP_REFUND_OPERATIONS_ENABLED: true, MP_ORDER_FLOW_READY: true, MP_WEBHOOKS_READY: true } });
  const { reintegro } = await context.service.requestRefund(request({ importe: '20.00' }));
  await assert.rejects(context.service.submitMarketplaceRefund(String(reintegro._id)), { statusCode: 503 });
  assert.equal(context.data.refunds[0].estado, 'INDETERMINADO');
  await context.service.submitMarketplaceRefund(String(reintegro._id));
  assert.equal(attempts, 2);
  assert.equal(context.data.refunds[0].proveedorReintegroId, 'REF-RETRY');
  assert.equal(context.data.refunds[0].estado, 'EN_REVISION');
});

test('no permite dos envíos concurrentes desde una misma solicitud', async () => {
  let unblock;
  const wait = new Promise((resolve) => { unblock = resolve; });
  let sent = 0;
  const orderClient = {
    getOrder: async () => ({
      id: 'ORD-TEST', external_reference: 'OV-20261030000001', currency: 'ARS', status: 'processed', status_detail: 'accredited',
      total_amount: '100.00', total_paid_amount: '100.00',
      transactions: { payments: [{ id: 'PAY-TEST', status: 'processed', status_detail: 'accredited', paid_amount: '100.00' }] }
    }),
    refundOrder: async () => { sent += 1; await wait; return { id: 'ORD-TEST', status: 'processed', transactions: { refunds: [] } }; }
  };
  const context = setup({ method: 'MERCADO_PAGO', orderClient, env: { MP_ENVIRONMENT: 'test', MP_REFUND_OPERATIONS_ENABLED: true, MP_ORDER_FLOW_READY: true, MP_WEBHOOKS_READY: true } });
  const { reintegro } = await context.service.requestRefund(request({ importe: '20.00' }));
  const first = context.service.submitMarketplaceRefund(String(reintegro._id));
  await new Promise((resolve) => setImmediate(resolve));
  await assert.rejects(context.service.submitMarketplaceRefund(String(reintegro._id)), { statusCode: 409 });
  unblock();
  await first;
  assert.equal(sent, 1);
});

test('confirma MP únicamente con respuesta oficial conciliable y mantiene control administrativo', async () => {
  const orderClient = { getOrder: async () => ({
    id: 'ORD-TEST', external_reference: 'OV-20261030000001', currency: 'ARS',
    transactions: { payments: [{ id: 'PAY-TEST' }], refunds: [{ id: 'REF-OK', transaction_id: 'PAY-TEST', amount: '100.00', status: 'processed' }] }
  }) };
  const context = setup({ method: 'MERCADO_PAGO', orderClient, env: { MP_ENVIRONMENT: 'test', MP_REFUND_OPERATIONS_ENABLED: true } });
  const { reintegro } = await context.service.requestRefund(request());
  Object.assign(context.data.refunds[0], { estado: 'EN_REVISION', proveedorReintegroId: 'REF-OK' });
  const result = await context.service.confirmMarketplaceRefund({ reintegroId: String(reintegro._id), adminId: String(ADMIN), idOperacion: 'confirm-mp-001' });
  assert.equal(result.confirmado, true);
  assert.equal(context.data.refunds[0].estado, 'COMPLETADO');
  assert.equal(context.data.order.estadoPago, 'REEMBOLSADO');
});

test('falla cerrado cuando falta el índice único de idempotencia', async () => {
  const context = setup();
  context.models.Reintegro.collection.indexes = async () => [];
  await assert.rejects(context.service.requestRefund(request()), { statusCode: 503 });
});
