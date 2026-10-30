const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  validateWebhookSignature
} = require('../src/services/mercadoPagoWebhookSecurity');
const { createMercadoPagoOrderClient } = require('../src/services/mercadoPagoOrderClient');
const { createMercadoPagoWebhookService, classifyOrder } = require('../src/services/mercadoPagoWebhookService');
const { createPaymentAuthorization } = require('../src/services/paymentAuthorization');

const secret = 'mock-webhook-secret-never-real';
const orderId = 'ORD01JYH1Z1YJN4HZ8J3Q0RB3YP6D';
const requestId = '2066ca19-c6f1-498a-be75-1923005edd06';

function signedRequest(overrides = {}) {
  const now = Date.now();
  const timestamp = String(now);
  const manifest = `id:${orderId};request-id:${requestId};ts:${timestamp};`;
  const signature = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  return {
    headers: { 'x-signature': `ts=${timestamp},v1=${signature}`, 'x-request-id': requestId },
    query: { 'data.id': orderId, type: 'order' },
    body: { type: 'order', application_id: 'test-app', user_id: 'test-seller', live_mode: false, data: { id: orderId }, ...overrides }
  };
}

function approvedOrder() {
  return {
    id: orderId,
    type: 'online',
    processing_mode: 'manual',
    status: 'processed',
    status_detail: 'accredited',
    external_reference: 'OV-20261030001234',
    total_amount: '45000.00',
    total_paid_amount: '45000.00',
    currency: 'ARS',
    last_updated_date: '2026-10-30T12:00:00.000Z',
    user_id: 'test-seller',
    integration_data: { application_id: 'test-app' },
    transactions: { payments: [{ id: 'PAY01JYH1Z1YJN4HZ8J3Q0RB3YP6D', amount: '45000.00', paid_amount: '45000.00', status: 'processed', status_detail: 'accredited', currency_id: 'ARS' }] }
  };
}

function query(value) {
  const q = {
    session() { return q; },
    lean() { return q; },
    exec: async () => value
  };
  return q;
}

