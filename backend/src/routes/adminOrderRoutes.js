const express = require('express');

function createAdminOrderRoutes(controller) {
  const router = express.Router();
  router.get('/', controller.list);
  router.get('/:orderId', controller.detail);
  router.patch('/:orderId/status', controller.changeStatus);
  return router;
}

module.exports = createAdminOrderRoutes;
