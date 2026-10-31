const express = require('express');
const { createAdminBannerService } = require('../services/adminBannerService');
const { createAdminBannerController } = require('../controllers/adminBannerController');

function createBannerRoutes(models, options = {}) {
  const router = express.Router();
  router.get('/banners', createAdminBannerController(createAdminBannerService(models, options)).publicList);
  return router;
}

module.exports = createBannerRoutes;
