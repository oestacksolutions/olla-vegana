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
