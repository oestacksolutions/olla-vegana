const mongoose = require('mongoose');
const AppError = require('../utils/AppError');

const MAX_PRICE = 99999999.99;

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
function parsePrice(value) {
  if ((typeof value !== 'string' && typeof value !== 'number') || !/^\d+(\.\d{1,2})?$/.test(String(value).trim())) {
    invalid('El precio base debe ser un importe decimal válido');
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > MAX_PRICE) invalid('El precio base debe ser mayor o igual a cero');
  return mongoose.Types.Decimal128.fromString(number.toFixed(2));
}
function optionalBoolean(data, field, fallback) {
  if (!Object.hasOwn(data, field)) return fallback;
  if (typeof data[field] !== 'boolean') invalid(`El campo ${field} debe ser booleano`);
  return data[field];
}
function query(value, { sort } = {}) {
  if (sort && value && typeof value.sort === 'function') value = value.sort(sort);
  if (value && typeof value.lean === 'function') value = value.lean();
  return value;
}
function decimalString(value) { return value == null ? null : value.toString(); }

function createAdminProductService(models) {
  const { Producto, Categoria, Variante, ValorVariante, ValorAtributo, Atributo } = models;

  async function requireActiveCategory(categoriaId) {
    const category = await query(Categoria.findOne({ _id: categoriaId, activa: true }));
    if (!category) throw AppError.noEncontrado('Categoría activa no encontrada');
    return category;
  }

  async function hydrateProduct(product) {
    const [category, variants] = await Promise.all([
      query(Categoria.findOne({ _id: product.categoriaId })),
      query(Variante.find({ productoId: product._id }), { sort: { _id: 1 } })
    ]);
    const variantIds = variants.map((variant) => variant._id);
    const links = variantIds.length ? await query(ValorVariante.find({ varianteId: { $in: variantIds } })) : [];
    const valueIds = [...new Set(links.map((link) => String(link.valorAtributoId)))];
    const values = valueIds.length ? await query(ValorAtributo.find({ _id: { $in: valueIds } })) : [];
    const attributeIds = [...new Set(values.map((value) => String(value.atributoId)))];
    const attributes = attributeIds.length ? await query(Atributo.find({ _id: { $in: attributeIds } })) : [];
    const valueById = new Map(values.map((value) => [String(value._id), value]));
    const attrById = new Map(attributes.map((attribute) => [String(attribute._id), attribute]));
    const linksByVariant = new Map();
    for (const link of links) linksByVariant.set(String(link.varianteId), [...(linksByVariant.get(String(link.varianteId)) || []), link]);

    return {
      id: String(product._id), nombre: product.nombre, slug: product.slug, descripcion: product.descripcion,
      precioBase: decimalString(product.precioBase), activo: product.activo, destacado: product.destacado,
      categoriaId: String(product.categoriaId),
      categoria: category ? { id: String(category._id), nombre: category.nombre, slug: category.slug } : null,
      variantes: variants.map((variant) => ({
        id: String(variant._id), precio: decimalString(variant.precio), stock: variant.stock, activa: variant.activa,
        valores: (linksByVariant.get(String(variant._id)) || []).map((link) => valueById.get(String(link.valorAtributoId)))
          .filter(Boolean).map((value) => ({ valor: value.valor, atributo: attrById.get(String(value.atributoId))?.nombre }))
          .filter((value) => value.atributo)
      })),
      creadoEn: product.creadoEn || product.createdAt,
      actualizadoEn: product.actualizadoEn || product.updatedAt
    };
  }

  async function listProducts(filters = {}) {
    ensureObject(filters);
    rejectUnexpectedFields(filters, ['nombre', 'categoriaId', 'activo']);
    const where = {};
    if (filters.nombre !== undefined) {
      const name = requiredText(filters.nombre, 'nombre').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      where.nombre = { $regex: name, $options: 'i' };
    }
    if (filters.categoriaId !== undefined) where.categoriaId = requiredText(filters.categoriaId, 'categoriaId');
    if (filters.activo !== undefined) {
      if (typeof filters.activo !== 'boolean') invalid('El filtro activo debe ser booleano');
      where.activo = filters.activo;
    }
    const products = await query(Producto.find(where), { sort: { updatedAt: -1, actualizadoEn: -1, _id: 1 } });
    return Promise.all(products.map(hydrateProduct));
  }

  async function createProduct(input) {
    ensureObject(input);
    rejectUnexpectedFields(input, ['nombre', 'slug', 'descripcion', 'precioBase', 'categoriaId', 'activo', 'destacado']);
    const data = {
      nombre: requiredText(input.nombre, 'nombre'),
      slug: requiredText(input.slug, 'slug'),
      descripcion: requiredText(input.descripcion, 'descripcion'),
      precioBase: parsePrice(input.precioBase),
      categoriaId: requiredText(input.categoriaId, 'categoriaId'),
      activo: optionalBoolean(input, 'activo', true),
      destacado: optionalBoolean(input, 'destacado', false)
    };
    await requireActiveCategory(data.categoriaId);
    if (await query(Producto.findOne({ slug: data.slug }))) throw AppError.conflicto('Ya existe un producto con ese slug');
    try {
      return await hydrateProduct(await Producto.create(data));
    } catch (error) {
      if (error && error.code === 11000) throw AppError.conflicto('Ya existe un producto con ese slug');
      throw error;
    }
  }

  async function updateProduct(id, input) {
    ensureObject(input);
    rejectUnexpectedFields(input, ['nombre', 'descripcion', 'precioBase', 'categoriaId', 'destacado']);
    if (Object.keys(input).length === 0) invalid('Debe enviar al menos un campo para editar');
    const data = {};
    if (Object.hasOwn(input, 'nombre')) data.nombre = requiredText(input.nombre, 'nombre');
    if (Object.hasOwn(input, 'descripcion')) data.descripcion = requiredText(input.descripcion, 'descripcion');
    if (Object.hasOwn(input, 'precioBase')) data.precioBase = parsePrice(input.precioBase);
    if (Object.hasOwn(input, 'categoriaId')) {
      data.categoriaId = requiredText(input.categoriaId, 'categoriaId');
      await requireActiveCategory(data.categoriaId);
    }
    if (Object.hasOwn(input, 'destacado')) {
      if (typeof input.destacado !== 'boolean') invalid('El campo destacado debe ser booleano');
      data.destacado = input.destacado;
    }
    const product = await Producto.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!product) throw AppError.noEncontrado('Producto no encontrado');
    return hydrateProduct(product);
  }

  async function setVisibility(id, activo) {
    if (typeof activo !== 'boolean') invalid('El campo activo debe ser booleano');
    const product = await Producto.findByIdAndUpdate(id, { activo }, { new: true, runValidators: true });
    if (!product) throw AppError.noEncontrado('Producto no encontrado');
    return hydrateProduct(product);
  }

  return { listProducts, createProduct, updateProduct, setVisibility };
}

module.exports = { createAdminProductService, parsePrice };
