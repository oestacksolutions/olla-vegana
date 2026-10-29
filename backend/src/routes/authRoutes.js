const express = require('express');

function createAuthRoutes(controller) {
  const router = express.Router();
  router.post('/login', controller.login);
  router.post('/forgot-password', controller.requestPasswordReset);
  router.post('/reset-password', controller.resetPassword);
  return router;
}

module.exports = createAuthRoutes;
