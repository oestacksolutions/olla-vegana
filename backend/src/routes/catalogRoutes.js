const express = require('express');

function createCatalogRoutes(controller) {
  const router = express.Router();

  router.get('/products', controller.listProducts);
  router.get('/products/:slug', controller.getProduct);
  router.get('/categories', controller.listCategories);

  return router;
}

module.exports = createCatalogRoutes;
