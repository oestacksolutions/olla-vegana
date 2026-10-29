const express = require('express');
const { createAdminVariantService } = require('../services/adminVariantService');
const { createAdminVariantController } = require('../controllers/adminVariantController');

// Montar solo después de agregar autenticación y autorización administrativas.
// Integración: app.use('/api/admin/products/:productId/variants', authenticate, authorizeAdmin, createAdminVariantRoutes({ Producto, Variante, Atributo, ValorAtributo, ValorVariante, ItemPedido, ReservaStock, MovimientoStock })).
function createAdminVariantRoutes(models) {
  const router = express.Router({ mergeParams: true });
  const service = createAdminVariantService(models);
  const controller = createAdminVariantController(service);
  router.get('/', controller.list);
  router.post('/', controller.create);
  router.patch('/:variantId', controller.update);
  return router;
}

module.exports = createAdminVariantRoutes;
