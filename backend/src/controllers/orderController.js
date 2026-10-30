const asyncHandler = require('../utils/asyncHandler');

function createOrderController(orderService) {
  return {
    createOrder: asyncHandler(async (req, res) => {
      const result = await orderService.createOrder(req.body, req.get('Idempotency-Key'));
      res.status(result.repetido ? 200 : 201).json(result);
    })
  };
}

module.exports = createOrderController;
