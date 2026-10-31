const express = require('express');
const { createAdminBannerService } = require('../services/adminBannerService');
const { createAdminBannerController } = require('../controllers/adminBannerController');
const { receiveBannerConfig } = require('../middlewares/bannerUpload');

function createAdminBannerRoutes(models, options = {}) {
  const router = express.Router();
  const controller = createAdminBannerController(createAdminBannerService(models, options));
  router.get('/', controller.list);
  router.put('/', receiveBannerConfig, controller.save);
  return router;
}

module.exports = createAdminBannerRoutes;
