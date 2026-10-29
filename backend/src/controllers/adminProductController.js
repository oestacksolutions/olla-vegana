const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { MAX_PAGE_SIZE } = require('../services/adminProductService');

function parseBoolean(value, field) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw AppError.solicitudInvalida(`El filtro ${field} debe ser true o false`);
}

function parsePage(value, field, fallback, maximum = Number.MAX_SAFE_INTEGER) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw AppError.solicitudInvalida(`El parámetro ${field} debe ser un entero válido`);
  }
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > maximum) {
    throw AppError.solicitudInvalida(`El parámetro ${field} está fuera de rango`);
  }
  return number;
}

function parseProductQuery(query) {
  const allowedFields = ['nombre', 'categoriaId', 'activo', 'destacado', 'page', 'limit'];
  const unexpected = Object.keys(query).filter((field) => !allowedFields.includes(field));
  if (unexpected.length) throw AppError.solicitudInvalida('La consulta contiene parámetros no permitidos');

  const filters = {};
  for (const field of ['nombre', 'categoriaId']) {
    if (query[field] === undefined) continue;
    if (typeof query[field] !== 'string' || !query[field].trim()) {
      throw AppError.solicitudInvalida(`El filtro ${field} debe ser un texto no vacío`);
    }
    filters[field] = query[field].trim();
  }
  for (const field of ['activo', 'destacado']) {
    if (query[field] !== undefined) filters[field] = parseBoolean(query[field], field);
  }

  return {
    filters,
    pagination: {
      page: parsePage(query.page, 'page', 1),
      limit: parsePage(query.limit, 'limit', 20, MAX_PAGE_SIZE)
    }
  };
}

function createAdminProductController(service) {
  return {
    list: asyncHandler(async (req, res) => {
      const { filters, pagination } = parseProductQuery(req.query);
      res.json(await service.listProducts(filters, pagination));
    }),

    getById: asyncHandler(async (req, res) => {
      res.json(await service.getProductById(req.params.id));
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

module.exports = { createAdminProductController, parseProductQuery };
