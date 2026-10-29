const AppError = require('../utils/AppError');

function calculateAvailableStock(stockFisico, reservas, ahora = new Date()) {
  const stock = Number.isFinite(Number(stockFisico)) ? Math.max(0, Number(stockFisico)) : 0;
  const reserved = (reservas || []).reduce((total, reserva) => {
    const expiresAt = new Date(reserva.venceEn);
    const quantity = Number(reserva.cantidad);
    if (reserva.estado !== 'ACTIVA' || Number.isNaN(expiresAt.getTime()) || expiresAt <= ahora || !Number.isFinite(quantity) || quantity <= 0) return total;
    return total + quantity;
  }, 0);
  return Math.max(0, stock - reserved);
}

function valueOf(record, field) {
  return record && record[field] && typeof record[field].toString === 'function'
    ? record[field].toString()
    : record?.[field];
}

function query(query, { sort, select } = {}) {
  if (sort && query && typeof query.sort === 'function') query = query.sort(sort);
  if (select && query && typeof query.select === 'function') query = query.select(select);
  if (query && typeof query.lean === 'function') query = query.lean();
  return query;
}

function createCatalogService(models, { ahora = () => new Date() } = {}) {
  const { Producto, Categoria, ImagenProducto, Variante, ValorVariante, ValorAtributo, Atributo, ReservaStock } = models;

  async function listProducts(categoriaSlug) {
    const categories = await query(Categoria.find({ activa: true }), { select: '_id nombre slug' });
    const filteredCategories = categoriaSlug ? categories.filter((c) => c.slug === categoriaSlug) : categories;
    if (filteredCategories.length === 0) return [];

    const products = await query(Producto.find({ activo: true, categoriaId: { $in: filteredCategories.map((c) => c._id) } }), {
      sort: { destacado: -1, createdAt: -1, creadoEn: -1 }
    });
    const categoryById = new Map(filteredCategories.map((c) => [String(c._id), c]));
    return products.map((product) => ({
      id: String(product._id), nombre: product.nombre, slug: product.slug,
      precioBase: valueOf(product, 'precioBase'), destacado: product.destacado,
      categoria: categoryById.get(String(product.categoriaId))
        ? { nombre: categoryById.get(String(product.categoriaId)).nombre, slug: categoryById.get(String(product.categoriaId)).slug }
        : null
    })).filter((product) => product.categoria);
  }

  async function getProductBySlug(slug) {
    const moment = ahora();
    const product = await query(Producto.findOne({ slug, activo: true }));
    if (!product) throw AppError.noEncontrado('Producto no encontrado');
    const category = await query(Categoria.findOne({ _id: product.categoriaId, activa: true }));
    if (!category) throw AppError.noEncontrado('Producto no encontrado');

    const [images, variants] = await Promise.all([
      query(ImagenProducto.find({ productoId: product._id }), { sort: { posicion: 1, _id: 1 } }),
      query(Variante.find({ productoId: product._id, activa: true }))
    ]);
    const variantIds = variants.map((variant) => variant._id);
    const valueLinks = variantIds.length
      ? await query(ValorVariante.find({ varianteId: { $in: variantIds } }))
      : [];
    const attributeValueIds = [...new Set(valueLinks.map((link) => String(link.valorAtributoId)))];
    const attributeValues = attributeValueIds.length
      ? await query(ValorAtributo.find({ _id: { $in: attributeValueIds } }))
      : [];
    const attributeIds = [...new Set(attributeValues.map((value) => String(value.atributoId)))];
    const attributes = attributeIds.length ? await query(Atributo.find({ _id: { $in: attributeIds } })) : [];
    const valueById = new Map(attributeValues.map((value) => [String(value._id), value]));
    const attributeById = new Map(attributes.map((attribute) => [String(attribute._id), attribute]));
    const reservations = variantIds.length
      ? await query(ReservaStock.find({ varianteId: { $in: variantIds }, estado: 'ACTIVA', venceEn: { $gt: moment } }))
      : [];
    const linksByVariant = new Map();
    for (const link of valueLinks) {
      const key = String(link.varianteId);
      linksByVariant.set(key, [...(linksByVariant.get(key) || []), link]);
    }
    const reservationsByVariant = new Map();
    for (const reservation of reservations) {
      const key = String(reservation.varianteId);
      reservationsByVariant.set(key, [...(reservationsByVariant.get(key) || []), reservation]);
    }

    return {
      id: String(product._id), nombre: product.nombre, slug: product.slug,
      descripcion: product.descripcion, precioBase: valueOf(product, 'precioBase'), destacado: product.destacado,
      categoria: { nombre: category.nombre, slug: category.slug },
      imagenes: images.map((image) => ({ id: String(image._id), url: image.url, posicion: image.posicion })),
      variantes: variants.map((variant) => {
        const id = String(variant._id);
        const available = calculateAvailableStock(variant.stock, reservationsByVariant.get(id), moment);
        return {
          id, precio: valueOf(variant, 'precio'), stockDisponible: available, agotada: available === 0,
          valores: (linksByVariant.get(id) || []).map((link) => valueById.get(String(link.valorAtributoId)))
            .filter(Boolean).map((value) => ({ atributo: attributeById.get(String(value.atributoId))?.nombre, valor: value.valor }))
            .filter((item) => item.atributo)
        };
      })
    };
  }

  async function listCategories() {
    const categories = await query(Categoria.find({ activa: true }), { sort: { nombre: 1 }, select: '_id nombre slug' });
    return categories.map((category) => ({ id: String(category._id), nombre: category.nombre, slug: category.slug }));
  }

  return { listProducts, getProductBySlug, listCategories };
}

module.exports = { createCatalogService, calculateAvailableStock };
