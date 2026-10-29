const mongoose = require('mongoose');
const { calculateStockAvailability, logStockInconsistency } = require('../utils/stockAvailability');
const AppError = require('../utils/AppError');

const MAX_CART_LINES = 50;
const MAX_UNITS_PER_VARIANT = 100;
const ALLOWED_CART_KEYS = ['articulos'];
const ALLOWED_LINE_KEYS = ['productoId', 'varianteId', 'cantidad'];

function badRequest(message, detalles) {
  throw AppError.solicitudInvalida(message, detalles);
}

function execute(query) {
  if (query && typeof query.lean === 'function') query = query.lean();
  return query && typeof query.exec === 'function' ? query.exec() : Promise.resolve(query);
}

function select(query, fields) {
  return query && typeof query.select === 'function' ? query.select(fields) : query;
}

function idString(value) {
  return String(value?._id ?? value);
}

function parseMoneyToCents(value) {
  if (value === null || value === undefined || value === '') return null;
  const text = typeof value === 'number'
    ? (Number.isFinite(value) ? String(value) : '')
    : typeof value === 'string' || typeof value?.toString === 'function'
      ? value.toString()
      : '';
  const match = /^([+-]?)(\d+)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(text);
  if (!match) return null;
  const [, sign, whole, fraction = '', exponentText = '0'] = match;
  const exponent = Number(exponentText);
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 100) return null;
  let digits = `${whole}${fraction}`;
  const decimalPlaces = fraction.length - exponent;
  if (decimalPlaces > 2) {
    const excess = decimalPlaces - 2;
    const discarded = digits.slice(-excess);
    if (/[1-9]/.test(discarded)) return null;
    digits = digits.slice(0, -excess) || '0';
  } else if (decimalPlaces < 2) {
    digits += '0'.repeat(2 - decimalPlaces);
  }
  try {
    const cents = BigInt(digits || '0');
    return sign === '-' ? -cents : cents;
  } catch {
    return null;
  }
}

function formatCents(cents) {
  const negative = cents < 0n;
  const absolute = negative ? -cents : cents;
  const integer = absolute / 100n;
  const fraction = String(absolute % 100n).padStart(2, '0');
  return `${negative ? '-' : ''}${integer}.${fraction}`;
}

function validateRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || Object.keys(body).some((key) => !ALLOWED_CART_KEYS.includes(key))
    || !Array.isArray(body.articulos)) {
    badRequest('El cuerpo debe contener únicamente un arreglo articulos');
  }
  if (body.articulos.length > MAX_CART_LINES) {
    badRequest(`El carrito no puede contener más de ${MAX_CART_LINES} líneas`);
  }

  const consolidated = new Map();
  body.articulos.forEach((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)
      || Object.keys(item).some((key) => !ALLOWED_LINE_KEYS.includes(key))
      || ALLOWED_LINE_KEYS.some((key) => !Object.hasOwn(item, key))) {
      badRequest('Cada artículo debe incluir únicamente productoId, varianteId y cantidad', [{ indice: index }]);
    }
    if (typeof item.productoId !== 'string' || !mongoose.isObjectIdOrHexString(item.productoId)
      || typeof item.varianteId !== 'string' || !mongoose.isObjectIdOrHexString(item.varianteId)) {
      badRequest('Los identificadores de producto y variante deben ser IDs válidos', [{ indice: index }]);
    }
    if (!Number.isSafeInteger(item.cantidad) || item.cantidad < 1 || item.cantidad > MAX_UNITS_PER_VARIANT) {
      badRequest(`La cantidad debe ser un entero entre 1 y ${MAX_UNITS_PER_VARIANT}`, [{ indice: index }]);
    }
    const productoId = new mongoose.Types.ObjectId(item.productoId).toString();
    const varianteId = new mongoose.Types.ObjectId(item.varianteId).toString();
    const key = `${productoId}:${varianteId}`;
    const entry = consolidated.get(key) || { productoId, varianteId, cantidad: 0, indices: [] };
    entry.cantidad += item.cantidad;
    entry.indices.push(index);
    if (entry.cantidad > MAX_UNITS_PER_VARIANT) {
      badRequest(`La cantidad consolidada por variante no puede superar ${MAX_UNITS_PER_VARIANT}`, [{ indices: entry.indices }]);
    }
    consolidated.set(key, entry);
  });
  return [...consolidated.values()];
}

