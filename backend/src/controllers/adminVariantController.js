const asyncHandler = require('../utils/asyncHandler');

function createAdminVariantController(service) {
  return {
    list: asyncHandler(async (req, res) => res.json(await service.listVariants(req.params.productId))),
    create: asyncHandler(async (req, res) => res.status(201).json(await service.createVariant(req.params.productId, req.body))),
    update: asyncHandler(async (req, res) => res.json(await service.updateVariant(req.params.productId, req.params.variantId, req.body)))
  };
}

module.exports = { createAdminVariantController };
