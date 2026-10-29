const express = require('express');

function createCartRoutes(controller) {
  const router = express.Router();
  router.post('/cart/validate', controller.validateCart);
  return router;
}

module.exports = createCartRoutes;
