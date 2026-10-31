const asyncHandler = require('../utils/asyncHandler');

function createAdminPickupController(service) {
  return {
    list: asyncHandler(async (_req, res) => res.json(await service.list())),
    getPoint: asyncHandler(async (req, res) => res.json(await service.getPoint(req.params.id))),
    createPoint: asyncHandler(async (req, res) => res.status(201).json(await service.createPoint(req.body))),
    updatePoint: asyncHandler(async (req, res) => res.json(await service.updatePoint(req.params.id, req.body))),
    getEvent: asyncHandler(async (req, res) => res.json(await service.getEvent(req.params.id))),
    createEvent: asyncHandler(async (req, res) => res.status(201).json(await service.createEvent(req.body))),
    updateEvent: asyncHandler(async (req, res) => res.json(await service.updateEvent(req.params.id, req.body)))
  };
}

module.exports = { createAdminPickupController };
