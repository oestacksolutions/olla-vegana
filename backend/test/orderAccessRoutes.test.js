const { test } = require('node:test');
const assert = require('node:assert/strict');
const createOrderAccessRoutes = require('../src/routes/orderAccessRoutes');
const createOrderAccessController = require('../src/controllers/orderAccessController');

test('la API de acceso de pedido es solo GET y usa el bearer opaco, no query params', async () => {
  const calls = [];
  const controller = createOrderAccessController({
    async getForBuyer(orderId, token) { calls.push({ orderId, token }); return { estado: 'PENDIENTE' }; }
  });
  const router = createOrderAccessRoutes(controller);
  const layer = router.stack.find((item) => item.route?.path === '/:orderId/transfer-instructions');
  assert.deepEqual({ ...layer.route.methods }, { get: true });

  const req = {
    params: { orderId: 'order-id' },
    query: { importe: '0.01', alias: 'manipulado' },
    get: () => `Bearer ${'a'.repeat(43)}`
  };
  let complete;
  const response = new Promise((resolve, reject) => { complete = { resolve, reject }; });
  const res = { json(body) { complete.resolve(body); return this; } };
  layer.route.stack[0].handle(req, res, (error) => { if (error) complete.reject(error); });
  res.body = await response;
  assert.deepEqual(calls, [{ orderId: 'order-id', token: 'a'.repeat(43) }]);
  assert.deepEqual(res.body, { estado: 'PENDIENTE' });
});

test('ignora encabezados bearer con tokens de formato inválido', async () => {
  let token = 'not-valid';
  const controller = createOrderAccessController({ async getForBuyer(_id, value) { token = value; return {}; } });
  await new Promise((resolve, reject) => {
    controller.getTransferInstructions(
      { params: { orderId: 'x' }, get: () => 'Bearer invalid' },
      { json() { resolve(); } },
      reject
    );
  });
  assert.equal(token, null);
});
