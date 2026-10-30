const express = require('express');

function createOrderAccessRoutes(controller) {
  const router = express.Router();
  router.get('/:orderId/transfer-instructions', controller.getTransferInstructions);
  return router;
}

module.exports = createOrderAccessRoutes;
