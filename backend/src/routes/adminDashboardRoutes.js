const express = require('express');
const { createAdminDashboardService } = require('../services/adminDashboardService');
const { createAdminDashboardController } = require('../controllers/adminDashboardController');

function createAdminDashboardRoutes(models, options) {
  const router = express.Router();
  const controller = createAdminDashboardController(createAdminDashboardService(models, options));
  router.get('/summary', controller.summary);
  return router;
}

module.exports = createAdminDashboardRoutes;