function fixture({ enabled = true, providerOrder = approvedOrder(), reservasDisponibles = true, failConfirmationOnce = false, conflictingAttempts = [] } = {}) {
  const pedido = { _id: 'pedido-id', numero: 20261030001234, total: '45000.00', metodoPago: 'MERCADO_PAGO', estadoPago: 'PENDIENTE', estado: 'NUEVO' };
  const intento = { _id: 'intento-id', pedidoId: pedido._id, proveedor: 'MERCADO_PAGO', orderExternaId: orderId, estadoProveedor: null };
  const eventos = [];
  const indexEvents = [{ name: 'uniq_evento_pago_idempotencia', unique: true, key: { idempotencia: 1 }, partialFilterExpression: { idempotencia: { $type: 'string' } } }];
  const indexAttempts = [
    { name: 'uniq_intento_pago_order_externa', unique: true, key: { orderExternaId: 1 }, partialFilterExpression: { orderExternaId: { $type: 'string' } } },
    { name: 'uniq_intento_pago_idempotencia', unique: true, key: { proveedor: 1, claveIdempotencia: 1 } }
  ];
  let nextId = 0;
  let attemptExists = true;
  let transactionQueue = Promise.resolve();
  const startSession = async () => ({
    async withTransaction(operation) {
      const previous = transactionQueue;
      let release;
      transactionQueue = new Promise((resolve) => { release = resolve; });
      await previous;
      const pedidoBefore = { ...pedido };
      const intentoBefore = { ...intento };
      const eventosBefore = eventos.map((event) => ({ ...event }));
      try { await operation(); } catch (error) {
        Object.assign(pedido, pedidoBefore);
        Object.assign(intento, intentoBefore);
        eventos.splice(0, eventos.length, ...eventosBefore);
        throw error;
      } finally { release(); }
    },
    async endSession() {}
  });
  const models = {
    Pedido: {
      findById: () => query(pedido),
      updateOne: async (_filter, update) => { Object.assign(pedido, update.$set); return { modifiedCount: 1 }; },
      collection: { indexes: async () => [{ key: { numero: 1 }, unique: true }, { key: { idOperacion: 1 }, unique: true, partialFilterExpression: { idOperacion: { $type: 'string' } } }] }
    },
    IntentoPago: {
      findOne: () => query(attemptExists ? intento : null),
      find: () => query([intento, ...conflictingAttempts]),
      findById: () => query(intento),
      updateOne: async (_filter, update) => { Object.assign(intento, update.$set); return { modifiedCount: 1 }; },
      collection: { indexes: async () => indexAttempts }
    },
    EventoPago: {
      collection: { indexes: async () => indexEvents },
      create: async ([doc]) => {
        const duplicate = eventos.find((event) => event.idempotencia === doc.idempotencia);
        if (duplicate) { const error = new Error('duplicate'); error.code = 11000; throw error; }
        const event = { ...doc, _id: `event-${++nextId}`, toObject() { return { ...this }; } };
        eventos.push(event);
        return [event];
      },
      findOne: (filter) => query(eventos.find((event) => event.idempotencia === filter.idempotencia) || null),
      findById: (id) => query(eventos.find((event) => event._id === id) || null),
      updateOne: async (filter, update) => {
        const event = eventos.find((item) => item._id === filter._id && (!filter.estadoProcesamiento || item.estadoProcesamiento === filter.estadoProcesamiento));
        if (!event) return { modifiedCount: 0 };
        Object.assign(event, update.$set);
        return { modifiedCount: 1 };
      }
    }
  };
  let confirmations = 0;
  let rejections = 0;
  const stockReservationService = {
    async confirmPayment(_id, proof, { session }) {
      assert.ok(session);
      assert.equal(proof.provider, 'MERCADO_PAGO');
      if (!reservasDisponibles) { const error = new Error('reservation unavailable'); error.statusCode = 409; throw error; }
      if (failConfirmationOnce) { failConfirmationOnce = false; throw new Error('temporary transaction failure'); }
      confirmations += 1;
      pedido.estadoPago = 'APROBADO';
    },
    async rejectVerifiedMarketplacePayment(_id, proof, { session }) {
      assert.ok(session);
      assert.equal(proof.provider, 'MERCADO_PAGO');
      rejections += 1;
      pedido.estadoPago = 'RECHAZADO';
      pedido.estado = 'CANCELADO';
    }
  };
  const paymentAuthorization = createPaymentAuthorization();
  const env = {
    MP_ENVIRONMENT: 'test', MP_ORDER_CREATION_ENABLED: enabled, MP_ORDER_FLOW_READY: enabled,
    MP_WEBHOOKS_READY: enabled, MP_WEBHOOK_EFFECTS_ENABLED: enabled,
    MP_ACCESS_TOKEN: 'mock-token', MP_WEBHOOK_SECRET: secret, MP_APPLICATION_ID: 'test-app', MP_USER_ID: 'test-seller'
  };
  const orderClient = { getOrder: async () => providerOrder };
  const service = createMercadoPagoWebhookService(models, { env, orderClient, stockReservationService, paymentAuthorization, startSession });
  return { service, pedido, intento, eventos, env, orderClient, setAttemptReady() { attemptExists = true; }, setAttemptMissing() { attemptExists = false; }, get confirmations() { return confirmations; }, get rejections() { return rejections; } };
}

test('valida firma HMAC oficial, tolerancia temporal e identificadores', () => {
  const request = signedRequest();
  assert.equal(validateWebhookSignature({ signature: request.headers['x-signature'], requestId, dataId: orderId, secret }), true);
  assert.equal(validateWebhookSignature({ signature: request.headers['x-signature'], requestId, dataId: `${orderId}x`, secret }), false);
  assert.equal(validateWebhookSignature({ signature: request.headers['x-signature'], requestId: 'wrong', dataId: orderId, secret }), false);
  assert.equal(validateWebhookSignature({ signature: request.headers['x-signature'], requestId, dataId: orderId, secret, now: () => Date.now() + 600_000 }), false);
  assert.equal(validateWebhookSignature({ signature: request.headers['x-signature'], requestId, dataId: orderId, secret: '' }), false);
});

test('clasifica acreditado solo con orden, total pagado, moneda y pagos completos coincidentes', () => {
  assert.equal(classifyOrder(approvedOrder(), 4_500_000n).state, 'APPROVED');
  const pending = approvedOrder(); pending.status = 'processing'; pending.status_detail = 'in_process'; pending.total_paid_amount = '0'; pending.transactions.payments = [];
  assert.equal(classifyOrder(pending, 4_500_000n).state, 'PENDING');
  const wrongCurrency = approvedOrder(); wrongCurrency.currency = 'USD';
  assert.equal(classifyOrder(wrongCurrency, 4_500_000n).state, 'REVIEW');
  const mismatch = approvedOrder(); mismatch.transactions.payments[0].paid_amount = '10.00';
  assert.equal(classifyOrder(mismatch, 4_500_000n).state, 'UNSUPPORTED');
});

