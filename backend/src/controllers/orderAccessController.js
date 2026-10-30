const asyncHandler = require('../utils/asyncHandler');

function bearerToken(req) {
  const header = req.get('authorization');
  if (typeof header !== 'string') return null;
  const match = /^Bearer\s+([A-Za-z0-9_-]{43})$/i.exec(header.trim());
  return match?.[1] || null;
}

function createOrderAccessController(transferInstructionsService) {
  return {
    getTransferInstructions: asyncHandler(async (req, res) => {
      const result = await transferInstructionsService.getForBuyer(req.params.orderId, bearerToken(req));
      res.json(result);
    })
  };
}

module.exports = createOrderAccessController;
