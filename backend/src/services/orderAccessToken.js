const crypto = require('node:crypto');
const mongoose = require('mongoose');

const TOKEN_VALIDITY_MS = 30 * 24 * 60 * 60 * 1000;

function createOrderAccessTokenService(secret) {
  if (typeof secret !== 'string' || secret.length < 32) {
    throw new TypeError('Order access tokens requieren una clave de servidor de al menos 32 caracteres');
  }
  const key = Buffer.from(crypto.hkdfSync('sha256', Buffer.from(secret), Buffer.alloc(0), Buffer.from('olla-vegana-order-access-v1'), 32));

  function issue({ pedidoId, idOperacion }) {
    if (!mongoose.isObjectIdOrHexString(pedidoId) || typeof idOperacion !== 'string' || !idOperacion) {
      throw new TypeError('No se pudo generar el acceso limitado al pedido');
    }
    return crypto.createHmac('sha256', key)
      .update(`${String(pedidoId)}:${idOperacion}`)
      .digest('base64url');
  }

  function hash(token) {
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  function matches(token, expectedHash) {
    const actualHash = hash(token);
    if (!actualHash || typeof expectedHash !== 'string' || !/^[a-f\d]{64}$/i.test(expectedHash)) return false;
    const actual = Buffer.from(actualHash, 'hex');
    const expected = Buffer.from(expectedHash, 'hex');
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  }

  return { issue, hash, matches, TOKEN_VALIDITY_MS };
}

module.exports = { createOrderAccessTokenService, TOKEN_VALIDITY_MS };
