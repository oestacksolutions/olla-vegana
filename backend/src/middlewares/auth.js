const crypto = require('crypto');
const AppError = require('../utils/AppError');

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

function decodePart(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function verifyJwt(token, secret, now = Date.now()) {
  const parts = typeof token === 'string' ? token.split('.') : [];
  if (parts.length !== 3) throw AppError.noAutorizado('Autenticación requerida');

  let header;
  let payload;
  try {
    header = JSON.parse(decodePart(parts[0]));
    payload = JSON.parse(decodePart(parts[1]));
  } catch {
    throw AppError.noAutorizado('Autenticación requerida');
  }

  if (header.alg !== 'HS256' || header.typ !== 'JWT') throw AppError.noAutorizado('Autenticación requerida');

  const expected = crypto.createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest();
  let received;
  try { received = Buffer.from(parts[2], 'base64url'); }
  catch { throw AppError.noAutorizado('Autenticación requerida'); }

  if (received.length !== expected.length
    || !crypto.timingSafeEqual(received, expected)
    || typeof payload.sub !== 'string'
    || !OBJECT_ID_PATTERN.test(payload.sub)
    || !Number.isSafeInteger(payload.adminUpdatedAt)
    || typeof payload.exp !== 'number'
    || payload.exp <= Math.floor(now / 1000)) {
    throw AppError.noAutorizado('Autenticación requerida');
  }
  return payload;
}

function getBearerToken(req) {
  const authorization = req.get?.('authorization') || req.headers?.authorization;
  if (typeof authorization !== 'string') return null;
  const [scheme, token, ...extra] = authorization.trim().split(/\s+/);
  if (scheme?.toLowerCase() !== 'bearer' || !token || extra.length) return null;
  return token;
}

function createAuthMiddleware({ secret, Admin, now = Date.now }) {
  async function authenticate(req, _res, next) {
    try {
      const token = getBearerToken(req);
      if (!token) throw AppError.noAutorizado('Autenticación requerida');
      req.auth = verifyJwt(token, secret, now());
      next();
    } catch (error) {
      next(error);
    }
  }

  async function authorizeAdmin(req, _res, next) {
    try {
      const admin = await Admin.findOne({ _id: req.auth.sub, activo: true }).select('_id correo activo updatedAt');
      if (!admin || (admin.updatedAt?.getTime() ?? 0) !== req.auth.adminUpdatedAt) {
        throw AppError.prohibido('No tenés permisos para realizar esta operación');
      }
      req.admin = admin;
      next();
    } catch (error) {
      next(error);
    }
  }

  return { authenticate, authorizeAdmin };
}

module.exports = { createAuthMiddleware, verifyJwt, getBearerToken };
