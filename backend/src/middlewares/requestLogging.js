const crypto = require('node:crypto');
const defaultLogger = require('../utils/observability');

function requestLogging(logger = defaultLogger) {
  return (req, res, next) => {
    const requestId = crypto.randomUUID();
    const started = process.hrtime.bigint();
    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);
    res.once('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
      logger.info('http.request.completed', {
        requestId,
        method: req.method,
        path: req.route?.path ? `${req.baseUrl || ''}${req.route.path}` : 'unmatched',
        status: res.statusCode,
        durationMs: Math.round(durationMs * 100) / 100
      });
    });
    next();
  };
}

module.exports = requestLogging;
