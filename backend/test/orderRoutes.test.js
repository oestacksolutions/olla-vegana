const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const createOrderRoutes = require('../src/routes/orderRoutes');
const { DISABLED_MESSAGE } = createOrderRoutes;

test('ruta de creación permanece deshabilitada por defecto y no invoca persistencia', () => {
  let called = false;
  const router = createOrderRoutes({ createOrder() { called = true; } });
  const handler = router.stack.find((layer) => layer.route?.path === '/').route.stack[0].handle;
  const response = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  handler({}, response, () => assert.fail('No debe llamar next'));
  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.body, { error: DISABLED_MESSAGE });
  assert.equal(called, false);
});

test('app solo monta lectura de instrucciones con token y mantiene bloqueado POST público de pedidos', () => {
  const appSource = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');
  assert.doesNotMatch(appSource, /createOrderRoutes/);
  assert.match(appSource, /app\.use\('\/api\/orders', createOrderAccessRoutes/);
  assert.match(appSource, /POST \/api\/orders sigue sin montarse/);
});