test('cliente consulta únicamente la ruta fija de Orders API con Bearer y reintenta 5xx', async () => {
  let calls = 0;
  let request;
  const client = createMercadoPagoOrderClient({ accessToken: 'mock-token', wait: async () => {}, fetchImpl: async (url, options) => {
    calls += 1; request = { url, options };
    return calls === 1 ? { ok: false, status: 500, json: async () => ({ internal: 'must not leak' }) }
      : { ok: true, json: async () => approvedOrder() };
  } });
  const order = await client.getOrder(orderId);
  assert.equal(order.id, orderId);
  assert.equal(calls, 2);
  assert.equal(request.url, `https://api.mercadopago.com/v1/orders/${orderId}`);
  assert.equal(request.options.headers.Authorization, 'Bearer mock-token');
});

test('webhook aprobado consulta fuente oficial, confirma una sola vez y deduplica reintentos/concurrencia', async () => {
  const f = fixture();
  const req = signedRequest();
  const results = await Promise.all([f.service.handle(req), f.service.handle(req)]);
  assert.equal(results.length, 2);
  assert.equal(f.confirmations, 1);
  assert.equal(f.pedido.estadoPago, 'APROBADO');
  assert.equal(f.intento.pagoExternoId, 'PAY01JYH1Z1YJN4HZ8J3Q0RB3YP6D');
  assert.equal(f.eventos.length, 1);
  assert.equal(f.eventos[0].estadoProcesamiento, 'PROCESADO');
});

test('firma inválida no consulta proveedor ni produce escrituras', async () => {
  const f = fixture();
  let calls = 0;
  f.orderClient.getOrder = async () => { calls += 1; return approvedOrder(); };
  const req = signedRequest(); req.headers['x-signature'] = `ts=${Date.now()},v1=${'0'.repeat(64)}`;
  await assert.rejects(f.service.handle(req), (error) => error.statusCode === 401);
  assert.equal(calls, 0);
  assert.equal(f.eventos.length, 0);
});

test('si el webhook llega antes de persistir el intento, conserva evento recibido y admite reintento', async () => {
  const f = fixture();
  f.setAttemptMissing();
  await assert.rejects(f.service.handle(signedRequest()), (error) => error.statusCode === 503);
  assert.equal(f.eventos.length, 1);
  assert.equal(f.eventos[0].estadoProcesamiento, 'RECIBIDO');
  f.setAttemptReady();
  const retry = await f.service.handle(signedRequest());
  assert.equal(retry.estado, 'APPROVED');
  assert.equal(f.confirmations, 1);
});

test('efectos cerrados por configuración no consultan al proveedor ni persisten eventos', async () => {
  const f = fixture({ enabled: false });
  let calls = 0;
  f.orderClient.getOrder = async () => { calls += 1; return approvedOrder(); };
  await assert.rejects(f.service.handle(signedRequest()), (error) => error.statusCode === 503);
  assert.equal(calls, 0);
  assert.equal(f.eventos.length, 0);
});

test('notificación de otra cuenta vendedora no consulta ni modifica pedidos', async () => {
  const f = fixture();
  let providerCalls = 0;
  f.orderClient.getOrder = async () => { providerCalls += 1; return approvedOrder(); };
  const request = signedRequest({ user_id: 'otro-vendedor' });
  await assert.rejects(f.service.handle(request), (error) => error.statusCode === 401);
  assert.equal(providerCalls, 0);
  assert.equal(f.eventos.length, 0);
  assert.equal(f.pedido.estadoPago, 'PENDIENTE');
});

test('acreditación oficial con reserva vencida conserva estado financiero y requiere conciliación sin mover stock', async () => {
  const f = fixture({ reservasDisponibles: false });
  const result = await f.service.handle(signedRequest());
  assert.equal(result.requiereRevision, true);
  assert.equal(f.pedido.estadoPago, 'APROBADO');
  assert.match(f.pedido.notaPago, /conciliación administrativa/);
  assert.equal(f.eventos[0].estadoProcesamiento, 'REVISION');
  assert.equal(f.intento.incidencia, 'ACREDITACION_SIN_RESERVA');
  assert.equal(f.confirmations, 0);
});

test('monto o referencia discordante queda en revisión y nunca confirma stock', async () => {
  const order = approvedOrder();
  order.external_reference = 'OV-otro-pedido';
  const f = fixture({ providerOrder: order });
  const result = await f.service.handle(signedRequest());
  assert.equal(result.requiereRevision, true);
  assert.equal(f.confirmations, 0);
  assert.equal(f.pedido.estadoPago, 'PENDIENTE');
  assert.equal(f.eventos[0].estadoProcesamiento, 'REVISION');
});

