const express = require('express');
const { createAdminAttributeService } = require('../services/adminAttributeService');
const { createAdminAttributeController } = require('../controllers/adminAttributeController');

// Montar únicamente detrás de autenticación y autorización administrativas reales.
// Integración: app.use('/api/admin', authenticate, authorizeAdmin, createAdminAttributeRoutes({ Atributo, ValorAtributo, ValorVariante, ItemPedido, ReservaStock, MovimientoStock })).
function createAdminAttributeRoutes(models) {
  const router = express.Router();
  const service = createAdminAttributeService(models);
  const controller = createAdminAttributeController(service);
  router.get('/attributes', controller.list);
  router.post('/attributes', controller.create);
  router.patch('/attributes/:id', controller.update);
  router.get('/attributes/:id/values', controller.listValues);
  router.post('/attributes/:id/values', controller.createValue);
  router.patch('/attribute-values/:id', controller.updateValue);
  return router;
}

module.exports = createAdminAttributeRoutes;
