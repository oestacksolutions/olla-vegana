const asyncHandler = require('../utils/asyncHandler');

function createCartController(cartValidationService) {
  return {
    validateCart: asyncHandler(async (req, res) => {
      const result = await cartValidationService.validateCart(req.body);
      res.status(result.valido ? 200 : 422).json(result);
    })
  };
}

module.exports = createCartController;
