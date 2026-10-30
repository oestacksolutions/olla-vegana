const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  buildOrderPayload, buildReturnUrls, safeReturnBase, stableIdempotencyKey,
  createMercadoPagoOrdersClient, createMercadoPagoPaymentService
} = require('../src/services/mercadoPagoOrders');

const order = {
  _id: '64b000000000000000000010', numero: 20261030001234, idOperacion: 'checkout-operation-01',
  metodoPago: 'MERCADO_PAGO', estadoPago: 'PENDIENTE', correo: 'ana@example.test', total: '1250.50'
};
const items = [
  { nombreProducto: 'Remera', detalleVariante: 'Talle: L', cantidad: 2, precio: '500.25', subtotal: '1000.50' },
  { nombreProducto: 'Tote', detalleVariante: null, cantidad: 1, precio: '250', subtotal: '250.00' }
];

test('payload Orders API usa snapshots persistidos, suma exacta, referencia y URLs oficiales', () => {
  const payload = buildOrderPayload({ pedido: order, items }, 'https://shop.example.org');
  assert.equal(payload.type, 'online');
  assert.equal(payload.processing_mode, 'manual');
  assert.equal(payload.total_amount, '1250.50');
  assert.equal(payload.external_reference, `OV-${order.numero}`);
  assert.deepEqual(payload.items, [
    { title: 'Remera · Talle: L', unit_price: '500.25', quantity: 2 },
    { title: 'Tote', unit_price: '250.00', quantity: 1 }
  ]);
  assert.equal(payload.payer.email, order.correo);
  assert.deepEqual(payload.config.online, {
    success_url: 'https://shop.example.org/checkout/exito',
    pending_url: 'https://shop.example.org/checkout/pendiente',
    failure_url: 'https://shop.example.org/checkout/error',
    auto_return: 'approved'
  });
});

test('payload rechaza diferencias entre totales, subtotales y precio/cantidad', () => {
  assert.throws(() => buildOrderPayload({ pedido: { ...order, total: '1250.51' }, items }, 'https://shop.example.org'), /no coincide/);
  assert.throws(() => buildOrderPayload({ pedido: order, items: [{ ...items[0], subtotal: '900' }] }, 'https://shop.example.org'), /snapshot/);
});

test('URLs frontend requieren origen seguro y construyen solo rutas fijas', () => {
  assert.equal(safeReturnBase('http://localhost:5173', { allowLocalhost: true }), 'http://localhost:5173');
  assert.throws(() => safeReturnBase('http://example.org'), /HTTPS/);
  assert.throws(() => safeReturnBase('https://example.org/path?redirect=https://evil.test'), /query/);
  assert.deepEqual(Object.values(buildReturnUrls('https://example.org')), [
    'https://example.org/checkout/exito', 'https://example.org/checkout/pendiente',
    'https://example.org/checkout/error', 'approved'
  ]);
});

test('la clave externa es estable para el mismo pedido e idempotency operation', () => {
  assert.equal(stableIdempotencyKey(order), stableIdempotencyKey(order));
  assert.notEqual(stableIdempotencyKey(order), stableIdempotencyKey({ ...order, idOperacion: 'other' }));
});

test('cliente Orders API envía Bearer, X-Idempotency-Key y no acepta checkout URL externa', async () => {
  let request;
  const client = createMercadoPagoOrdersClient({
    accessToken: 'TEST-secret-mock',
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, json: async () => ({ id: 'mp-order-1', checkout_url: 'https://www.mercadopago.com.ar/checkout/v1/redirect?token=x' }) };
    }
  });
  const result = await client.createOrder({ total_amount: '1.00' }, 'stable-key');
  assert.equal(request.url, 'https://api.mercadopago.com/v1/orders');
  assert.equal(request.options.headers.Authorization, 'Bearer TEST-secret-mock');
  assert.equal(request.options.headers['X-Idempotency-Key'], 'stable-key');
  assert.equal(JSON.parse(request.options.body).total_amount, '1.00');
  assert.equal(result.id, 'mp-order-1');
  assert.throws(() => require('../src/services/mercadoPagoOrders').parseProviderCheckoutUrl('https://checkout.evil.test/pay'), /no confiable/);
});

test('cliente oculta errores del proveedor y detecta respuestas incompletas', async () => {
  const failed = createMercadoPagoOrdersClient({ accessToken: 'mock', fetchImpl: async () => ({ ok: false, status: 500, json: async () => ({ message: 'private upstream detail' }) }) });
  await assert.rejects(failed.createOrder({}, 'key'), (error) => error.message === 'Mercado Pago no pudo crear la operación' && !error.message.includes('private'));
  const invalid = createMercadoPagoOrdersClient({ accessToken: 'mock', fetchImpl: async () => ({ ok: true, json: async () => ({ id: 'missing-url' }) }) });
  await assert.rejects(invalid.createOrder({}, 'key'), /respuesta incompleta/);
});

