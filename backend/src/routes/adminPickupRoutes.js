const express = require('express');
const { createAdminPickupService } = require('../services/adminPickupService');
const { createAdminPickupController } = require('../controllers/adminPickupController');

function createAdminPickupRoutes(models) {
  const router = express.Router();
  const controller = createAdminPickupController(createAdminPickupService(models));
  router.get('/', controller.list);
  router.get('/points/:id', controller.getPoint);
  router.post('/points', controller.createPoint);
  router.patch('/points/:id', controller.updatePoint);
  router.get('/events/:id', controller.getEvent);
  router.post('/events', controller.createEvent);
  router.patch('/events/:id', controller.updateEvent);
  return router;
}

module.exports = createAdminPickupRoutes;
