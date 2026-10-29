const { Prisma } = require('@prisma/client');
const AppError = require('../utils/AppError');

const MAX_PRICE = new Prisma.Decimal('99999999.99');

const productSelect = {
  id: true,
  nombre: true,
  slug: true,
  descripcion: true,
  precioBase: true,
  activo: true,
  destacado: true,
  categoriaId: true,
  categoria: {
    select: { id: true, nombre: true, slug: true }
  },
  variantes: {
    orderBy: { id: 'asc' },
    select: {
      id: true,
      precio: true,
      stock: true,
      activa: true,
      valores: {
        select: {
          valorAtributo: {
            select: {
              valor: true,
              atributo: { select: { nombre: true } }
            }
          }
        }
      }
    }
  },
  creadoEn: true,
  actualizadoEn: true
};

function invalid(message) {
  throw AppError.solicitudInvalida(message);
}

function ensureObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    invalid('El cuerpo debe ser un objeto JSON');
  }
}

function rejectUnexpectedFields(data, allowedFields) {
  const unexpected = Object.keys(data).filter((field) => !allowedFields.includes(field));
  if (unexpected.length > 0) {
    invalid('El cuerpo contiene campos no permitidos');
  }
}

function requiredText(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    invalid(`El campo ${field} es obligatorio`);
  }
  return value.trim();
}

function parsePrice(value) {
  if ((typeof value !== 'string' && typeof value !== 'number') || String(value).trim() === '') {
    invalid('El precio base debe ser un importe decimal valido');
  }

  let price;
  try {
    price = new Prisma.Decimal(String(value).trim());
  } catch (_error) {
    invalid('El precio base debe ser un importe decimal valido');
  }

  if (!price.isFinite() || price.isNegative() || price.decimalPlaces() > 2 || price.greaterThan(MAX_PRICE)) {
    invalid('El precio base debe ser mayor o igual a cero y tener como maximo dos decimales');
  }
  return price;
}

function optionalBoolean(data, field, defaultValue) {
  if (!Object.prototype.hasOwnProperty.call(data, field)) return defaultValue;
  if (typeof data[field] !== 'boolean') invalid(`El campo ${field} debe ser booleano`);
  return data[field];
}

function prismaErrorCode(error) {
  return error && (error.code || error.errorCode);
}

function createAdminProductService(prisma) {
  async function requireActiveCategory(categoriaId) {
    const category = await prisma.categoria.findFirst({
      where: { id: categoriaId, activa: true },
      select: { id: true }
    });
    if (!category) {
      throw AppError.noEncontrado('Categoria activa no encontrada');
    }
  }

  async function listProducts(filters = {}) {
    ensureObject(filters);
    rejectUnexpectedFields(filters, ['nombre', 'categoriaId', 'activo']);

    const where = {};
    if (filters.nombre !== undefined) {
      where.nombre = { contains: requiredText(filters.nombre, 'nombre') };
    }
    if (filters.categoriaId !== undefined) {
      where.categoriaId = requiredText(filters.categoriaId, 'categoriaId');
    }
    if (filters.activo !== undefined) {
      if (typeof filters.activo !== 'boolean') invalid('El filtro activo debe ser booleano');
      where.activo = filters.activo;
    }

    return prisma.producto.findMany({
      where,
      orderBy: [{ actualizadoEn: 'desc' }, { id: 'asc' }],
      select: productSelect
    });
  }

  async function createProduct(input) {
    ensureObject(input);
    const allowedFields = [
      'nombre', 'slug', 'descripcion', 'precioBase', 'categoriaId', 'activo', 'destacado'
    ];
    rejectUnexpectedFields(input, allowedFields);

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

    const existing = await prisma.producto.findUnique({
      where: { slug: data.slug },
      select: { id: true }
    });
    if (existing) {
      throw AppError.conflicto('Ya existe un producto con ese slug');
    }

    try {
      return await prisma.producto.create({ data, select: productSelect });
    } catch (error) {
      if (prismaErrorCode(error) === 'P2002') {
        throw AppError.conflicto('Ya existe un producto con ese slug');
      }
      throw error;
    }
  }

  async function updateProduct(id, input) {
    ensureObject(input);
    const allowedFields = ['nombre', 'descripcion', 'precioBase', 'categoriaId', 'destacado'];
    rejectUnexpectedFields(input, allowedFields);
    if (Object.keys(input).length === 0) invalid('Debe enviar al menos un campo para editar');

    const data = {};
    if (Object.prototype.hasOwnProperty.call(input, 'nombre')) {
      data.nombre = requiredText(input.nombre, 'nombre');
    }
    if (Object.prototype.hasOwnProperty.call(input, 'descripcion')) {
      data.descripcion = requiredText(input.descripcion, 'descripcion');
    }
    if (Object.prototype.hasOwnProperty.call(input, 'precioBase')) {
      data.precioBase = parsePrice(input.precioBase);
    }
    if (Object.prototype.hasOwnProperty.call(input, 'categoriaId')) {
      data.categoriaId = requiredText(input.categoriaId, 'categoriaId');
      await requireActiveCategory(data.categoriaId);
    }
    if (Object.prototype.hasOwnProperty.call(input, 'destacado')) {
      if (typeof input.destacado !== 'boolean') invalid('El campo destacado debe ser booleano');
      data.destacado = input.destacado;
    }

    return updateExistingProduct(id, data);
  }

  async function setVisibility(id, activo) {
    if (typeof activo !== 'boolean') invalid('El campo activo debe ser booleano');
    return updateExistingProduct(id, { activo });
  }

  async function updateExistingProduct(id, data) {
    const productId = requiredText(id, 'id');
    try {
      return await prisma.producto.update({
        where: { id: productId },
        data,
        select: productSelect
      });
    } catch (error) {
      if (prismaErrorCode(error) === 'P2025') {
        throw AppError.noEncontrado('Producto no encontrado');
      }
      throw error;
    }
  }

  return { listProducts, createProduct, updateProduct, setVisibility };
}

module.exports = { createAdminProductService, productSelect };
