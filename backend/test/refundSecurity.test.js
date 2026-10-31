const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const createAdminOrderOperationsRoutes = require('../src/routes/adminOrderOperationsRoutes');

const noop = (_req, _res, next) => next();
const permissions = {
  authenticate: noop,
  authorizeOrderCancellation: noop,
  authorizeRefundRequest: noop,
  authorizeRefundConfirmation: noop
};

test('el router financiero falla cerrado si no recibe middlewares administrativos reales', () => {
  const controller = { cancel() {}, cancelPaid() {}, requestRefund() {}, confirmTransferRefund() {} };
  assert.throws(() => createAdminOrderOperationsRoutes(controller), /permisos/);
  assert.throws(() => createAdminOrderOperationsRoutes(controller, { authenticate: noop }), /permisos explÃ­citos/);
  assert.doesNotThrow(() => createAdminOrderOperationsRoutes(controller, permissions));
});

test('ningún endpoint nuevo de cancelación o reintegro está montado públicamente en app.js', () => {
  const app = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');
  assert.doesNotMatch(app, /adminOrderOperationsRoutes|\/api\/admin\/refunds|\/cancel-paid/);
  assert.match(app, /authenticate,\s*authorizeAdmin/);
});

test('las rutas financieras validan claves permitidas y el middleware cubre toda la ruta', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/routes/adminOrderOperationsRoutes.js'), 'utf8');
  assert.match(source, /authorizeOrderCancellation/);
  assert.match(source, /authorizeRefundRequest/);
  assert.match(source, /authorizeRefundConfirmation/);
  assert.match(source, /router\.post\('\/:orderId\/refunds'/);
  assert.match(source, /validateKeys\(\['importe', 'motivo'\]\)/);
  assert.match(source, /confirm-transfer/);
});
