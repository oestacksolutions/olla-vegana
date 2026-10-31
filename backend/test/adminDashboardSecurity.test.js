const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('endpoint administrativo de resumen está montado detrás de autenticación y autorización', () => {
  const app = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');
  assert.match(app, /'\/api\/admin\/dashboard',[\s\S]*?authenticate,[\s\S]*?authorizeAdmin,[\s\S]*?createAdminDashboardRoutes/);
  const routes = fs.readFileSync(path.join(__dirname, '../src/routes/adminDashboardRoutes.js'), 'utf8');
  assert.match(routes, /router\.get\('\/summary'/);
  assert.doesNotMatch(routes, /router\.(post|patch|put|delete)\(/);
});

test('variantes, atributos e inventario solo se montan con autenticación y autorización', () => {
  const app = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');
  assert.match(app, /app\.use\(\s*'\/api\/admin',\s*authenticate,\s*authorizeAdmin,\s*validateJsonBody,\s*createAdminAttributeRoutes/s);
  assert.match(app, /app\.use\(\s*'\/api\/admin\/products\/:productId\/variants',\s*authenticate,\s*authorizeAdmin,\s*validateJsonBody,\s*createAdminVariantRoutes/s);
  assert.match(app, /app\.use\(\s*'\/api\/admin\/stock',\s*authenticate,\s*authorizeAdmin,/s);
});

test('consulta y cambios administrativos de pedidos están protegidos y las escrituras tienen compuertas seguras', () => {
  const app = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');
  assert.match(app, /app\.use\('\/api\/admin\/orders',\s*authenticate,\s*authorizeAdmin,\s*validateJsonBody,\s*createAdminOrderRoutes/);
  assert.match(app, /createAdminTransferRoutes\(createAdminTransferController\(transferPaymentService\),\s*\{\s*enabled:\s*env\.ADMIN_TRANSFER_CONFIRMATION_ENABLED/s);
  const env = fs.readFileSync(path.join(__dirname, '../src/config/env.js'), 'utf8');
  assert.match(env, /ADMIN_ORDER_STATUS_CHANGES_ENABLED: process\.env\.ADMIN_ORDER_STATUS_CHANGES_ENABLED === 'true'/);
  assert.match(env, /ADMIN_TRANSFER_CONFIRMATION_ENABLED: process\.env\.ADMIN_TRANSFER_CONFIRMATION_ENABLED === 'true'/);
});
