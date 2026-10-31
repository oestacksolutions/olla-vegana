const mongoose = require('mongoose');
const AppError = require('../utils/AppError');
const { validateObjectId } = require('./adminProductService');
const { calculateStockAvailability, logStockInconsistency } = require('../utils/stockAvailability');
const eventLogger = require('../utils/observability');

const MAX_PAGE_SIZE = 100;
const MOVEMENT_TYPES = ['INGRESO', 'AJUSTE', 'VENTA', 'DEVOLUCION'];
const OPERATION_INDEX_NAME = 'uniq_movimiento_id_operacion';

function invalid(message) { throw AppError.solicitudInvalida(message); }

function runQuery(query, { sort, skip, limit, session, select } = {}) {
  if (sort && query && typeof query.sort === 'function') query = query.sort(sort);
  if (skip !== undefined && query && typeof query.skip === 'function') query = query.skip(skip);
  if (limit !== undefined && query && typeof query.limit === 'function') query = query.limit(limit);
  if (session && query && typeof query.session === 'function') query = query.session(session);
  if (select && query && typeof query.select === 'function') query = query.select(select);
  if (query && typeof query.lean === 'function') query = query.lean();
  return query && typeof query.exec === 'function' ? query.exec() : query;
}

function serializeMovement(movement) {
  return {
    id: String(movement._id),
    varianteId: String(movement.varianteId),
    tipo: movement.tipo,
    cantidad: movement.cantidad,
    stockAnterior: movement.stockAnterior ?? null,
    stockResultante: movement.stockResultante ?? null,
    motivo: movement.motivo ?? null,
    adminId: movement.adminId ? String(movement.adminId) : null,
    idOperacion: movement.idOperacion ?? null,
    creadoEn: movement.creadoEn
  };
}

