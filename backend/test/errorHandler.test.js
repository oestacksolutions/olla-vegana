const test = require('node:test');
const assert = require('node:assert/strict');
const errorHandler = require('../src/middlewares/errorHandler');

test('los errores internos se registran para diagnóstico sin exponer mensaje ni stack al cliente', () => {
  const error = new TypeError('private diagnostic sentinel');
  let logged;
  let response;
  const originalConsoleError = console.error;
  console.error = (entry) => { logged = entry; };
  try {
    response = {
      statusCode: null,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; }
    };
    errorHandler(error, { method: 'POST', path: '/api/auth/login' }, response, () => {});
  } finally { console.error = originalConsoleError; }

  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.body, { error: 'Error interno del servidor' });
  assert.equal(logged.tipo, 'TypeError');
  assert.ok(Array.isArray(logged.trazaInterna));
  assert.equal(JSON.stringify(logged).includes('private diagnostic sentinel'), false);
  assert.equal(JSON.stringify(response.body).includes('private diagnostic sentinel'), false);
});
