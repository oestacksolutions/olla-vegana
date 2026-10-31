const express = require('express');
const AppError = require('../utils/AppError');

function createAdminTransferRoutes(controller, { enabled = false } = {}) {
  const router = express.Router();
  router.post('/:orderId/transfer-confirmation', (req, _res, next) => {
    if (!enabled) return next(new AppError('La confirmación administrativa de transferencias está bloqueada hasta completar QA de integración aislada', 503));
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
