const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

function createAdminDashboardController(service) {
  return {
    summary: asyncHandler(async (req, res) => {
      const allowed = ['period'];
      if (Object.keys(req.query).some((key) => !allowed.includes(key))) {
        throw AppError.solicitudInvalida('La consulta contiene parámetros no permitidos');
      }
      const period = req.query.period === undefined ? '30d' : req.query.period;
      res.json(await service.getSummary(period));
    })
  };
}

module.exports = { createAdminDashboardController };
