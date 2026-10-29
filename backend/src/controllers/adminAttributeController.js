const asyncHandler = require('../utils/asyncHandler');

function createAdminAttributeController(service) {
  return {
    list: asyncHandler(async (req, res) => res.json(await service.listAttributes())),
    create: asyncHandler(async (req, res) => res.status(201).json(await service.createAttribute(req.body))),
    update: asyncHandler(async (req, res) => res.json(await service.updateAttribute(req.params.id, req.body))),
    listValues: asyncHandler(async (req, res) => res.json(await service.listValues(req.params.id))),
    createValue: asyncHandler(async (req, res) => res.status(201).json(await service.createValue(req.params.id, req.body))),
    updateValue: asyncHandler(async (req, res) => res.json(await service.updateValue(req.params.id, req.body)))
  };
}

module.exports = { createAdminAttributeController };
