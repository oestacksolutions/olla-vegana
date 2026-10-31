const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

function createAdminBannerController(service) {
  return {
    list: asyncHandler(async (_req, res) => res.json(await service.list())),
    publicList: asyncHandler(async (_req, res) => res.json(await service.publicList())),
    save: asyncHandler(async (req, res) => {
      if (Object.keys(req.body || {}).some((key) => key !== 'config') || typeof req.body?.config !== 'string') {
        throw AppError.solicitudInvalida('Debe enviar la configuración de banners');
      }
      let config;
      try { config = JSON.parse(req.body.config); } catch (_error) { throw AppError.solicitudInvalida('La configuración de banners no es válida'); }
      res.json(await service.save(config, req.files || []));
    })
  };
}

module.exports = { createAdminBannerController };