function createAdminStockService(models, {
  startSession = () => mongoose.startSession(),
  ahora = () => new Date(),
  lowStockThreshold = 5,
  logger = (entry) => eventLogger.warn('inventory.inconsistency', entry),
  monitoring = eventLogger
} = {}) {
  const { Producto, Variante, MovimientoStock, ReservaStock, ValorVariante, ValorAtributo, Atributo } = models;

  async function requireOperationIndex() {
    try {
      const indexes = await MovimientoStock.collection.indexes();
      const index = indexes.find((candidate) => candidate.name === OPERATION_INDEX_NAME);
      const partial = index?.partialFilterExpression?.idOperacion;
      if (
        !index?.unique
        || index.key?.idOperacion !== 1
        || partial?.$type !== 'string'
      ) throw new Error('required index missing');
    } catch {
      throw new AppError('Los ajustes están temporalmente deshabilitados hasta provisionar el índice de idempotencia', 503);
    }
  }

  async function transaction(operation) {
    const session = await startSession();
    try {
      let result;
      await session.withTransaction(async () => { result = await operation(session); });
      return result;
    } finally {
      await session.endSession();
    }
  }

  async function requireProduct(productId, session) {
    validateObjectId(productId, 'productoId');
    const product = await runQuery(Producto.findById(productId), { session });
    if (!product) throw AppError.noEncontrado('Producto no encontrado');
    return product;
  }

  async function requireVariant(variantId, session) {
    validateObjectId(variantId, 'variantId');
    const variant = await runQuery(Variante.findById(variantId), { session });
    if (!variant) throw AppError.noEncontrado('Variante no encontrada');
    return variant;
  }

  async function describeVariants(variants, { session, now = ahora() } = {}) {
    if (!variants.length) return [];
    const variantIds = variants.map((variant) => variant._id);
    const productIds = [...new Set(variants.map((variant) => String(variant.productoId)))];
    const [products, links, reservations] = await Promise.all([
      runQuery(Producto.find({ _id: { $in: productIds } }), { session }),
      runQuery(ValorVariante.find({ varianteId: { $in: variantIds } }), { session }),
      runQuery(ReservaStock.find({ varianteId: { $in: variantIds }, estado: 'ACTIVA' }), { session })
    ]);
    const valueIds = [...new Set(links.map((link) => String(link.valorAtributoId)))];
    const values = valueIds.length
      ? await runQuery(ValorAtributo.find({ _id: { $in: valueIds } }), { session })
      : [];
    const attributeIds = [...new Set(values.map((value) => String(value.atributoId)))];
    const attributes = attributeIds.length
      ? await runQuery(Atributo.find({ _id: { $in: attributeIds } }), { session })
      : [];

    const productById = new Map(products.map((product) => [String(product._id), product]));
    const valueById = new Map(values.map((value) => [String(value._id), value]));
    const attributeById = new Map(attributes.map((attribute) => [String(attribute._id), attribute]));
    const linksByVariant = new Map();
    const reservationsByVariant = new Map();
    for (const link of links) {
      const key = String(link.varianteId);
      linksByVariant.set(key, [...(linksByVariant.get(key) || []), link]);
    }
    for (const reservation of reservations) {
      const key = String(reservation.varianteId);
      reservationsByVariant.set(key, [...(reservationsByVariant.get(key) || []), reservation]);
    }

    return variants.map((variant) => {
      const id = String(variant._id);
      const availability = calculateStockAvailability(variant.stock, reservationsByVariant.get(id), now);
      logStockInconsistency(id, availability, logger);
      const product = productById.get(String(variant.productoId));
      const variantValues = (linksByVariant.get(id) || []).map((link) => valueById.get(String(link.valorAtributoId)))
        .filter(Boolean)
        .map((value) => ({
          atributoId: String(value.atributoId),
          atributo: attributeById.get(String(value.atributoId))?.nombre || null,
          valorAtributoId: String(value._id),
          valor: value.valor
        }));
      return {
        producto: product ? { id: String(product._id), nombre: product.nombre, slug: product.slug } : null,
        variante: { id, activa: variant.activa !== false, valores: variantValues },
        stockFisico: availability.stockFisico,
        cantidadReservada: availability.cantidadReservada,
        stockDisponible: availability.stockDisponible,
        inconsistente: availability.inconsistente,
        alertas: availability.inconsistencias
      };
    });
  }

  async function listInventory(filters = {}, pagination = {}) {
    const { productoId, stockBajo } = filters;
    const { page = 1, limit = 20 } = pagination;
    if (!Number.isSafeInteger(page) || page < 1) invalid('La paginación solicitada no es válida');
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) invalid('El límite de página no es válido');
    if (!Number.isSafeInteger((page - 1) * limit)) invalid('La paginación solicitada no es válida');

    const where = {};
    if (productoId !== undefined) {
      await requireProduct(productoId);
      where.productoId = productoId;
    }

    let variants;
    let total;
    if (stockBajo !== undefined) {
      if (!Number.isSafeInteger(stockBajo) || stockBajo < 0) invalid('stockBajo debe ser un entero no negativo');
      const aggregateWhere = productoId
        ? { productoId: new mongoose.Types.ObjectId(productoId) }
        : {};
      const [result] = await Variante.aggregate([
        { $match: aggregateWhere },
        { $lookup: {
          from: ReservaStock.collection.name,
          let: { variantId: '$_id' },
          pipeline: [
            { $match: { $expr: { $and: [
              { $eq: ['$varianteId', '$$variantId'] },
              { $eq: ['$estado', 'ACTIVA'] },
              { $gt: ['$venceEn', ahora()] }
            ] } } },
            { $group: { _id: null, cantidad: { $sum: '$cantidad' } } }
          ],
          as: 'reservasActuales'
        } },
        { $addFields: { __reservado: { $ifNull: [{ $arrayElemAt: ['$reservasActuales.cantidad', 0] }, 0] } } },
        { $addFields: { __disponible: { $max: [0, { $subtract: [
          { $max: [0, { $ifNull: ['$stock', 0] }] }, '$__reservado'
        ] }] } } },
        { $match: { __disponible: { $lte: stockBajo } } },
        { $facet: {
          metadata: [{ $count: 'total' }],
          rows: [{ $sort: { productoId: 1, _id: 1 } }, { $skip: (page - 1) * limit }, { $limit: limit }]
        } }
      ]);
      variants = result?.rows || [];
      total = result?.metadata?.[0]?.total || 0;
    } else {
      [variants, total] = await Promise.all([
        runQuery(Variante.find(where), { sort: { productoId: 1, _id: 1 }, skip: (page - 1) * limit, limit }),
        Variante.countDocuments(where)
      ]);
    }

    return {
      inventario: await describeVariants(variants),
      umbralStockBajo: lowStockThreshold,
      paginacion: { pagina: page, limite: limit, total, paginas: Math.ceil(total / limit) }
    };
  }

  async function getInventory(variantId) {
    const variant = await requireVariant(variantId);
    return (await describeVariants([variant]))[0];
  }

  async function listMovements(variantId, { tipo, page = 1, limit = 20 } = {}) {
    await requireVariant(variantId);
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
      invalid('La paginación solicitada no es válida');
    }
    if (tipo !== undefined && !MOVEMENT_TYPES.includes(tipo)) invalid('El tipo de movimiento no es válido');
    const where = { varianteId: variantId };
    if (tipo) where.tipo = tipo;
    const [movements, total] = await Promise.all([
      runQuery(MovimientoStock.find(where), {
        sort: { creadoEn: -1, _id: -1 }, skip: (page - 1) * limit, limit
      }),
      MovimientoStock.countDocuments(where)
    ]);
    return {
      movimientos: movements.map(serializeMovement),
      paginacion: { pagina: page, limite: limit, total, paginas: Math.ceil(total / limit) }
    };
  }

  function normalizeAdjustment(variantId, input, adminId) {
    validateObjectId(variantId, 'variantId');
    if (!input || typeof input !== 'object' || Array.isArray(input)) invalid('El cuerpo debe ser un objeto JSON');
    const allowed = ['tipo', 'cantidad', 'motivo', 'idOperacion'];
    if (Object.keys(input).some((key) => !allowed.includes(key))) invalid('El cuerpo contiene campos no permitidos');
    if (!['INGRESO', 'AJUSTE'].includes(input.tipo)) invalid('Solo se permiten movimientos de tipo INGRESO o AJUSTE');
    if (!Number.isSafeInteger(input.cantidad) || input.cantidad === 0) invalid('La cantidad debe ser un entero distinto de cero');
    if (input.tipo === 'INGRESO' && input.cantidad < 1) invalid('Un ingreso debe tener una cantidad positiva');
    if (typeof input.motivo !== 'string' || input.motivo.trim().length < 3 || input.motivo.trim().length > 500) {
      invalid('El motivo es obligatorio y debe tener entre 3 y 500 caracteres');
    }
    if (typeof input.idOperacion !== 'string' || !/^[\w.:-]{8,128}$/.test(input.idOperacion.trim())) {
      invalid('idOperacion debe tener entre 8 y 128 caracteres válidos');
    }
    if (adminId != null) validateObjectId(adminId, 'adminId');
    return {
      varianteId: variantId, tipo: input.tipo, cantidad: input.cantidad,
      motivo: input.motivo.trim(), idOperacion: input.idOperacion.trim(),
      adminId: adminId || null
    };
  }

  function sameOperation(movement, command) {
    return String(movement.varianteId) === String(command.varianteId)
      && movement.tipo === command.tipo
      && movement.cantidad === command.cantidad
      && movement.motivo === command.motivo
      && String(movement.adminId || '') === String(command.adminId || '');
  }

  async function existingOperation(command, session) {
    return runQuery(MovimientoStock.findOne({ idOperacion: command.idOperacion }), { session });
  }

  async function idempotentResponse(movement, command) {
    if (!sameOperation(movement, command)) {
      throw AppError.conflicto('idOperacion ya fue usada con datos diferentes');
    }
    return {
      movimiento: serializeMovement(movement),
      inventario: await getInventory(command.varianteId),
      idempotente: true
    };
  }

  async function adjustStock(variantId, input, adminId = null) {
    const command = normalizeAdjustment(variantId, input, adminId);
    await requireOperationIndex();
    try {
      const result = await transaction(async (session) => {
        const previous = await existingOperation(command, session);
        if (previous) return { duplicate: previous };

        const variant = await requireVariant(variantId, session);
        const stockBefore = Number(variant.stock);
        if (!Number.isSafeInteger(stockBefore)) {
          logStockInconsistency(variantId, calculateStockAvailability(variant.stock, [], ahora()), logger);
          throw AppError.conflicto('El stock físico de la variante requiere revisión antes del ajuste');
        }
        const reservations = await runQuery(ReservaStock.find({ varianteId: variantId, estado: 'ACTIVA' }), { session });
        const inventoryBefore = calculateStockAvailability(stockBefore, reservations, ahora());
        logStockInconsistency(variantId, inventoryBefore, logger);
        if (inventoryBefore.inconsistencias.some((code) => code === 'RESERVA_CANTIDAD_INVALIDA' || code === 'RESERVA_VENCIMIENTO_INVALIDO')) {
          throw AppError.conflicto('Las reservas de la variante requieren revisión antes del ajuste');
        }

        const stockAfter = stockBefore + command.cantidad;
        if (!Number.isSafeInteger(stockAfter) || stockAfter < 0) throw AppError.conflicto('El ajuste no puede dejar stock negativo');
        if (command.cantidad < 0 && stockAfter < inventoryBefore.cantidadReservada) {
          throw AppError.conflicto('No se puede reducir el stock por debajo de las reservas vigentes');
        }

        const updatedVariant = await Variante.findOneAndUpdate(
          { _id: variantId, stock: stockBefore },
          { $inc: { stock: command.cantidad } },
          { new: true, session }
        );
        if (!updatedVariant) throw AppError.conflicto('El stock cambió durante la operación; volvé a intentarlo');

        const [movement] = await MovimientoStock.create([{
          varianteId: variantId,
          tipo: command.tipo,
          cantidad: command.cantidad,
          motivo: command.motivo,
          stockAnterior: stockBefore,
          stockResultante: stockAfter,
          adminId: command.adminId,
          idOperacion: command.idOperacion,
          creadoEn: ahora()
        }], { session });
        return { movement };
      });

      if (result.duplicate) {
        monitoring.info('inventory.adjustment.idempotent_replay', { variantId: String(variantId), movementId: String(result.duplicate._id) });
        return idempotentResponse(result.duplicate, command);
      }
      monitoring.info('inventory.adjustment.recorded', {
        variantId: String(variantId), movementId: String(result.movement._id), type: result.movement.tipo,
        quantityDelta: result.movement.cantidad, stockResultante: result.movement.stockResultante,
        adminId: result.movement.adminId ? String(result.movement.adminId) : null
      });
      return {
        movimiento: serializeMovement(result.movement),
        inventario: await getInventory(variantId),
        idempotente: false
      };
    } catch (error) {
      if (error && error.code === 11000) {
        const previous = await existingOperation(command);
        if (previous) return idempotentResponse(previous, command);
      }
      throw error;
    }
  }

  return { listInventory, getInventory, listMovements, adjustStock };
}

module.exports = { createAdminStockService, serializeMovement, MAX_PAGE_SIZE, MOVEMENT_TYPES, OPERATION_INDEX_NAME };
