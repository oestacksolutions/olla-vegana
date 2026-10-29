const express = require('express');
const { createAdminImageService } = require('../services/adminImageService');
const { createCloudinaryStorage } = require('../services/cloudinaryStorage');
const { createAdminImageController } = require('../controllers/adminImageController');
const { receiveGalleryImages, receiveReplacementImage } = require('../middlewares/imageUpload');

// No montar hasta que estén disponibles los middlewares reales de autenticación
// y autorización. Integración: app.use('/api/admin/products/:productId/images',
// authenticate, authorizeAdmin, createAdminImageRoutes({ Producto, Variante, ImagenProducto }));
function createAdminImageRoutes(models, { storage = createCloudinaryStorage(), ...options } = {}) {
  const router = express.Router({ mergeParams: true });
  const service = createAdminImageService(models, { ...options, storage });
  const controller = createAdminImageController(service);

  router.get('/', controller.list);
  router.post('/', receiveGalleryImages, controller.upload);
  router.patch('/order', controller.reorder);
  router.put('/:imageId/file', receiveReplacementImage, controller.replace);
  router.patch('/:imageId', controller.edit);
  router.delete('/:imageId', controller.remove);

  return router;
}

module.exports = createAdminImageRoutes;