test('timeouts quedan como errores recuperables y no exponen el token', async () => {
  const client = createMercadoPagoOrdersClient({ accessToken: 'mock-secret', timeoutMs: 1, fetchImpl: (_url, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')))) });
  await assert.rejects(client.createOrder({}, 'key'), (error) => !error.message.includes('mock-secret'));
});

test('la compuerta permanece cerrada si falta cualquier confirmación de preparación', async () => {
  let reads = 0;
  const service = createMercadoPagoPaymentService({
    Pedido: { findById() { reads += 1; } }, ItemPedido: {}, IntentoPago: {}
  }, { env: { MP_ENVIRONMENT: 'test', MP_ORDER_CREATION_ENABLED: true, MP_ORDER_FLOW_READY: true, MP_WEBHOOKS_READY: false, MP_ACCESS_TOKEN: 'mock', FRONTEND_PUBLIC_URL: 'https://example.test' }, client: {} });
  assert.equal(service.enabled, false);
  await assert.rejects(service.createCheckoutForPersistedOrder(order._id), (error) => error.statusCode === 503);
  assert.equal(reads, 0);
});

function paymentFixture(client) {
  const attempts = [];
  const indexes = [{ name: 'uniq_intento_pago_idempotencia', unique: true, key: { proveedor: 1, claveIdempotencia: 1 } }];
  const query = (value) => ({ lean: async () => value, sort: () => ({ lean: async () => value }) });
  const models = {
    Pedido: { findById: () => query(order) },
    ItemPedido: { find: () => query(items) },
    IntentoPago: {
      collection: { indexes: async () => indexes },
      findOne: (filter) => query(attempts.find((item) => item.proveedor === filter.proveedor && item.claveIdempotencia === filter.claveIdempotencia) || null),
      create: async ([data]) => {
        const attempt = { ...data, _id: `attempt-${attempts.length + 1}`, toObject() { return { ...this }; } };
        attempts.push(attempt);
        return [attempt];
      },
      updateOne: async (filter, update) => {
        const attempt = attempts.find((item) => item._id === filter._id);
        if (attempt) Object.assign(attempt, update.$set);
        return { modifiedCount: attempt ? 1 : 0 };
      }
    }
  };
  const env = { MP_ENVIRONMENT: 'test', MP_ORDER_CREATION_ENABLED: true, MP_ORDER_FLOW_READY: true, MP_WEBHOOKS_READY: true, MP_ACCESS_TOKEN: 'mock-token', FRONTEND_PUBLIC_URL: 'https://shop.example.org' };
  return { attempts, service: createMercadoPagoPaymentService(models, { env, client }) };
}

test('persiste el ID externo y el checkout; reintentos posteriores reutilizan el intento creado', async () => {
  let calls = 0;
  const { attempts, service } = paymentFixture({ createOrder: async (payload, key) => {
    calls += 1;
    assert.equal(payload.external_reference, `OV-${order.numero}`);
    assert.equal(key, attempts[0].claveIdempotencia);
    return { id: 'mp-order-persisted', checkoutUrl: 'https://www.mercadopago.com.ar/checkout/redirect' };
  } });
  const first = await service.createCheckoutForPersistedOrder(order._id);
  const second = await service.createCheckoutForPersistedOrder(order._id);
  assert.equal(first.orderId, 'mp-order-persisted');
  assert.equal(second.checkoutUrl, first.checkoutUrl);
  assert.equal(second.repetido, true);
  assert.equal(attempts[0].estadoCreacion, 'CREADO');
  assert.equal(attempts[0].orderExternaId, 'mp-order-persisted');
  assert.equal(calls, 1);
});

test('una respuesta perdida deja estado indeterminado y reintenta con misma clave y cuerpo', async () => {
  let calls = 0;
  const seen = [];
  const { attempts, service } = paymentFixture({ createOrder: async (payload, key) => {
    calls += 1;
    seen.push({ payload, key });
    if (calls === 1) throw new Error('timeout');
    return { id: 'recovered-order', checkoutUrl: 'https://www.mercadopago.com.ar/checkout/redirect' };
  } });
  await assert.rejects(service.createCheckoutForPersistedOrder(order._id), /timeout/);
  assert.equal(attempts[0].estadoCreacion, 'INDETERMINADO');
  const recovered = await service.createCheckoutForPersistedOrder(order._id);
  assert.equal(recovered.orderId, 'recovered-order');
  assert.equal(seen[0].key, seen[1].key);
  assert.deepEqual(seen[0].payload, seen[1].payload);
});

test('servicio se detiene si falta el índice único real antes de escribir', async () => {
  const { service } = paymentFixture({ createOrder: async () => assert.fail('no debe llamar al proveedor') });
  // El servicio verifica el catálogo de índices antes de leer o crear el intento.
  const missingIndexService = createMercadoPagoPaymentService({
    Pedido: { findById: () => ({ lean: async () => order }) },
    ItemPedido: { find: () => ({ sort: () => ({ lean: async () => items }) }) },
    IntentoPago: { collection: { indexes: async () => [] } }
  }, { env: { MP_ENVIRONMENT: 'test', MP_ORDER_CREATION_ENABLED: true, MP_ORDER_FLOW_READY: true, MP_WEBHOOKS_READY: true, MP_ACCESS_TOKEN: 'mock', FRONTEND_PUBLIC_URL: 'https://shop.example.org' }, client: { createOrder: async () => assert.fail('no debe llamar al proveedor') } });
  assert.equal(service.enabled, true);
  await assert.rejects(missingIndexService.createCheckoutForPersistedOrder(order._id), /índice único/);
});

test('endpoint público de pedidos sigue fuera de app y el router de órdenes mantiene 503', () => {
  const appSource = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');
  const routeSource = fs.readFileSync(path.join(__dirname, '../src/routes/orderRoutes.js'), 'utf8');
  assert.doesNotMatch(appSource, /app\.use\(['"]\/api\/orders/);
  assert.match(routeSource, /router\.post\('\/',\s*\(_req, res\) => res\.status\(503\)/);
});
