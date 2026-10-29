const AppError = require('../utils/AppError');
const env = require('../config/env');

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

  const logEntry = {
    fecha: new Date().toISOString(),
    metodo: req.method,
    url: req.path,
    codigo: statusCode,
    mensaje: statusCode >= 500 ? 'Error de servidor' : message
  };
  console.error(logEntry);

  const response = { error: message };
  if (detalles !== undefined) response.detalles = detalles;
  res.status(statusCode).json(response);
};
