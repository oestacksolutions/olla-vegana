const mongoose = require('mongoose');
const AppError = require('../utils/AppError');

const MAX_PRICE = 99999999.99;
const MAX_PAGE_SIZE = 100;
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

function parsePrice(value) {
  if ((typeof value !== 'string' && typeof value !== 'number') || !/^\d+(\.\d{1,2})?$/.test(String(value).trim())) {
    invalid('El precio base debe ser un importe decimal válido');
  }
  const normalized = String(value).trim();
  const number = Number(normalized);
  if (!Number.isFinite(number) || number < 0 || number > MAX_PRICE) invalid('El precio base debe ser mayor o igual a cero');
  return mongoose.Types.Decimal128.fromString(number.toFixed(2));
}

function optionalBoolean(data, field, fallback) {
  if (!Object.hasOwn(data, field)) return fallback;
  if (typeof data[field] !== 'boolean') invalid(`El campo ${field} debe ser booleano`);
  return data[field];
}

function validateObjectId(id, field = 'id') {
  if (typeof id !== 'string' || !OBJECT_ID_PATTERN.test(id) || !mongoose.isValidObjectId(id)) {
    invalid(`El campo ${field} no es un ID válido`);
  }
  return id;
}

function validatePagination(page, limit) {
  if (!Number.isInteger(page) || page < 1) invalid('La página debe ser un entero mayor que cero');
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
    invalid(`El límite debe ser un entero entre 1 y ${MAX_PAGE_SIZE}`);
  }
}

function runQuery(value, { sort, skip, limit, select } = {}) {
  if (sort && value && typeof value.sort === 'function') value = value.sort(sort);
  if (skip !== undefined && value && typeof value.skip === 'function') value = value.skip(skip);
  if (limit !== undefined && value && typeof value.limit === 'function') value = value.limit(limit);
  if (select && value && typeof value.select === 'function') value = value.select(select);
  if (value && typeof value.lean === 'function') value = value.lean();
  return value && typeof value.exec === 'function' ? value.exec() : value;
}

function decimalString(value) {
  // Los datos históricos pueden ser Number BSON; Decimal128 también expone toString().
  return value == null ? null : String(value);
}