function createCartValidationService(models, { ahora = () => new Date(), logger = console.error } = {}) {
  const { Producto, Variante, Categoria, ValorVariante, ValorAtributo, Atributo, ReservaStock } = models;

  async function validateCart(body) {
    const lines = validateRequest(body);
    if (!lines.length) {
      return {
        valido: false,
        articulos: [],
        errores: [{ indices: [], codigo: 'CARRITO_VACIO', mensaje: 'El carrito no contiene artículos' }],
        total: null
      };
    }

    const productIds = [...new Set(lines.map((line) => line.productoId))];
    const variantIds = [...new Set(lines.map((line) => line.varianteId))];
    const [products, variants] = await Promise.all([
      execute(select(Producto.find({ _id: { $in: productIds } }), '_id nombre slug descripcion precioBase activo categoriaId')),
      execute(select(Variante.find({ _id: { $in: variantIds } }), '_id productoId precio stock activa'))
    ]);
    const productById = new Map(products.map((product) => [idString(product), product]));
    const variantById = new Map(variants.map((variant) => [idString(variant), variant]));
    const categoryIds = [...new Set(products.map((product) => String(product.categoriaId)).filter(Boolean))];
    const categories = categoryIds.length
      ? await execute(select(Categoria.find({ _id: { $in: categoryIds } }), '_id nombre slug activa'))
      : [];
    const categoryById = new Map(categories.map((category) => [idString(category), category]));

    const candidateVariantIds = lines.map((line) => {
      const product = productById.get(line.productoId);
      const variant = variantById.get(line.varianteId);
      return product && product.activo === true && variant && variant.activa === true
        && String(variant.productoId) === line.productoId ? variant._id : null;
    }).filter(Boolean);
    const uniqueCandidateVariantIds = [...new Set(candidateVariantIds.map(String))];
    const [links, reservations] = uniqueCandidateVariantIds.length
      ? await Promise.all([
        execute(select(ValorVariante.find({ varianteId: { $in: uniqueCandidateVariantIds } }), '_id varianteId valorAtributoId')),
        execute(select(ReservaStock.find({ varianteId: { $in: uniqueCandidateVariantIds }, estado: 'ACTIVA' }), '_id varianteId cantidad estado venceEn'))
      ])
      : [[], []];
    const valueIds = [...new Set(links.map((link) => String(link.valorAtributoId)))];
    const values = valueIds.length
      ? await execute(select(ValorAtributo.find({ _id: { $in: valueIds } }), '_id atributoId valor'))
      : [];
    const attributeIds = [...new Set(values.map((value) => String(value.atributoId)))];
    const attributes = attributeIds.length
      ? await execute(select(Atributo.find({ _id: { $in: attributeIds } }), '_id nombre'))
      : [];

    const valueById = new Map(values.map((value) => [idString(value), value]));
    const attributeById = new Map(attributes.map((attribute) => [idString(attribute), attribute]));
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

    const moment = ahora();
    const articulos = [];
    const errores = [];
    let totalCents = 0n;
    for (const line of lines) {
      const result = {
        productoId: line.productoId,
        varianteId: line.varianteId,
        indicesOriginales: line.indices,
        cantidad: line.cantidad,
        valido: false
      };
      const fail = (codigo, mensaje) => {
        result.error = { codigo, mensaje };
        errores.push({ indices: line.indices, productoId: line.productoId, varianteId: line.varianteId, codigo, mensaje });
      };
      const product = productById.get(line.productoId);
      const variant = variantById.get(line.varianteId);
      if (!product || product.activo !== true) fail('PRODUCTO_NO_DISPONIBLE', 'El producto no existe o no está disponible');
      else if (typeof product.nombre !== 'string' || !product.nombre.trim() || typeof product.slug !== 'string' || !product.slug.trim()) {
        fail('PRODUCTO_INCONSISTENTE', 'No se pudieron verificar los datos del producto');
      }
      else if (!variant) fail('VARIANTE_NO_DISPONIBLE', 'La variante no existe o no está disponible');
      else if (String(variant.productoId) !== line.productoId) fail('VARIANTE_NO_CORRESPONDE', 'La variante no pertenece al producto indicado');
      else if (variant.activa !== true) fail('VARIANTE_INACTIVA', 'La variante no está disponible');
      else {
        const category = categoryById.get(String(product.categoriaId));
        if (!category || category.activa !== true) fail('CATEGORIA_NO_DISPONIBLE', 'La categoría del producto no está disponible');
        else if (typeof category.nombre !== 'string' || !category.nombre.trim() || typeof category.slug !== 'string' || !category.slug.trim()) {
          fail('CATEGORIA_INCONSISTENTE', 'No se pudieron verificar los datos de la categoría');
        }
        else {
          const rawVariantValues = linksByVariant.get(line.varianteId) || [];
          const resolvedAttributes = rawVariantValues.map((link) => {
            const value = valueById.get(String(link.valorAtributoId));
            const attribute = value && attributeById.get(String(value.atributoId));
            return value && attribute && typeof value.valor === 'string' && typeof attribute.nombre === 'string'
              ? { atributoId: String(value.atributoId), atributo: attribute.nombre, valorAtributoId: String(value._id), valor: value.valor }
              : null;
          });
          if (resolvedAttributes.some((attribute) => attribute === null)) {
            fail('ATRIBUTOS_INCONSISTENTES', 'No se pudieron verificar los atributos de la variante');
          } else {
            const availability = calculateStockAvailability(variant.stock, reservationsByVariant.get(line.varianteId), moment);
            if (availability.inconsistente) {
              logStockInconsistency(line.varianteId, availability, logger);
              fail('DISPONIBILIDAD_INCONSISTENTE', 'No se pudo verificar la disponibilidad de la variante');
            }
            else if (line.cantidad > availability.stockDisponible) fail('STOCK_INSUFICIENTE', 'La cantidad solicitada supera el stock disponible');
            else {
              const rawPrice = variant.precio !== null && variant.precio !== undefined
                ? variant.precio
                : product.precioBase;
              const priceCents = parseMoneyToCents(rawPrice);
              if (priceCents === null || priceCents < 0n) fail('PRECIO_INVALIDO', 'No se pudo verificar el precio del producto');
              else {
                const subtotalCents = priceCents * BigInt(line.cantidad);
                totalCents += subtotalCents;
                Object.assign(result, {
                  valido: true,
                  nombre: product.nombre,
                  slug: product.slug,
                  categoria: { nombre: category.nombre, slug: category.slug },
                  variante: resolvedAttributes.map(({ atributo, valor }) => ({ atributo, valor })),
                  cantidadReservada: availability.cantidadReservada,
                  stockDisponible: availability.stockDisponible,
                  precioUnitario: formatCents(priceCents),
                  subtotal: formatCents(subtotalCents)
                });
              }
            }
          }
        }
      }
      articulos.push(result);
    }

    return {
      valido: errores.length === 0,
      articulos,
      errores,
      total: errores.length === 0 ? formatCents(totalCents) : null
    };
  }

  return { validateCart };
}

module.exports = {
  createCartValidationService,
  MAX_CART_LINES,
  MAX_UNITS_PER_VARIANT,
  parseMoneyToCents,
  formatCents
};
