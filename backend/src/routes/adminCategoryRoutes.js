const express = require('express');
const { createAdminCategoryService } = require('../services/adminCategoryService');
const { createAdminCategoryController } = require('../controllers/adminCategoryController');

// No montar en app.js hasta contar con autenticación y autorización administrativas.
// Integración: app.use('/api/admin/categories', authenticate, authorizeAdmin, createAdminCategoryRoutes({ Categoria, Producto })).
function createAdminCategoryRoutes(models) {
  const router = express.Router();
  const service = createAdminCategoryService(models);
  const controller = createAdminCategoryController(service);
  router.get('/', controller.list);
  router.get('/:id', controller.getById);
  router.post('/', controller.create);
  router.patch('/:id', controller.update);
  return router;
}

module.exports = createAdminCategoryRoutes;
