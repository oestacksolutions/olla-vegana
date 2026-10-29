const express = require('express');
const { createAdminProductService } = require('../services/adminProductService');
const { createAdminProductController } = require('../controllers/adminProductController');

// No montar en app.js hasta contar con autenticación y autorización administrativas.
function createAdminProductRoutes(models) {
  const router = express.Router();
  const service = createAdminProductService(models);
  const controller = createAdminProductController(service);

  router.get('/', controller.list);
  router.post('/', controller.create);
  router.patch('/:id/visibility', controller.setVisibility);
  router.patch('/:id', controller.update);

  return router;
}

module.exports = createAdminProductRoutes;
