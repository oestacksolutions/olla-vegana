const { WebhookSignatureValidator } = require('mercadopago');

const ORDER_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9-]{8,128}$/;

function parseSignatureHeader(value) {
  if (typeof value !== 'string' || value.length > 512) return null;
  const parts = new Map();
  for (const segment of value.split(',')) {
    const separator = segment.indexOf('=');
    if (separator < 1) return null;
    const key = segment.slice(0, separator).trim().toLowerCase();
    const item = segment.slice(separator + 1).trim();
    if (!['ts', 'v1'].includes(key) || !item || parts.has(key)) return null;
    parts.set(key, item);
  }
  const ts = parts.get('ts');
  const v1 = parts.get('v1');
  if (!/^\d{10,13}$/.test(ts || '') || !/^[a-f\d]{64}$/i.test(v1 || '')) return null;
  return { ts, v1 };
}

function validateWebhookSignature({ signature, requestId, dataId, secret, now = () => Date.now(), toleranceSeconds = 300 }) {
  const parsed = parseSignatureHeader(signature);
  if (!parsed || typeof secret !== 'string' || secret.length < 1
    || typeof requestId !== 'string' || !REQUEST_ID_PATTERN.test(requestId)
    || typeof dataId !== 'string' || !ORDER_ID_PATTERN.test(dataId)
    || !Number.isSafeInteger(toleranceSeconds) || toleranceSeconds < 1 || toleranceSeconds > 900) return false;
  try {
    WebhookSignatureValidator.validate({
      xSignature: signature,
      xRequestId: requestId,
      dataId,
      secret,
      now
    });
    const timestampNumber = Number(parsed.ts);
    const timestampMs = parsed.ts.length === 13 ? timestampNumber : timestampNumber * 1000;
    if (!Number.isSafeInteger(timestampMs) || Math.abs(now() - timestampMs) > toleranceSeconds * 1000) return false;
    return true;
  } catch {
    return false;
  }
}

module.exports = { validateWebhookSignature, parseSignatureHeader, ORDER_ID_PATTERN, REQUEST_ID_PATTERN };
