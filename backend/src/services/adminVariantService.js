const mongoose = require('mongoose');
const AppError = require('../utils/AppError');
const { canonicalCombinationKey } = require('../utils/variantCombination');
const { parsePrice, validateObjectId } = require('./adminProductService');

function invalid(message) { throw AppError.solicitudInvalida(message); }
function ensureObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid('El cuerpo debe ser un objeto JSON');
}
function rejectUnexpectedFields(value, allowed) {
  if (Object.keys(value).some((key) => !allowed.includes(key))) invalid('El cuerpo contiene campos no permitidos');
}
function runQuery(query, { sort, session } = {}) {
  if (sort && query && typeof query.sort === 'function') query = query.sort(sort);
  if (session && query && typeof query.session === 'function') query = query.session(session);
  if (query && typeof query.lean === 'function') query = query.lean();
  return query && typeof query.exec === 'function' ? query.exec() : query;
}
function decimalString(value) { return value == null ? null : String(value); }
function sortedIds(ids) { return ids.map(String).sort(); }
function sameCombination(left, right) {
  const a = sortedIds(left);
  const b = sortedIds(right);
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

function createAdminVariantService(models, { startSession = () => mongoose.startSession() } = {}) {
  const { Producto, Variante, Atributo, ValorAtributo, ValorVariante, ItemPedido, ReservaStock, MovimientoStock } = models;

  async function withTransaction(operation) {
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
    validateObjectId(productId, 'productId');
    const product = await runQuery(Producto.findById(productId), { session });
    if (!product) throw AppError.noEncontrado('Producto no encontrado');
    return product;
  }

  async function requireVariant(productId, variantId, session) {
    validateObjectId(variantId, 'variantId');
    const variant = await runQuery(Variante.findOne({ _id: variantId, productoId: productId }), { session });
    if (!variant) throw AppError.noEncontrado('Variante no encontrada para ese producto');
    return variant;
  }

  function parseAttributePairs(values) {
    if (!Array.isArray(values) || values.length === 0) invalid('La variante debe tener al menos un valor de atributo');
    const pairs = values.map((pair) => {
      ensureObject(pair);
      rejectUnexpectedFields(pair, ['atributoId', 'valorAtributoId']);
      if (Object.keys(pair).length !== 2) invalid('Cada valor debe incluir atributoId y valorAtributoId');
      return {
        atributoId: validateObjectId(pair.atributoId, 'atributoId').toLowerCase(),
        valorAtributoId: validateObjectId(pair.valorAtributoId, 'valorAtributoId').toLowerCase()
      };
    });
    const attributeIds = pairs.map((pair) => pair.atributoId);
    const valueIds = pairs.map((pair) => pair.valorAtributoId);
    if (new Set(attributeIds).size !== attributeIds.length) invalid('No se permiten dos valores del mismo atributo en una variante');
    if (new Set(valueIds).size !== valueIds.length) invalid('No se puede repetir un valor de atributo');
    return pairs;
  }

  async function validateAttributePairs(pairs, session) {
    const attributeIds = [...new Set(pairs.map((pair) => pair.atributoId))];
    const valueIds = [...new Set(pairs.map((pair) => pair.valorAtributoId))];
    const [attributes, values] = await Promise.all([
      runQuery(Atributo.find({ _id: { $in: attributeIds } }), { session }),
      runQuery(ValorAtributo.find({ _id: { $in: valueIds } }), { session })
    ]);
    if (attributes.length !== attributeIds.length) throw AppError.noEncontrado('Atributo no encontrado');
    if (values.length !== valueIds.length) throw AppError.noEncontrado('Valor de atributo no encontrado');
    const attributeSet = new Set(attributes.map((attribute) => String(attribute._id)));
    const valueById = new Map(values.map((value) => [String(value._id), value]));
    for (const pair of pairs) {
      if (!attributeSet.has(pair.atributoId)) throw AppError.noEncontrado('Atributo no encontrado');
      const value = valueById.get(pair.valorAtributoId);
      if (String(value.atributoId) !== pair.atributoId) {
        invalid('El valor indicado no pertenece al atributo correspondiente');
      }
    }
    return pairs.map((pair) => valueById.get(pair.valorAtributoId));
  }

  async function currentValueIds(variantId, session) {
    const links = await runQuery(ValorVariante.find({ varianteId: variantId }), { session });
    return links.map((link) => String(link.valorAtributoId));
  }

  async function currentCombinationKey(variantId, session) {
    const valueIds = await currentValueIds(variantId, session);
    const values = valueIds.length
      ? await runQuery(ValorAtributo.find({ _id: { $in: valueIds } }), { session })
      : [];
    if (values.length !== valueIds.length) {
      throw AppError.conflicto('La variante tiene relaciones de atributos incompletas');
    }
    return canonicalCombinationKey(values.map((value) => ({
      atributoId: value.atributoId,
      valorAtributoId: value._id
    })));
  }

  async function findDuplicateCombination(productId, combinationKey, excludeVariantId = null, session) {
    const variants = await runQuery(Variante.find({ productoId: productId }), { session });
    for (const variant of variants) {
      if (excludeVariantId && String(variant._id) === String(excludeVariantId)) continue;
      // Una variante inactiva puede conservar el historial mientras otra activa la reemplaza.
      if (variant.activa === false) continue;
      if (await currentCombinationKey(variant._id, session) === combinationKey) return variant;
    }
    return null;
  }

  async function withTransactionAndUniqueConflict(operation) {
    try {
      return await withTransaction(operation);
    } catch (error) {
      if (error && (error.code === 11000 || error.codeName === 'DuplicateKey')) {
        throw AppError.conflicto('Ya existe esa combinación de atributos para el producto');
      }
      throw error;
    }
  }

  async function hasHistoricalReferences(variantId, session) {
    const id = new mongoose.Types.ObjectId(String(variantId));
    const queryOptions = session ? { session } : undefined;
    const [items, reservations, movements] = await Promise.all([
      ItemPedido.countDocuments({ varianteId: id }, queryOptions),
      ReservaStock.countDocuments({ varianteId: id }, queryOptions),
      MovimientoStock.countDocuments({ varianteId: id }, queryOptions)
    ]);
    return items > 0 || reservations > 0 || movements > 0;
  }

  async function describeVariants(productId, variants, session) {
    const ids = variants.map((variant) => variant._id);
    const links = ids.length
      ? await runQuery(ValorVariante.find({ varianteId: { $in: ids } }), { session })
      : [];
    const valueIds = [...new Set(links.map((link) => String(link.valorAtributoId)))];
    const values = valueIds.length
      ? await runQuery(ValorAtributo.find({ _id: { $in: valueIds } }), { session })
      : [];
    const attrIds = [...new Set(values.map((value) => String(value.atributoId)))];
    const attributes = attrIds.length
      ? await runQuery(Atributo.find({ _id: { $in: attrIds } }), { session })
      : [];
    const valueById = new Map(values.map((value) => [String(value._id), value]));
    const attrById = new Map(attributes.map((attribute) => [String(attribute._id), attribute]));
    const byVariant = new Map();
    for (const link of links) {
      const value = valueById.get(String(link.valorAtributoId));
      const attribute = value && attrById.get(String(value.atributoId));
      if (!value || !attribute) continue;
      const key = String(link.varianteId);
      byVariant.set(key, [...(byVariant.get(key) || []), {
        atributoId: String(attribute._id), atributo: attribute.nombre,
        valorAtributoId: String(value._id), valor: value.valor
      }]);
    }
    return {
      productoId: String(productId),
      variantes: variants.map((variant) => ({
        id: String(variant._id), precio: decimalString(variant.precio), stock: variant.stock,
        activa: variant.activa, valores: byVariant.get(String(variant._id)) || [],
        creadoEn: variant.createdAt, actualizadoEn: variant.updatedAt
      }))
    };
  }

  async function listVariants(productId) {
    await requireProduct(productId);
    const variants = await runQuery(Variante.find({ productoId: productId }), { sort: { createdAt: 1, _id: 1 } });
    return describeVariants(productId, variants);
  }

  async function createVariant(productId, input) {
    validateObjectId(productId, 'productId');
    ensureObject(input);
    rejectUnexpectedFields(input, ['valores', 'precio', 'activa']);
    const pairs = parseAttributePairs(input.valores);
    const price = input.precio === undefined || input.precio === null ? null : parsePrice(input.precio);
    const active = input.activa === undefined ? true : input.activa;
    if (typeof active !== 'boolean') invalid('El campo activa debe ser booleano');

    return withTransactionAndUniqueConflict(async (session) => {
      await requireProduct(productId, session);
      const values = await validateAttributePairs(pairs, session);
      const actualKey = canonicalCombinationKey(values.map((value) => ({
        atributoId: value.atributoId,
        valorAtributoId: value._id
      })));
      if (active && await findDuplicateCombination(productId, actualKey, null, session)) {
        throw AppError.conflicto('Ya existe esa combinación de atributos para el producto');
      }
      const [variant] = await Variante.create([{
        productoId: productId, precio: price, activa: active,
        combinacionClave: actualKey
      }], { session });
      await ValorVariante.create(values.map((value) => ({ varianteId: variant._id, valorAtributoId: value._id })), { session });
      const variants = await runQuery(Variante.find({ _id: variant._id, productoId: productId }), { session });
      return describeVariants(productId, variants, session).then((result) => result.variantes[0]);
    });
  }

  async function updateVariant(productId, variantId, input) {
    validateObjectId(productId, 'productId');
    validateObjectId(variantId, 'variantId');
    ensureObject(input);
    rejectUnexpectedFields(input, ['valores', 'precio', 'activa']);
    if (Object.keys(input).length === 0) invalid('Debe enviar al menos un campo para editar');
    const pairs = Object.hasOwn(input, 'valores') ? parseAttributePairs(input.valores) : null;
    const price = Object.hasOwn(input, 'precio') ? (input.precio === null ? null : parsePrice(input.precio)) : undefined;
    if (Object.hasOwn(input, 'activa') && typeof input.activa !== 'boolean') invalid('El campo activa debe ser booleano');

    return withTransactionAndUniqueConflict(async (session) => {
      await requireProduct(productId, session);
      const variant = await requireVariant(productId, variantId, session);
      const update = {};
      if (price !== undefined) update.precio = price;
      if (Object.hasOwn(input, 'activa')) update.activa = input.activa;

      let nextValues;
      if (pairs) {
        nextValues = await validateAttributePairs(pairs, session);
        const nextValueIds = nextValues.map((value) => String(value._id));
        const previousValueIds = await currentValueIds(variantId, session);
        if (!sameCombination(previousValueIds, nextValueIds)) {
          if (await hasHistoricalReferences(variantId, session)) {
            throw AppError.conflicto('La variante tiene pedidos, reservas o movimientos; desactívela y cree otra para cambiar su combinación');
          }
          await ValorVariante.deleteMany({ varianteId: variantId }, { session });
          await ValorVariante.create(nextValues.map((value) => ({ varianteId: variantId, valorAtributoId: value._id })), { session });
        }
      } else {
        const currentIds = await currentValueIds(variantId, session);
        const valueDocs = currentIds.length
          ? await runQuery(ValorAtributo.find({ _id: { $in: currentIds } }), { session })
          : [];
        if (valueDocs.length !== currentIds.length) {
          throw AppError.conflicto('La variante tiene relaciones de atributos incompletas');
        }
        nextValues = valueDocs;
      }

      const combinationKey = canonicalCombinationKey(nextValues.map((value) => ({
        atributoId: value.atributoId,
        valorAtributoId: value._id
      })));
      const willBeActive = Object.hasOwn(input, 'activa') ? input.activa : variant.activa !== false;
      if (willBeActive && await findDuplicateCombination(productId, combinationKey, variantId, session)) {
        throw AppError.conflicto('Ya existe esa combinación de atributos para el producto');
      }
      // Se actualiza incluso para documentos heredados sin clave. La clave y
      // las relaciones de atributos quedan dentro de la misma transacción.
      update.combinacionClave = combinationKey;

      const updated = await Variante.findByIdAndUpdate(variantId, update, { new: true, runValidators: true, session });
      if (!updated) throw AppError.noEncontrado('Variante no encontrada');
      const variants = await runQuery(Variante.find({ _id: variantId, productoId: productId }), { session });
      return describeVariants(productId, variants, session).then((result) => result.variantes[0]);
    });
  }

  return { listVariants, createVariant, updateVariant };
}

module.exports = { createAdminVariantService, sameCombination };
