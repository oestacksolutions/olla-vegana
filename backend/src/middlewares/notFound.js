const AppError = require('../utils/AppError');

module.exports = function notFound(req, res, next) {
  next(AppError.noEncontrado('Ruta no encontrada'));
};
