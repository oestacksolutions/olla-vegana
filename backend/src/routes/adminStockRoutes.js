const express = require('express');
const { createAdminStockService } = require('../services/adminStockService');
const { createAdminStockController } = require('../controllers/adminStockController');

function createAdminStockRoutes(models, options) {
  const router = express.Router();
  const controller = createAdminStockController(createAdminStockService(models, options));
  router.get('/', controller.list);
  router.get('/:variantId/movements', controller.movements);
  router.get('/:variantId', controller.detail);
  router.post('/:variantId/adjustments', controller.adjust);
  return router;
}

module.exports = createAdminStockRoutes;
