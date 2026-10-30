const asyncHandler = require('../utils/asyncHandler');

function createAdminTransferController(service) {
  return {
    confirm: asyncHandler(async (req, res) => {
      const result = await service.confirmTransfer({
        pedidoId: req.params.orderId,
        adminId: req.admin?._id,
        referencia: req.body?.referencia,
        importeAcreditado: req.body?.importeAcreditado,
        idOperacion: req.get('Idempotency-Key')
      });
      res.status(200).json(result);
    })
  };
}

module.exports = createAdminTransferController;
