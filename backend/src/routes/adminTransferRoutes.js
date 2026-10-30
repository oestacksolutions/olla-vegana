const express = require('express');
const AppError = require('../utils/AppError');

function createAdminTransferRoutes(controller) {
  const router = express.Router();
  router.post('/:orderId/transfer-confirmation', (req, _res, next) => {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)
      || Object.keys(body).some((key) => !['referencia', 'importeAcreditado'].includes(key))) {
      return next(AppError.solicitudInvalida('La solicitud contiene campos no permitidos'));
    }
    return next();
  }, controller.confirm);
  return router;
}

module.exports = createAdminTransferRoutes;
