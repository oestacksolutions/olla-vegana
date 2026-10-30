const express = require('express');
const AppError = require('../utils/AppError');

function validateKeys(allowed) {
  return (req, _res, next) => {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)
      || Object.keys(req.body).some((key) => !allowed.includes(key))) {
      return next(AppError.solicitudInvalida('La solicitud contiene campos no permitidos'));
    }
    next();
  };
}

function createAdminOrderOperationsRoutes(controller, {
  authenticate, authorizeOrderCancellation, authorizeRefundRequest, authorizeRefundConfirmation
} = {}) {
  if ([authenticate, authorizeOrderCancellation, authorizeRefundRequest, authorizeRefundConfirmation]
    .some((middleware) => typeof middleware !== 'function')) {
    throw new TypeError('Las operaciones requieren autenticaciÃ³n y permisos explÃ­citos de cancelaciÃ³n, solicitud y confirmaciÃ³n de reintegros');
  }
  const router = express.Router();
  router.post('/:orderId/cancel', authenticate, authorizeOrderCancellation, validateKeys(['motivo']), controller.cancel);
  router.post('/:orderId/cancel-paid', authenticate, authorizeOrderCancellation, validateKeys(['motivo']), controller.cancelPaid);
  router.post('/:orderId/refunds', authenticate, authorizeRefundRequest, validateKeys(['importe', 'motivo']), controller.requestRefund);
  router.post('/refunds/:refundId/confirm-transfer', authenticate, authorizeRefundConfirmation, validateKeys(['importeConfirmado', 'referencia']), controller.confirmTransferRefund);
  return router;
}

module.exports = createAdminOrderOperationsRoutes;
