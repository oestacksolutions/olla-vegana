const express = require('express');
const { createPickupService } = require('../services/pickupService');
const createPickupController = require('../controllers/pickupController');

function createPickupRoutes(models) {
  const router = express.Router();
  const service = createPickupService(models);
  const controller = createPickupController(service);
  router.get('/', controller.listOptions);
  return router;
}

module.exports = createPickupRoutes;
