const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const AppError = require('../utils/AppError');

const LOCAL_ORIGINS = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174'
]);

function configuredOrigins(frontendUrl) {
  return new Set(
    String(frontendUrl || '')
      .split(',')
      .map((origin) => origin.trim().replace(/\/$/, ''))
      .filter(Boolean)
  );
}

function createCorsOptions(env) {
  const productionOrigins = configuredOrigins(env.FRONTEND_URL);

  return {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      const allowed = env.NODE_ENV !== 'production'
        ? LOCAL_ORIGINS.has(origin) || productionOrigins.has(origin)
        : productionOrigins.has(origin);

      callback(allowed ? null : new AppError('Origen no permitido.', 403), allowed);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
    optionsSuccessStatus: 204
  };
}

function createApiRateLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Demasiadas solicitudes. Intentá nuevamente más tarde.' }
  });
}

function createAuthRateLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Demasiados intentos. Intentá nuevamente más tarde.' }
  });
}

function rejectUnsafeKeys(value, path = 'cuerpo', depth = 0) {
  if (!value || typeof value !== 'object') return;
  if (depth > 10) throw AppError.solicitudInvalida('El cuerpo de la solicitud es demasiado profundo.');
  for (const [key, nestedValue] of Object.entries(value)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype' || key.startsWith('$') || key.includes('.')) {
      throw AppError.solicitudInvalida(`El campo ${path} contiene una clave no permitida.`);
    }
    rejectUnsafeKeys(nestedValue, `${path}.${key}`, depth + 1);
  }
}

function validateJsonBody(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    next();
    return;
  }
  if (!req.body || Array.isArray(req.body) || typeof req.body !== 'object') {
    next(AppError.solicitudInvalida('El cuerpo debe ser un objeto JSON.'));
    return;
  }
  try {
    rejectUnsafeKeys(req.body);
    next();
  } catch (error) {
    next(error);
  }
}

function validateAuthPayload(req, res, next) {
  const bodyRequiredPaths = new Set(['/login', '/forgot-password', '/reset-password']);
  if (req.method !== 'POST' || !bodyRequiredPaths.has(req.path)) {
    next();
    return;
  }

  validateJsonBody(req, res, () => {
    const { correo, contrasena, token, nuevaContrasena } = req.body || {};
    if (req.path === '/login'
      && (typeof correo !== 'string' || correo.length > 254 || typeof contrasena !== 'string' || contrasena.length > 1024)) {
      next(AppError.solicitudInvalida('El correo y la contraseña son obligatorios.'));
      return;
    }
    if (req.path === '/forgot-password' && (typeof correo !== 'string' || correo.length > 254)) {
      next(AppError.solicitudInvalida('El correo es obligatorio.'));
      return;
    }
    if (req.path === '/reset-password'
      && (typeof token !== 'string' || token.length > 256
        || typeof (nuevaContrasena || req.body.contrasena) !== 'string'
        || (nuevaContrasena || req.body.contrasena).length > 1024)) {
      next(AppError.solicitudInvalida('El token y la nueva contraseña son obligatorios.'));
      return;
    }
    next();
  });
}

module.exports = {
  createCorsOptions,
  createApiRateLimiter,
  createAuthRateLimiter,
  validateJsonBody,
  validateAuthPayload,
  helmetMiddleware: helmet()
};