test('dos intentos externos distintos para el mismo pedido se bloquean para conciliación', async () => {
  const conflicting = { _id: 'otro-intento', pedidoId: 'pedido-id', orderExternaId: 'ORD01OTROINTENTO1234567890' };
  const f = fixture({ conflictingAttempts: [conflicting] });
  const result = await f.service.handle(signedRequest());
  assert.equal(result.requiereRevision, true);
  assert.equal(f.confirmations, 0);
  assert.equal(f.pedido.estadoPago, 'PENDIENTE');
  assert.equal(f.intento.incidencia, 'INTENTOS_MP_CONFLICTIVOS');
});

test('fallo del proveedor responde de forma recuperable y deja el evento sin marcar', async () => {
  const f = fixture();
  f.orderClient.getOrder = async () => { throw new Error('sanitized upstream failure'); };
  await assert.rejects(f.service.handle(signedRequest()), /sanitized upstream failure/);
  assert.equal(f.eventos.length, 0);
  assert.equal(f.pedido.estadoPago, 'PENDIENTE');
});

test('fallo transaccional conserva evento recibido y el reintento lo procesa', async () => {
  const f = fixture({ failConfirmationOnce: true });
  await assert.rejects(f.service.handle(signedRequest()), /temporary transaction failure/);
  assert.equal(f.eventos.length, 1);
  assert.equal(f.eventos[0].estadoProcesamiento, 'RECIBIDO');
  assert.equal(f.pedido.estadoPago, 'PENDIENTE');
  const retry = await f.service.handle(signedRequest());
  assert.equal(retry.estado, 'APPROVED');
  assert.equal(f.eventos[0].estadoProcesamiento, 'PROCESADO');
  assert.equal(f.confirmations, 1);
});

test('un pago pendiente no confirma ni libera reservas', async () => {
  const order = approvedOrder();
  order.status = 'processing';
  order.status_detail = 'in_process';
  order.total_paid_amount = '0.00';
  order.transactions.payments = [];
  const f = fixture({ providerOrder: order });
  const result = await f.service.handle(signedRequest());
  assert.equal(result.estado, 'PENDING');
  assert.equal(f.confirmations, 0);
  assert.equal(f.rejections, 0);
  assert.equal(f.pedido.estadoPago, 'PENDIENTE');
});

test('un estado antiguo no puede retroceder el último estado oficial guardado', async () => {
  const order = approvedOrder();
  order.status = 'processing';
  order.status_detail = 'in_process';
  order.total_paid_amount = '0.00';
  order.last_updated_date = '2026-10-29T12:00:00.000Z';
  order.transactions.payments = [];
  const f = fixture({ providerOrder: order });
  f.intento.estadoProveedor = 'processed';
  f.intento.detalleEstadoProveedor = 'accredited';
  f.intento.ultimaActualizacionProveedor = new Date('2026-10-30T12:00:00.000Z');
  const result = await f.service.handle(signedRequest());
  assert.equal(result.obsoleto, true);
  assert.equal(f.intento.estadoProveedor, 'processed');
  assert.equal(f.pedido.estadoPago, 'PENDIENTE');
  assert.equal(f.confirmations, 0);
  assert.equal(f.eventos[0].estadoProcesamiento, 'NO_APLICA');
});

test('un rechazo oficial libera mediante el servicio autorizado y no afecta transferencias', async () => {
  const order = approvedOrder();
  order.status = 'failed';
  order.status_detail = 'rejected';
  order.total_paid_amount = '0.00';
  order.transactions.payments = [{ id: 'PAY01JYH1Z1YJN4HZ8J3Q0RB3YP6D', paid_amount: '0.00', status: 'failed', status_detail: 'rejected', currency_id: 'ARS' }];
  const f = fixture({ providerOrder: order });
  const result = await f.service.handle(signedRequest());
  assert.equal(result.estado, 'REJECTED');
  assert.equal(f.rejections, 1);
  assert.equal(f.confirmations, 0);
  assert.equal(f.pedido.estadoPago, 'RECHAZADO');
});

test('app monta receptor seguro y no monta creación pública de pedidos', () => {
  const app = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/webhookRoutes.js'), 'utf8');
  assert.match(app, /app\.use\(['"]\/api\/webhooks['"]/);
  assert.match(route, /router\.post\(['"]\/mercadopago['"]/);
  assert.doesNotMatch(app, /createOrderRoutes/);
  assert.match(app, /createOrderAccessRoutes/);
});
