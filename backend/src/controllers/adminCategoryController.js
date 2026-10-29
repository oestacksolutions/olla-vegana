const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

function parseCategoryFilters(query) {
  const allowed = ['nombre', 'activa'];
  if (Object.keys(query).some((field) => !allowed.includes(field))) {
    throw AppError.solicitudInvalida('La consulta contiene parámetros no permitidos');
  }
  const filters = {};
  if (query.nombre !== undefined) {
    if (typeof query.nombre !== 'string' || !query.nombre.trim()) {
      throw AppError.solicitudInvalida('El filtro nombre debe ser un texto no vacío');
    }
    filters.nombre = query.nombre.trim();
  }
  if (query.activa !== undefined) {
    if (query.activa === 'true') filters.activa = true;
    else if (query.activa === 'false') filters.activa = false;
    else throw AppError.solicitudInvalida('El filtro activa debe ser true o false');
  }
  return filters;
}

function createAdminCategoryController(service) {
  return {
    list: asyncHandler(async (req, res) => {
      res.json(await service.listCategories(parseCategoryFilters(req.query)));
    }),
    getById: asyncHandler(async (req, res) => {
      res.json(await service.getCategoryById(req.params.id));
    }),
    create: asyncHandler(async (req, res) => {
      res.status(201).json(await service.createCategory(req.body));
    }),
    update: asyncHandler(async (req, res) => {
      res.json(await service.updateCategory(req.params.id, req.body));
    })
  };
}

module.exports = { createAdminCategoryController, parseCategoryFilters };
