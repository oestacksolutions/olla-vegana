const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

function createAdminImageController(service) {
  return {
    list: asyncHandler(async (req, res) => {
      res.json(await service.listImages(req.params.productId));
    }),

    upload: asyncHandler(async (req, res) => {
      const allowed = ['textosAlternativos', 'varianteIds'];
      if (Object.keys(req.body || {}).some((key) => !allowed.includes(key))) {
        throw AppError.solicitudInvalida('El formulario contiene campos no permitidos');
      }
      res.status(201).json(await service.uploadImages(req.params.productId, req.files, req.body || {}));
    }),

    edit: asyncHandler(async (req, res) => {
      res.json(await service.editImage(req.params.productId, req.params.imageId, req.body));
    }),

    reorder: asyncHandler(async (req, res) => {
      if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) ||
        Object.keys(req.body).length !== 1 || !Object.hasOwn(req.body, 'imagenes')) {
        throw AppError.solicitudInvalida('El cuerpo debe incluir únicamente el arreglo imagenes');
      }
      res.json(await service.reorderImages(req.params.productId, req.body.imagenes));
    }),

    replace: asyncHandler(async (req, res) => {
      if (!req.file) throw AppError.solicitudInvalida('Debe enviar un archivo en el campo imagen');
      res.json(await service.replaceImage(req.params.productId, req.params.imageId, req.file));
    }),

    remove: asyncHandler(async (req, res) => {
      res.json(await service.deleteImage(req.params.productId, req.params.imageId));
    })
  };
}

module.exports = { createAdminImageController };
