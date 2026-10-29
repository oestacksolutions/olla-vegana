const mongoose = require('mongoose');
const AppError = require('../utils/AppError');

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

function invalid(message) { throw AppError.solicitudInvalida(message); }

function ensureObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid('El cuerpo debe ser un objeto JSON');
}

function rejectUnexpectedFields(data, allowed) {
  if (Object.keys(data).some((field) => !allowed.includes(field))) invalid('El cuerpo contiene campos no permitidos');
}

function requiredText(value, field) {
  if (typeof value !== 'string' || !value.trim()) invalid(`El campo ${field} es obligatorio`);
  return value.trim();
}

function validateObjectId(id, field = 'id') {
  if (typeof id !== 'string' || !OBJECT_ID_PATTERN.test(id) || !mongoose.isValidObjectId(id)) {
    invalid(`El campo ${field} no es un ID válido`);
  }
  return id;
}

function runQuery(value, { sort, select } = {}) {
  if (sort && value && typeof value.sort === 'function') value = value.sort(sort);
  if (select && value && typeof value.select === 'function') value = value.select(select);
  if (value && typeof value.lean === 'function') value = value.lean();
  return value && typeof value.exec === 'function' ? value.exec() : value;
}

function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function createAdminCategoryService({ Categoria, Producto }) {
  async function getByIdOr404(id) {
    validateObjectId(id);
    const category = await runQuery(Categoria.findOne({ _id: id }));
    if (!category) throw AppError.noEncontrado('Categoría no encontrada');
    return category;
  }

  async function validateParent(padreId, categoryId = null) {
    if (padreId == null) return null;
    validateObjectId(padreId, 'padreId');
    if (categoryId && String(padreId) === String(categoryId)) invalid('Una categoría no puede ser su propia categoría padre');

    let current = await getByIdOr404(padreId);
    const visited = new Set();
    while (current) {
      const currentId = String(current._id);
      if (categoryId && currentId === String(categoryId)) invalid('La relación generaría una referencia circular');
      if (visited.has(currentId)) throw AppError.conflicto('La jerarquía de categorías ya contiene una referencia circular');
      visited.add(currentId);
      if (current.padreId == null) break;
      current = await getByIdOr404(String(current.padreId));
    }
    return padreId;
  }

  async function serializeCategory(category, { includeChildren = false } = {}) {
    const [parent, productos, children] = await Promise.all([
      category.padreId ? runQuery(Categoria.findOne({ _id: category.padreId }), { select: '_id nombre slug' }) : null,
      Producto.countDocuments({ categoriaId: category._id }),
      includeChildren ? runQuery(Categoria.find({ padreId: category._id }), { sort: { nombre: 1, _id: 1 } }) : []
    ]);
    return {
      id: String(category._id),
      nombre: category.nombre,
      slug: category.slug,
      descripcion: category.descripcion ?? null,
      activa: category.activa,
      padre: parent ? { id: String(parent._id), nombre: parent.nombre, slug: parent.slug } : null,
      cantidadProductos: productos,
      subcategorias: children.map((child) => ({ id: String(child._id), nombre: child.nombre, slug: child.slug, activa: child.activa })),
      creadoEn: category.createdAt || category.creadoEn,
      actualizadoEn: category.updatedAt || category.actualizadoEn
    };
  }

  async function listCategories(filters = {}) {
    ensureObject(filters);
    rejectUnexpectedFields(filters, ['nombre', 'activa']);
    const where = {};
    if (filters.nombre !== undefined) {
      const name = requiredText(filters.nombre, 'nombre');
      where.nombre = { $regex: escapeRegex(name), $options: 'i' };
    }
    if (filters.activa !== undefined) {
      if (typeof filters.activa !== 'boolean') invalid('El filtro activa debe ser booleano');
      where.activa = filters.activa;
    }
    const categories = await runQuery(Categoria.find(where), { sort: { nombre: 1, _id: 1 } });
    return Promise.all(categories.map((category) => serializeCategory(category)));
  }

  async function getCategoryById(id) {
    const category = await getByIdOr404(id);
    return serializeCategory(category, { includeChildren: true });
  }

  async function createCategory(input) {
    ensureObject(input);
    rejectUnexpectedFields(input, ['nombre', 'slug', 'activa', 'padreId']);
    const data = {
      nombre: requiredText(input.nombre, 'nombre'),
      slug: requiredText(input.slug, 'slug'),
      activa: input.activa === undefined ? true : input.activa,
      padreId: input.padreId === undefined ? null : input.padreId
    };
    if (typeof data.activa !== 'boolean') invalid('El campo activa debe ser booleano');
    data.padreId = await validateParent(data.padreId);
    if (await runQuery(Categoria.findOne({ slug: data.slug }))) throw AppError.conflicto('Ya existe una categoría con ese slug');
    try {
      const category = await Categoria.create(data);
      return serializeCategory(category, { includeChildren: true });
    } catch (error) {
      if (error && error.code === 11000) throw AppError.conflicto('Ya existe una categoría con ese slug');
      throw error;
    }
  }

  async function updateCategory(id, input) {
    validateObjectId(id);
    ensureObject(input);
    rejectUnexpectedFields(input, ['nombre', 'slug', 'activa', 'padreId']);
    if (Object.keys(input).length === 0) invalid('Debe enviar al menos un campo para editar');
    const existing = await getByIdOr404(id);
    const data = {};
    if (Object.hasOwn(input, 'nombre')) data.nombre = requiredText(input.nombre, 'nombre');
    if (Object.hasOwn(input, 'slug')) {
      data.slug = requiredText(input.slug, 'slug');
      if (await runQuery(Categoria.findOne({ slug: data.slug, _id: { $ne: id } }))) {
        throw AppError.conflicto('Ya existe una categoría con ese slug');
      }
    }
    if (Object.hasOwn(input, 'activa')) {
      if (typeof input.activa !== 'boolean') invalid('El campo activa debe ser booleano');
      data.activa = input.activa;
    }
    if (Object.hasOwn(input, 'padreId')) data.padreId = await validateParent(input.padreId, id);

    try {
      const category = await Categoria.findByIdAndUpdate(id, data, { new: true, runValidators: true });
      if (!category) throw AppError.noEncontrado('Categoría no encontrada');
      return serializeCategory(category, { includeChildren: true });
    } catch (error) {
      if (error && error.code === 11000) throw AppError.conflicto('Ya existe una categoría con ese slug');
      throw error;
    }
  }

  return { listCategories, getCategoryById, createCategory, updateCategory };
}

module.exports = { createAdminCategoryService, validateObjectId };