function createAdminProductService(models) {
  const { Producto, Categoria, Variante, ValorVariante, ValorAtributo, Atributo, ImagenProducto } = models;

  async function requireActiveCategory(categoriaId) {
    validateObjectId(categoriaId, 'categoriaId');
    const category = await runQuery(Categoria.findOne({ _id: categoriaId }));
    if (!category) throw AppError.noEncontrado('Categoría no encontrada');
    if (category.activa !== true) throw AppError.conflicto('No se puede asignar un producto a una categoría inactiva');
    return category;
  }

  async function hydrateProduct(product, { includeImages = false } = {}) {
    const [category, variants, images] = await Promise.all([
      runQuery(Categoria.findOne({ _id: product.categoriaId })),
      runQuery(Variante.find({ productoId: product._id }), { sort: { _id: 1 } }),
      includeImages && ImagenProducto
        ? runQuery(ImagenProducto.find({ productoId: product._id }), { sort: { posicion: 1, _id: 1 } })
        : []
    ]);
    const variantIds = variants.map((variant) => variant._id);
    const links = variantIds.length
      ? await runQuery(ValorVariante.find({ varianteId: { $in: variantIds } }))
      : [];
    const valueIds = [...new Set(links.map((link) => String(link.valorAtributoId)))];
    const values = valueIds.length
      ? await runQuery(ValorAtributo.find({ _id: { $in: valueIds } }))
      : [];
    const attributeIds = [...new Set(values.map((value) => String(value.atributoId)))];
    const attributes = attributeIds.length
      ? await runQuery(Atributo.find({ _id: { $in: attributeIds } }))
      : [];
    const valueById = new Map(values.map((value) => [String(value._id), value]));
    const attrById = new Map(attributes.map((attribute) => [String(attribute._id), attribute]));
    const linksByVariant = new Map();
    for (const link of links) {
      const key = String(link.varianteId);
      linksByVariant.set(key, [...(linksByVariant.get(key) || []), link]);
    }

    const result = {
      id: String(product._id),
      nombre: product.nombre,
      slug: product.slug,
      descripcion: product.descripcion,
      precioBase: decimalString(product.precioBase),
      activo: product.activo,
      destacado: product.destacado,
      categoriaId: String(product.categoriaId),
      categoria: category ? { id: String(category._id), nombre: category.nombre, slug: category.slug } : null,
      variantes: variants.map((variant) => ({
        id: String(variant._id),
        precio: decimalString(variant.precio),
        stock: variant.stock,
        activa: variant.activa,
        valores: (linksByVariant.get(String(variant._id)) || [])
          .map((link) => valueById.get(String(link.valorAtributoId)))
          .filter(Boolean)
          .map((value) => ({ valor: value.valor, atributo: attrById.get(String(value.atributoId))?.nombre }))
          .filter((value) => value.atributo)
      })),
      creadoEn: product.creadoEn || product.createdAt,
      actualizadoEn: product.actualizadoEn || product.updatedAt
    };
    if (includeImages) {
      result.imagenes = images.map((image) => ({
        id: String(image._id), url: image.url, posicion: image.posicion,
        textoAlternativo: image.textoAlternativo || '', esPrincipal: image.esPrincipal === true,
        varianteId: image.varianteId ? String(image.varianteId) : null
      }));
    }
    return result;
  }

  async function listProducts(filters = {}, pagination = {}) {
    ensureObject(filters);
    rejectUnexpectedFields(filters, ['nombre', 'categoriaId', 'activo', 'destacado']);
    const { page = 1, limit = 20 } = pagination;
    validatePagination(page, limit);
    const skip = (page - 1) * limit;
    if (!Number.isSafeInteger(skip)) invalid('La página solicitada está fuera de rango');

    const where = {};
    if (filters.nombre !== undefined) {
      const name = requiredText(filters.nombre, 'nombre').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      where.nombre = { $regex: name, $options: 'i' };
    }
    if (filters.categoriaId !== undefined) where.categoriaId = validateObjectId(filters.categoriaId, 'categoriaId');
    if (filters.activo !== undefined) {
      if (typeof filters.activo !== 'boolean') invalid('El filtro activo debe ser booleano');
      where.activo = filters.activo;
    }
    if (filters.destacado !== undefined) {
      if (typeof filters.destacado !== 'boolean') invalid('El filtro destacado debe ser booleano');
      where.destacado = filters.destacado;
    }

    const [products, total] = await Promise.all([
      runQuery(Producto.find(where), {
        sort: { destacado: -1, updatedAt: -1, actualizadoEn: -1, _id: 1 },
        skip,
        limit
      }),
      Producto.countDocuments(where)
    ]);
    return {
      productos: await Promise.all(products.map((product) => hydrateProduct(product))),
      paginacion: { pagina: page, limite: limit, total, paginas: Math.ceil(total / limit) }
    };
  }

  async function getProductById(id) {
    validateObjectId(id);
    const product = await runQuery(Producto.findById(id));
    if (!product) throw AppError.noEncontrado('Producto no encontrado');
    return hydrateProduct(product, { includeImages: true });
  }

  async function createProduct(input) {
    ensureObject(input);
    rejectUnexpectedFields(input, ['nombre', 'slug', 'descripcion', 'precioBase', 'categoriaId', 'activo', 'destacado']);
    const data = {
      nombre: requiredText(input.nombre, 'nombre'),
      slug: requiredText(input.slug, 'slug'),
      descripcion: requiredText(input.descripcion, 'descripcion'),
      precioBase: parsePrice(input.precioBase),
      categoriaId: validateObjectId(requiredText(input.categoriaId, 'categoriaId'), 'categoriaId'),
      activo: optionalBoolean(input, 'activo', true),
      destacado: optionalBoolean(input, 'destacado', false)
    };
    await requireActiveCategory(data.categoriaId);
    if (await runQuery(Producto.findOne({ slug: data.slug }))) throw AppError.conflicto('Ya existe un producto con ese slug');
    try {
      const product = await Producto.create(data);
      return hydrateProduct(product);
    } catch (error) {
      if (error && error.code === 11000) throw AppError.conflicto('Ya existe un producto con ese slug');
      throw error;
    }
  }

  async function updateProduct(id, input) {
    validateObjectId(id);
    ensureObject(input);
    rejectUnexpectedFields(input, ['nombre', 'descripcion', 'precioBase', 'categoriaId', 'destacado']);
    if (Object.keys(input).length === 0) invalid('Debe enviar al menos un campo para editar');

    const data = {};
    if (Object.hasOwn(input, 'nombre')) data.nombre = requiredText(input.nombre, 'nombre');
    if (Object.hasOwn(input, 'descripcion')) data.descripcion = requiredText(input.descripcion, 'descripcion');
    if (Object.hasOwn(input, 'precioBase')) data.precioBase = parsePrice(input.precioBase);
    if (Object.hasOwn(input, 'categoriaId')) {
      data.categoriaId = validateObjectId(requiredText(input.categoriaId, 'categoriaId'), 'categoriaId');
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
    validateObjectId(id);
    if (typeof activo !== 'boolean') invalid('El campo activo debe ser booleano');
    if (activo) {
      const existing = await runQuery(Producto.findById(id));
      if (!existing) throw AppError.noEncontrado('Producto no encontrado');
      await requireActiveCategory(String(existing.categoriaId));
    }
    const product = await Producto.findByIdAndUpdate(id, { activo }, { new: true, runValidators: true });
    if (!product) throw AppError.noEncontrado('Producto no encontrado');
    return hydrateProduct(product);
  }

  return { listProducts, getProductById, createProduct, updateProduct, setVisibility };
}

module.exports = { createAdminProductService, parsePrice, validateObjectId, MAX_PAGE_SIZE };
