class AppError extends Error {
  constructor(message, statusCode, detalles) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    if (detalles !== undefined) this.detalles = detalles;
    Error.captureStackTrace?.(this, AppError);
  }

  static solicitudInvalida(message = 'Solicitud inv\u00e1lida', detalles) {
    return new AppError(message, 400, detalles);
  }

  static noAutorizado(message = 'No autorizado', detalles) {
    return new AppError(message, 401, detalles);
  }

  static prohibido(message = 'Acceso prohibido', detalles) {
    return new AppError(message, 403, detalles);
  }

  static noEncontrado(message = 'Recurso no encontrado', detalles) {
    return new AppError(message, 404, detalles);
  }

  static conflicto(message = 'Conflicto', detalles) {
    return new AppError(message, 409, detalles);
  }
}

module.exports = AppError;
