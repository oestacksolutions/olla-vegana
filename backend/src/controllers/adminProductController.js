const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

function parseProductFilters(query) {
  const allowedFields = ['nombre', 'categoriaId', 'activo'];
  const unexpected = Object.keys(query).filter((field) => !allowedFields.includes(field));
  if (unexpected.length > 0) {
    throw AppError.solicitudInvalida('El filtro contiene parametros no permitidos');
  }

  const filters = {};
  for (const field of ['nombre', 'categoriaId']) {
    if (query[field] === undefined) continue;
    if (typeof query[field] !== 'string' || !query[field].trim()) {
      throw AppError.solicitudInvalida(`El filtro ${field} debe ser un texto no vacio`);
    }
    filters[field] = query[field].trim();
  }

  if (query.activo !== undefined) {
    if (query.activo === 'true') filters.activo = true;
    else if (query.activo === 'false') filters.activo = false;
    else throw AppError.solicitudInvalida('El filtro activo debe ser true o false');
  }

  return filters;
}

function createAdminProductController(service) {
  return {
    list: asyncHandler(async (req, res) => {
      res.json(await service.listProducts(parseProductFilters(req.query)));
    }),

    create: asyncHandler(async (req, res) => {
      res.status(201).json(await service.createProduct(req.body));
    }),

    update: asyncHandler(async (req, res) => {
      res.json(await service.updateProduct(req.params.id, req.body));
    }),

    setVisibility: asyncHandler(async (req, res) => {
      if (!req.body || Array.isArray(req.body) || typeof req.body !== 'object') {
        throw AppError.solicitudInvalida('El cuerpo debe ser un objeto JSON');
      }
      const keys = Object.keys(req.body);
      if (keys.length !== 1 || keys[0] !== 'activo') {
        throw AppError.solicitudInvalida('El cuerpo solo puede incluir el campo activo');
      }
      res.json(await service.setVisibility(req.params.id, req.body.activo));
    })
  };
}

module.exports = { createAdminProductController, parseProductFilters };
