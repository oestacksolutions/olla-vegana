const asyncHandler = require('../utils/asyncHandler');

function createAdminOrderOperationsController({ cancellationService, refundService }) {
  return {
    cancel: asyncHandler(async (req, res) => {
      const result = await cancellationService.cancelPending({
        pedidoId: req.params.orderId, adminId: req.admin?._id, motivo: req.body?.motivo
      });
      res.status(200).json(result);
    }),
    cancelPaid: asyncHandler(async (req, res) => {
      const result = await cancellationService.cancelPaidBeforePickup({
        pedidoId: req.params.orderId, adminId: req.admin?._id, motivo: req.body?.motivo
      });
      res.status(200).json(result);
    }),
    requestRefund: asyncHandler(async (req, res) => {
      const result = await refundService.requestRefund({
        pedidoId: req.params.orderId, adminId: req.admin?._id,
        importe: req.body?.importe, motivo: req.body?.motivo,
        idOperacion: req.get('Idempotency-Key')
      });
      res.status(result.idempotente ? 200 : 201).json({
        id: String(result.reintegro._id), estado: result.reintegro.estado,
        tipo: result.reintegro.tipo, importeSolicitado: result.reintegro.importeSolicitado.toString(),
        moneda: result.reintegro.moneda, idempotente: result.idempotente
      });
    }),
    confirmTransferRefund: asyncHandler(async (req, res) => {
      const result = await refundService.confirmManualTransferRefund({
        reintegroId: req.params.refundId, adminId: req.admin?._id,
        importeConfirmado: req.body?.importeConfirmado, referencia: req.body?.referencia,
        idOperacion: req.get('Idempotency-Key')
      });
      res.status(200).json(result);
    })
  };
}

module.exports = createAdminOrderOperationsController;
