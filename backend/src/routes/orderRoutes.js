const express = require('express');

const DISABLED_MESSAGE = 'La creación de pedidos estará disponible cuando se integre la reserva atómica de stock.';

function createOrderRoutes() {
  const router = express.Router();
  router.post('/', (_req, res) => res.status(503).json({ error: DISABLED_MESSAGE }));
  return router;
}

module.exports = createOrderRoutes;
module.exports.DISABLED_MESSAGE = DISABLED_MESSAGE;
