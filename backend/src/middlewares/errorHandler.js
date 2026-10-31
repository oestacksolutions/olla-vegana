const AppError = require('../utils/AppError');
const logger = require('../utils/observability');

function errorCategory(error, statusCode) {
  if (error?.name === 'ValidationError' || error?.name === 'CastError' || statusCode === 400) return 'VALIDATION';
  if (statusCode === 401) return 'AUTHENTICATION';
  if (statusCode === 403) return 'AUTHORIZATION';
  if (error?.name?.includes('Mongo') || error?.name?.includes('Mongoose')) return 'DATABASE';
  if (error?.hasErrorLabel?.('TransientTransactionError') || error?.codeName === 'WriteConflict') return 'TRANSACTION';
  if (/WEBHOOK|PAYMENT|MERCADO|TRANSFER|EMAIL|SMTP|PROVIDER/i.test(String(error?.code || ''))) return 'INTEGRATION';
  if (statusCode >= 500) return 'UNEXPECTED';
  return 'REQUEST';
}

module.exports = function errorHandler(error, req, res, next) {
  let statusCode = 500;
  let message = 'Error interno del servidor';
  let detalles;

  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
    detalles = error.detalles;
  } else if (error instanceof SyntaxError && error.status === 400 && error.type === 'entity.parse.failed') {
    statusCode = 400;
    message = 'El cuerpo de la solicitud no es un JSON válido';
  } else if (error && error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Los datos enviados no son válidos';
    detalles = Object.keys(error.errors || {}).map((field) => ({ campo: field }));
  } else if (error && error.name === 'MulterError') {
    statusCode = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    message = error.code === 'LIMIT_FILE_SIZE'
      ? 'La imagen supera el tamaño máximo permitido'
      : 'La carga de imágenes excede los límites permitidos';
  } else if (error && error.name === 'CastError') {
    statusCode = 400;
    message = 'El identificador o formato enviado no es válido';
  } else if (error && error.code === 11000) {
    statusCode = 409;
    message = 'Ya existe un registro con esos datos';
  } else if (error && (error.name === 'DocumentNotFoundError' || error.status === 404)) {
    statusCode = 404;
    message = 'Registro no encontrado';
  } else if (error && ['MongoServerSelectionError', 'MongooseServerSelectionError', 'MongoNetworkError', 'MongoServerError'].includes(error.name) && error.code !== 11000) {
    statusCode = 503;
    message = 'Servicio no disponible';
  }

  const entry = {
    requestId: req.requestId || null,
    method: req.method,
    path: req.route?.path ? `${req.baseUrl || ''}${req.route.path}` : 'unmatched',
    status: statusCode,
    category: errorCategory(error, statusCode),
    errorCode: typeof error?.code === 'string' || Number.isInteger(error?.code) ? error.code : error?.name || 'ERROR'
  };
  if (statusCode >= 500 && typeof error?.stack === 'string') {
    entry.stack = error.stack.split('\n').slice(1, 6).map((frame) => frame.trim());
  }
  if (statusCode >= 500) logger.error('http.error', entry);
  else if (statusCode >= 400) logger.warn('http.error', entry);
  if (statusCode >= 500) {
    void logger.alerts?.dispatch('backend:unexpected-error', 'backend.unexpected_error', {
      requestId: req.requestId || null, status: statusCode, errorCode: entry.errorCode
    });
  }

  const response = { error: message };
  if (detalles !== undefined) response.detalles = detalles;
  res.status(statusCode).json(response);
};

module.exports.errorCategory = errorCategory;
