const asyncHandler = require('../utils/asyncHandler');

function createPickupController(service) {
  return {
    listOptions: asyncHandler(async (_req, res) => {
      res.json(await service.listOptions());
    })
  };
}

module.exports = createPickupController;
