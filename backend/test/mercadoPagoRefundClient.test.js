const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createMercadoPagoOrderClient } = require('../src/services/mercadoPagoOrderClient');

const ORDER = 'ORD01J49MMW3SSBK5PSV3DFR32959';

function fetchFixture(response) {
  const calls = [];
  const fetchImpl = async (...args) => {
    calls.push(args);
    return { ok: true, status: 200, json: async () => response };
  };
  return { calls, fetchImpl };
}

test('usa Orders API para cancelar una order no pagada con clave idempotente y sin body', async () => {
  const fixture = fetchFixture({ id: ORDER, status: 'canceled' });
  const client = createMercadoPagoOrderClient({ accessToken: 'test-only-token', fetchImpl: fixture.fetchImpl });
  await client.cancelOrder(ORDER, 'cancel-key-0001');
  const [url, options] = fixture.calls[0];
  assert.equal(url, `https://api.mercadopago.com/v1/orders/${ORDER}/cancel`);
  assert.equal(options.method, 'POST');
  assert.equal(options.headers['X-Idempotency-Key'], 'cancel-key-0001');
  assert.equal(Object.hasOwn(options, 'body'), false);
});

test('usa amount transaccional para reintegro parcial y body vacío para total', async () => {
  const partial = fetchFixture({ id: ORDER, status: 'processed', status_detail: 'partially_refunded' });
  const client = createMercadoPagoOrderClient({ accessToken: 'test-only-token', fetchImpl: partial.fetchImpl });
  await client.refundOrder(ORDER, 'refund-key-0001', { paymentId: 'PAY01HRYFWNYRE1MR1E60MW3X0T2P', importe: '25.50' });
  assert.deepEqual(JSON.parse(partial.calls[0][1].body), { transactions: [{ id: 'PAY01HRYFWNYRE1MR1E60MW3X0T2P', amount: '25.50' }] });
  assert.equal(partial.calls[0][1].headers['X-Idempotency-Key'], 'refund-key-0001');

  const total = fetchFixture({ id: ORDER, status: 'refunded', status_detail: 'refunded' });
  await createMercadoPagoOrderClient({ accessToken: 'test-only-token', fetchImpl: total.fetchImpl }).refundOrder(ORDER, 'refund-key-0002');
  assert.equal(Object.hasOwn(total.calls[0][1], 'body'), false);
});

test('no acepta identificadores, claves ni respuestas externas malformadas', async () => {
  const client = createMercadoPagoOrderClient({ accessToken: 'test-only-token', fetchImpl: fetchFixture({ id: 'otro', status: 'refunded' }).fetchImpl });
  await assert.rejects(client.cancelOrder('bad', 'cancel-key-0003'), /identificador/);
  await assert.rejects(client.cancelOrder(ORDER, 'bad'), /idempotencia/);
  assert.throws(() => client.refundOrder(ORDER, 'refund-key-0003', { paymentId: 'PAY1' }), /ID de pago e importe/);
  await assert.rejects(client.cancelOrder(ORDER, 'cancel-key-0004'), /respuesta de operación incompleta/);
});

test('timeout y error HTTP quedan clasificados para conciliación sin exponer datos del proveedor', async () => {
  const timeoutClient = createMercadoPagoOrderClient({ accessToken: 'test-only-token', timeoutMs: 1, fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => { const error = new Error('aborted'); error.name = 'AbortError'; reject(error); })) });
  await assert.rejects(timeoutClient.refundOrder(ORDER, 'refund-key-0005'), (error) => error.transitorio === true);
  const errorClient = createMercadoPagoOrderClient({ accessToken: 'test-only-token', fetchImpl: async () => ({ ok: false, status: 500, json: async () => ({ secret: 'do-not-copy' }) }) });
  await assert.rejects(errorClient.refundOrder(ORDER, 'refund-key-0006'), (error) => error.providerStatus === 500 && !error.message.includes('secret'));
});
