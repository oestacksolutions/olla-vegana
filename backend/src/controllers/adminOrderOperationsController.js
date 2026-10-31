const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/observability');

function createAdminOrderOperationsController({ cancellationService, refundService }) {
  return {
    cancel: asyncHandler(async (req, res) => {
      const result = await cancellationService.cancelPending({
        pedidoId: req.params.orderId, adminId: req.admin?._id, motivo: req.body?.motivo
      });
      if (result.cancelado) logger.info('order.cancelled', { orderId: String(req.params.orderId), adminId: String(req.admin?._id || '') });
      res.status(200).json(result);
    }),
    cancelPaid: asyncHandler(async (req, res) => {
      const result = await cancellationService.cancelPaidBeforePickup({
        pedidoId: req.params.orderId, adminId: req.admin?._id, motivo: req.body?.motivo
      });
      if (result.cancelado) logger.info('order.cancelled', { orderId: String(req.params.orderId), adminId: String(req.admin?._id || ''), refundState: result.estadoReintegro });
      res.status(200).json(result);
    }),
    requestRefund: asyncHandler(async (req, res) => {
      const result = await refundService.requestRefund({
        pedidoId: req.params.orderId, adminId: req.admin?._id,
        importe: req.body?.importe, motivo: req.body?.motivo,
        idOperacion: req.get('Idempotency-Key')
      });
      logger.info('refund.requested', { orderId: String(req.params.orderId), refundId: String(result.reintegro._id), provider: result.reintegro.proveedor, state: result.reintegro.estado, idempotent: result.idempotente });
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
      if (result.confirmado) logger.info('refund.transfer.confirmed', { refundId: String(req.params.refundId), adminId: String(req.admin?._id || ''), idempotent: result.idempotente });
      res.status(200).json(result);
    })
  };
}

module.exports = createAdminOrderOperationsController;
