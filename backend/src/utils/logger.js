const LEVELS = Object.freeze({ INFO: 30, WARN: 40, ERROR: 50 });
const REDACT_KEY = /(password|contrasena|token|authorization|cookie|secret|signature|firma|access.?key|access.?token|smtp.?pass|cbu|cvu|alias|tarjeta|card|correo|email|telefono|phone|nombre|apellido|direccion|address|request.?body|payload)/i;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const BEARER = /\bBearer\s+[^\s,;]+/gi;
const JWT = /\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const BANK_NUMBER = /\b\d{22}\b/g;

function redactString(value) {
  return value.replace(BEARER, 'Bearer [REDACTED]')
    .replace(JWT, '[REDACTED_JWT]')
    .replace(EMAIL, '[REDACTED_EMAIL]')
    .replace(BANK_NUMBER, '[REDACTED_BANK_ACCOUNT]')
    .slice(0, 2000);
}

function sanitize(value, key = '', depth = 0) {
  if (REDACT_KEY.test(key)) return '[REDACTED]';
  if (value == null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'string') return redactString(value);
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : null;
  if (depth >= 4) return '[TRUNCATED]';
  if (Array.isArray(value)) return value.slice(0, 30).map((entry) => sanitize(entry, '', depth + 1));
  if (typeof value === 'object') {
    const safe = {};
    for (const [childKey, child] of Object.entries(value).slice(0, 50)) {
      safe[childKey] = sanitize(child, childKey, depth + 1);
    }
    return safe;
  }
  return String(value);
}

function createLogger({ level = 'INFO', sink = console, retentionDays = 30, now = () => new Date() } = {}) {
  const minimum = LEVELS[String(level).toUpperCase()] || LEVELS.INFO;
  function write(name, event, fields = {}) {
    if (LEVELS[name] < minimum) return;
    const record = sanitize({ timestamp: now().toISOString(), level: name, event, ...fields });
    const output = JSON.stringify(record);
    (name === 'ERROR' ? sink.error : name === 'WARN' ? sink.warn : sink.info).call(sink, output);
  }
  return Object.freeze({
    info: (event, fields) => write('INFO', event, fields),
    warn: (event, fields) => write('WARN', event, fields),
    error: (event, fields) => write('ERROR', event, fields),
    retentionDays
  });
}

module.exports = { createLogger, sanitize, redactString };
