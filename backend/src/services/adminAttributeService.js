const mongoose = require('mongoose');
const AppError = require('../utils/AppError');

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

function invalid(message) { throw AppError.solicitudInvalida(message); }
function ensureObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid('El cuerpo debe ser un objeto JSON');
}
function rejectUnexpectedFields(value, allowed) {
  if (Object.keys(value).some((key) => !allowed.includes(key))) invalid('El cuerpo contiene campos no permitidos');
}
function requiredText(value, field) {
  if (typeof value !== 'string' || !value.trim()) invalid(`El campo ${field} es obligatorio`);
  return value.trim();
}
function validateId(id, field = 'id') {
  if (typeof id !== 'string' || !OBJECT_ID_PATTERN.test(id) || !mongoose.isValidObjectId(id)) {
    invalid(`El campo ${field} no es un ID válido`);
  }
  return id;
}
function runQuery(query, { sort } = {}) {
  if (sort && query && typeof query.sort === 'function') query = query.sort(sort);
  if (query && typeof query.lean === 'function') query = query.lean();
  return query && typeof query.exec === 'function' ? query.exec() : query;
}

function createAdminAttributeService({ Atributo, ValorAtributo, ValorVariante, ItemPedido, ReservaStock, MovimientoStock }) {
  async function assertUniqueIndexes() {
    try {
      const [attributeIndexes, valueIndexes] = await Promise.all([Atributo.collection.indexes(), ValorAtributo.collection.indexes()]);
      const attributeIndex = attributeIndexes.some((index) => index.unique === true && index.key?.nombre === 1);
      const valueIndex = valueIndexes.some((index) => index.unique === true && index.key?.atributoId === 1 && index.key?.valor === 1);
      if (!attributeIndex || !valueIndex) throw new Error('attribute uniqueness indexes missing');
    } catch {
      throw new AppError('La gestión de atributos está deshabilitada hasta verificar sus índices de unicidad', 503);
    }
  }

  async function getAttributeOr404(id) {
    validateId(id);
    const attribute = await runQuery(Atributo.findById(id));
    if (!attribute) throw AppError.noEncontrado('Atributo no encontrado');
    return attribute;
  }

  async function getValueOr404(id) {
    validateId(id);
    const value = await runQuery(ValorAtributo.findById(id));
    if (!value) throw AppError.noEncontrado('Valor de atributo no encontrado');
    return value;
  }

  async function variantIdsForAttributeValues(valueIds) {
    if (!valueIds.length) return [];
    const links = await runQuery(ValorVariante.find({ valorAtributoId: { $in: valueIds } }));
    return [...new Set(links.map((link) => String(link.varianteId)))];
  }

  async function hasHistoricalUse(variantIds) {
    if (!variantIds.length) return false;
    const ids = variantIds.map((id) => new mongoose.Types.ObjectId(id));
    const [items, reservations, movements] = await Promise.all([
      ItemPedido.countDocuments({ varianteId: { $in: ids } }),
      ReservaStock.countDocuments({ varianteId: { $in: ids } }),
      MovimientoStock.countDocuments({ varianteId: { $in: ids } })
    ]);
    return items > 0 || reservations > 0 || movements > 0;
  }

  async function listAttributes() {
    const attributes = await runQuery(Atributo.find({}), { sort: { nombre: 1, _id: 1 } });
    const ids = attributes.map((attribute) => attribute._id);
    const values = ids.length
      ? await runQuery(ValorAtributo.find({ atributoId: { $in: ids } }), { sort: { valor: 1, _id: 1 } })
      : [];
    const byAttribute = new Map();
    for (const value of values) {
      const key = String(value.atributoId);
      byAttribute.set(key, [...(byAttribute.get(key) || []), { id: String(value._id), valor: value.valor }]);
    }
    return attributes.map((attribute) => ({
      id: String(attribute._id), nombre: attribute.nombre,
      valores: byAttribute.get(String(attribute._id)) || [],
      creadoEn: attribute.createdAt, actualizadoEn: attribute.updatedAt
    }));
  }

  async function createAttribute(input) {
    ensureObject(input);
    rejectUnexpectedFields(input, ['nombre']);
    const data = { nombre: requiredText(input.nombre, 'nombre') };
    await assertUniqueIndexes();
    if (await runQuery(Atributo.findOne({ nombre: data.nombre }))) throw AppError.conflicto('Ya existe un atributo con ese nombre');
    try {
      const attribute = await Atributo.create(data);
      return { id: String(attribute._id), nombre: attribute.nombre, valores: [] };
    } catch (error) {
      if (error && error.code === 11000) throw AppError.conflicto('Ya existe un atributo con ese nombre');
      throw error;
    }
  }

  async function updateAttribute(id, input) {
    validateId(id);
    ensureObject(input);
    rejectUnexpectedFields(input, ['nombre']);
    const name = requiredText(input.nombre, 'nombre');
    await assertUniqueIndexes();
    const attribute = await getAttributeOr404(id);
    if (attribute.nombre !== name) {
      if (await runQuery(Atributo.findOne({ nombre: name, _id: { $ne: id } }))) {
        throw AppError.conflicto('Ya existe un atributo con ese nombre');
      }
      const values = await runQuery(ValorAtributo.find({ atributoId: id }));
      const variantIds = await variantIdsForAttributeValues(values.map((value) => value._id));
      if (await hasHistoricalUse(variantIds)) {
        throw AppError.conflicto('No se puede renombrar un atributo usado en pedidos, reservas o movimientos; cree un atributo nuevo');
      }
    }
    try {
      const updated = await Atributo.findByIdAndUpdate(id, { nombre: name }, { new: true, runValidators: true });
      if (!updated) throw AppError.noEncontrado('Atributo no encontrado');
      return { id: String(updated._id), nombre: updated.nombre, creadoEn: updated.createdAt, actualizadoEn: updated.updatedAt };
    } catch (error) {
      if (error && error.code === 11000) throw AppError.conflicto('Ya existe un atributo con ese nombre');
      throw error;
    }
  }

  async function listValues(attributeId) {
    validateId(attributeId, 'attributeId');
    const attribute = await getAttributeOr404(attributeId);
    const values = await runQuery(ValorAtributo.find({ atributoId: attribute._id }), { sort: { valor: 1, _id: 1 } });
    return values.map((value) => ({
      id: String(value._id), valor: value.valor, atributoId: String(value.atributoId), atributo: attribute.nombre,
      creadoEn: value.createdAt, actualizadoEn: value.updatedAt
    }));
  }

  async function createValue(attributeId, input) {
    validateId(attributeId, 'attributeId');
    ensureObject(input);
    rejectUnexpectedFields(input, ['valor']);
    const value = requiredText(input.valor, 'valor');
    await assertUniqueIndexes();
    const attribute = await getAttributeOr404(attributeId);
    const filter = { atributoId: attribute._id, valor: value };
    if (await runQuery(ValorAtributo.findOne(filter))) throw AppError.conflicto('Ese valor ya existe para el atributo');
    try {
      const created = await ValorAtributo.create(filter);
      return { id: String(created._id), atributoId: String(attribute._id), atributo: attribute.nombre, valor: created.valor };
    } catch (error) {
      if (error && error.code === 11000) throw AppError.conflicto('Ese valor ya existe para el atributo');
      throw error;
    }
  }

  async function updateValue(id, input) {
    validateId(id);
    ensureObject(input);
    rejectUnexpectedFields(input, ['valor']);
    const valueText = requiredText(input.valor, 'valor');
    await assertUniqueIndexes();
    const value = await getValueOr404(id);
    if (value.valor !== valueText) {
      const duplicate = await runQuery(ValorAtributo.findOne({
        atributoId: value.atributoId, valor: valueText, _id: { $ne: id }
      }));
      if (duplicate) throw AppError.conflicto('Ese valor ya existe para el atributo');
      const variantIds = await variantIdsForAttributeValues([value._id]);
      if (await hasHistoricalUse(variantIds)) {
        throw AppError.conflicto('No se puede renombrar un valor usado en pedidos, reservas o movimientos; cree un valor nuevo');
      }
    }
    try {
      const updated = await ValorAtributo.findByIdAndUpdate(id, { valor: valueText }, { new: true, runValidators: true });
      if (!updated) throw AppError.noEncontrado('Valor de atributo no encontrado');
      return { id: String(updated._id), atributoId: String(updated.atributoId), valor: updated.valor };
    } catch (error) {
      if (error && error.code === 11000) throw AppError.conflicto('Ese valor ya existe para el atributo');
      throw error;
    }
  }

  return { listAttributes, createAttribute, updateAttribute, listValues, createValue, updateValue };
}

module.exports = { createAdminAttributeService };
