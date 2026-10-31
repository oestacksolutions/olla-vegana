const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { createAuthService, SESSION_TTL_SECONDS } = require('../src/services/authService');
const { createAuthMiddleware, verifyJwt } = require('../src/middlewares/auth');
const createAuthController = require('../src/controllers/authController');
const createAuthRoutes = require('../src/routes/authRoutes');

const SECRET = 'unit-test-secret-long-enough-for-hmac-validation';
const ADMIN_ID = '0123456789abcdef01234567';
const NOW = new Date('2026-10-30T12:00:00.000Z');

function buildService({ storedPassword, active = true } = {}) {
  const admin = {
    _id: ADMIN_ID,
    correo: 'admin@example.test',
    activo: active,
    updatedAt: NOW,
    contrasena: storedPassword
  };
  const Admin = { findOne: () => ({ select: async () => active ? admin : null }) };
  const env = { JWT_SECRET: SECRET };
  return { service: createAuthService({ Admin, env, now: () => NOW.getTime() }), Admin, admin, env };
}

test('login valida bcrypt y devuelve JWT firmado con vencimiento de ocho horas', async () => {
  const fixture = buildService({ storedPassword: await bcrypt.hash('correct-password', 4) });
  const result = await fixture.service.login(' ADMIN@example.test ', 'correct-password');

  assert.equal(result.admin.id, ADMIN_ID);
  assert.equal(result.admin.correo, 'admin@example.test');
  const claims = verifyJwt(result.token, SECRET, NOW.getTime());
  assert.equal(claims.sub, ADMIN_ID);
  assert.equal(claims.adminUpdatedAt, NOW.getTime());
  assert.equal(claims.exp - claims.iat, SESSION_TTL_SECONDS);
  assert.equal(typeof claims.jti, 'string');
  assert.equal(Object.hasOwn(result, 'csrfToken'), false);
});

test('credenciales incorrectas, inexistentes e inactivas no permiten iniciar sesión', async () => {
  const fixture = buildService({ storedPassword: await bcrypt.hash('correct-password', 4) });
  await assert.rejects(fixture.service.login('admin@example.test', 'wrong-password'), { statusCode: 401 });

  const missing = createAuthService({
    Admin: { findOne: () => ({ select: async () => null }) }, env: fixture.env
  });
  await assert.rejects(missing.login('missing@example.test', 'wrong-password'), {
    statusCode: 401,
    message: 'El correo o la contraseña no son correctos.'
  });

  const disabled = buildService({ storedPassword: await bcrypt.hash('correct-password', 4), active: false });
  await assert.rejects(disabled.service.login('admin@example.test', 'correct-password'), { statusCode: 401 });
});

test('la misma cuenta puede iniciar dos sesiones JWT independientes sin registros persistidos', async () => {
  const fixture = buildService({ storedPassword: await bcrypt.hash('correct-password', 4) });
  const first = await fixture.service.login('admin@example.test', 'correct-password');
  const second = await fixture.service.login('admin@example.test', 'correct-password');
  const firstClaims = verifyJwt(first.token, SECRET, NOW.getTime());
  const secondClaims = verifyJwt(second.token, SECRET, NOW.getTime());
  assert.notEqual(firstClaims.jti, secondClaims.jti);
  assert.equal(firstClaims.sub, secondClaims.sub);

  let lookupCount = 0;
  const Admin = { findOne: () => ({ select: async () => { lookupCount += 1; return { ...fixture.admin }; } }) };
  const middleware = createAuthMiddleware({ secret: SECRET, Admin, now: () => NOW.getTime() });
  for (const token of [first.token, second.token]) {
    const req = { headers: { authorization: `Bearer ${token}` }, get(name) { return this.headers[name.toLowerCase()]; } };
    let error;
    await middleware.authenticate(req, {}, (value) => { error = value; });
    assert.equal(error, undefined);
    await middleware.authorizeAdmin(req, {}, (value) => { error = value; });
    assert.equal(error, undefined);
  }
  assert.equal(lookupCount, 2);
});

test('logout del cliente no expone endpoint servidor y la autorización revalida cuenta/versión', async () => {
  const router = createAuthRoutes({ login() {}, requestPasswordReset() {}, resetPassword() {} });
  const paths = router.stack.filter(({ route }) => route).map(({ route }) => `${Object.keys(route.methods)[0].toUpperCase()} ${route.path}`);
  assert.deepEqual(paths, ['POST /login', 'POST /forgot-password', 'POST /reset-password']);

  const fixture = buildService({ storedPassword: await bcrypt.hash('correct-password', 4) });
  const result = await fixture.service.login('admin@example.test', 'correct-password');
  const token = verifyJwt(result.token, SECRET, NOW.getTime());
  const disabledAdmin = { findOne: () => ({ select: async () => null }) };
  const middleware = createAuthMiddleware({ secret: SECRET, Admin: disabledAdmin, now: () => NOW.getTime() });
  const req = { auth: token };
  let error;
  await middleware.authorizeAdmin(req, {}, (value) => { error = value; });
  assert.equal(error.statusCode, 403);

  const changedAdmin = { findOne: () => ({ select: async () => ({ ...fixture.admin, updatedAt: new Date(NOW.getTime() + 1) }) }) };
  const changedMiddleware = createAuthMiddleware({ secret: SECRET, Admin: changedAdmin, now: () => NOW.getTime() });
  await changedMiddleware.authorizeAdmin(req, {}, (value) => { error = value; });
  assert.equal(error.statusCode, 403);
});

test('JWT vencido, manipulado o sin bearer válido se rechaza', async () => {
  assert.throws(() => verifyJwt('bad.token.value', SECRET, NOW.getTime()), { statusCode: 401 });
  const fixture = buildService({ storedPassword: await bcrypt.hash('correct-password', 4) });
  const token = (await fixture.service.login('admin@example.test', 'correct-password')).token;
  assert.throws(() => verifyJwt(token, SECRET, NOW.getTime() + (SESSION_TTL_SECONDS + 1) * 1000), { statusCode: 401 });

  const middleware = createAuthMiddleware({ secret: SECRET, Admin: fixture.Admin, now: () => NOW.getTime() });
  const req = { headers: {}, get() { return null; } };
  let error;
  await middleware.authenticate(req, {}, (value) => { error = value; });
  assert.equal(error.statusCode, 401);
});

test('controller devuelve el JWT de login y no establece cookies', async () => {
  const controller = createAuthController({ async login() { return { token: 'signed.jwt.value', admin: { id: ADMIN_ID } }; } });
  const headers = new Map();
  const body = await new Promise((resolve, reject) => controller.login(
    { body: { correo: 'admin@example.test', contrasena: 'test' } },
    { set: (name, value) => headers.set(name, value), json: resolve }, reject
  ));
  assert.equal(body.token, 'signed.jwt.value');
  assert.equal(headers.has('Set-Cookie'), false);
  assert.equal(headers.get('Cache-Control'), 'no-store');
});
