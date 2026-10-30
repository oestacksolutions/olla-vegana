const express = require('express');

function createWebhookRoutes(controller) {
  const router = express.Router();
  router.post('/mercadopago', controller.receive);
  return router;
}

module.exports = createWebhookRoutes;
