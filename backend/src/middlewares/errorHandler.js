const AppError = require('../utils/AppError');

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

  const logEntry = {
    fecha: new Date().toISOString(),
    metodo: req.method,
    url: req.path,
    codigo: statusCode,
    mensaje: statusCode >= 500 ? 'Error de servidor' : message
  };
  if (statusCode >= 500) {
    logEntry.tipo = typeof error?.name === 'string' ? error.name : 'Error';
    if (Number.isInteger(error?.code)) logEntry.codigoInterno = error.code;
    if (typeof error?.stack === 'string') {
      const frames = error.stack.split('\n').slice(1, 6).map((frame) => frame.trim());
      if (frames.length) logEntry.trazaInterna = frames;
    }
  }
  console.error(logEntry);

  const response = { error: message };
  if (detalles !== undefined) response.detalles = detalles;
  res.status(statusCode).json(response);
};
