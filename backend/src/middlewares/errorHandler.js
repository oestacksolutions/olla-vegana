const AppError = require('../utils/AppError');
const env = require('../config/env');

const prismaErrors = {
  P2002: [409, 'Ya existe un registro con esos datos'],
  P2025: [404, 'Registro no encontrado'],
  P2003: [409, 'La operaci\u00f3n afecta registros relacionados'],
  P1001: [503, 'Servicio no disponible'],
  P1002: [503, 'Servicio no disponible']
};

module.exports = function errorHandler(error, req, res, next) {
  let statusCode = 500;
  let message = 'Error interno del servidor';
  let detalles;

  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
    detalles = error.detalles;
  } else if (
    error instanceof SyntaxError &&
    error.status === 400 &&
    error.type === 'entity.parse.failed'
  ) {
    statusCode = 400;
    message = 'El cuerpo de la solicitud no es un JSON v\u00e1lido';
  } else if (error && prismaErrors[error.code || error.errorCode]) {
    [statusCode, message] = prismaErrors[error.code || error.errorCode];
  }

  const logEntry = {
    fecha: new Date().toISOString(),
    metodo: req.method,
    url: req.path,
    codigo: statusCode,
    mensaje: message
  };
  if (env.NODE_ENV === 'development' && error.stack) {
    logEntry.stack = error.stack;
  }
  console.error(logEntry);

  const response = { error: message };
  if (detalles !== undefined) response.detalles = detalles;
  res.status(statusCode).json(response);
};
