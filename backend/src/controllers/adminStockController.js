const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { MAX_PAGE_SIZE, MOVEMENT_TYPES } = require('../services/adminStockService');

function parseInteger(value, field, { fallback, min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw AppError.solicitudInvalida(`El parámetro ${field} debe ser un entero válido`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw AppError.solicitudInvalida(`El parámetro ${field} está fuera de rango`);
  }
  return parsed;
}

function parseInventoryQuery(query) {
  const allowed = ['productoId', 'stockBajo', 'page', 'limit'];
  if (Object.keys(query).some((key) => !allowed.includes(key))) {
    throw AppError.solicitudInvalida('La consulta contiene parámetros no permitidos');
  }
  if (query.productoId !== undefined && (typeof query.productoId !== 'string' || !query.productoId.trim())) {
    throw AppError.solicitudInvalida('productoId debe ser un ID válido');
  }
  const filters = {};
  if (query.productoId !== undefined) filters.productoId = query.productoId.trim();
  if (query.stockBajo !== undefined) filters.stockBajo = parseInteger(query.stockBajo, 'stockBajo');
  return {
    filters,
    pagination: {
      page: parseInteger(query.page, 'page', { fallback: 1, min: 1 }),
      limit: parseInteger(query.limit, 'limit', { fallback: 20, min: 1, max: MAX_PAGE_SIZE })
    }
  };
}

function parseMovementQuery(query) {
  const allowed = ['tipo', 'page', 'limit'];
  if (Object.keys(query).some((key) => !allowed.includes(key))) {
    throw AppError.solicitudInvalida('La consulta contiene parámetros no permitidos');
  }
  if (query.tipo !== undefined && (typeof query.tipo !== 'string' || !MOVEMENT_TYPES.includes(query.tipo))) {
    throw AppError.solicitudInvalida('El filtro tipo no es válido');
  }
  return {
    tipo: query.tipo,
    page: parseInteger(query.page, 'page', { fallback: 1, min: 1 }),
    limit: parseInteger(query.limit, 'limit', { fallback: 20, min: 1, max: MAX_PAGE_SIZE })
  };
}

function createAdminStockController(service) {
  return {
    list: asyncHandler(async (req, res) => {
      const { filters, pagination } = parseInventoryQuery(req.query);
      res.json(await service.listInventory(filters, pagination));
    }),

    detail: asyncHandler(async (req, res) => {
      res.json(await service.getInventory(req.params.variantId));
    }),

    movements: asyncHandler(async (req, res) => {
      res.json(await service.listMovements(req.params.variantId, parseMovementQuery(req.query)));
    }),

    adjust: asyncHandler(async (req, res) => {
      if (!req.auth?.sub) throw AppError.noAutorizado('Autenticación requerida');
      const result = await service.adjustStock(req.params.variantId, req.body, req.auth.sub);
      res.status(result.idempotente ? 200 : 201).json(result);
    })
  };
}

module.exports = { createAdminStockController, parseInventoryQuery, parseMovementQuery };
