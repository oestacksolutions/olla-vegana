const asyncHandler = require('../utils/asyncHandler');

function createAdminOrderController(service) {
  return {
    list: asyncHandler(async (req, res) => res.json(await service.listOrders(req.query))),
    detail: asyncHandler(async (req, res) => res.json(await service.getOrder(req.params.orderId))),
    changeStatus: asyncHandler(async (req, res) => res.json(await service.transitionOrder(req.params.orderId, req.body, req.admin?._id)))
  };
}

module.exports = { createAdminOrderController };
