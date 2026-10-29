const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const AppError = require('../src/utils/AppError');
const app = require('../src/app');
const createAdminProductRoutes = require('../src/routes/adminProductRoutes');
const { createAdminProductService } = require('../src/services/adminProductService');
const { createAdminProductController, parseProductQuery } = require('../src/controllers/adminProductController');

const CATEGORY_ID = '507f1f77bcf86cd799439011';
const PRODUCT_ID = '507f1f77bcf86cd799439012';
const VARIANT_ID = '507f1f77bcf86cd799439013';
const VALUE_ID = '507f1f77bcf86cd799439014';
const IMAGE_ID = '507f1f77bcf86cd799439015';
const validProduct = {
  nombre: 'Remera Olla', slug: 'remera-olla', descripcion: 'Descripción válida',
  precioBase: '45000.00', categoriaId: CATEGORY_ID
};

function queryResult(data, trace = {}) {
  return {
    sort(value) { trace.sort = value; return this; },
    skip(value) { trace.skip = value; return this; },
    limit(value) { trace.limit = value; return this; },
    select(value) { trace.select = value; return this; },
    lean() { return this; },
    exec: async () => data
  };
}

function makeModels(overrides = {}) {
  const product = {
    _id: PRODUCT_ID, nombre: 'Remera Olla', slug: 'remera-olla', descripcion: 'Descripción válida',
    precioBase: mongoose.Types.Decimal128.fromString('45000.00'), categoriaId: CATEGORY_ID,
    activo: true, destacado: false, createdAt: new Date('2025-01-01T00:00:00Z')
  };
  const category = { _id: CATEGORY_ID, nombre: 'Remeras', slug: 'remeras' };
  const variant = { _id: VARIANT_ID, productoId: PRODUCT_ID, stock: 4, activa: true, precio: null };
  return {
    Producto: {
      find: () => queryResult([product]),
      countDocuments: async () => 1,
      findById: () => queryResult(product),
      findOne: async () => null,
      create: async (data) => ({ _id: PRODUCT_ID, ...data }),
      findByIdAndUpdate: async (id, data) => ({ ...product, _id: id, ...data }),
      ...overrides.Producto
    },
    Categoria: { findOne: async () => category, ...overrides.Categoria },
    Variante: { find: () => queryResult([variant]), ...overrides.Variante },
    ValorVariante: {
      find: () => queryResult([{ varianteId: VARIANT_ID, valorAtributoId: VALUE_ID }]),
      ...overrides.ValorVariante
    },
    ValorAtributo: {
      find: () => queryResult([{ _id: VALUE_ID, valor: 'L', atributoId: CATEGORY_ID }]),
      ...overrides.ValorAtributo
    },
    Atributo: { find: () => queryResult([{ _id: CATEGORY_ID, nombre: 'Talle' }]), ...overrides.Atributo },
    ImagenProducto: {
      find: () => queryResult([{ _id: IMAGE_ID, productoId: PRODUCT_ID, url: 'https://example.invalid/image', posicion: 0 }]),
      ...overrides.ImagenProducto
    }
  };
}

test('lista productos activos e inactivos con filtros, destacados y paginación', async () => {
  const trace = {};
  let countFilter;
  const service = createAdminProductService(makeModels({ Producto: {
    find: (filter) => { trace.filter = filter; return queryResult([], trace); },
    countDocuments: async (filter) => { countFilter = filter; return 23; }
  } }));
  const result = await service.listProducts({ nombre: 'Re.mera', categoriaId: CATEGORY_ID, activo: false, destacado: true }, { page: 2, limit: 10 });
  assert.deepEqual(trace.filter, {
    nombre: { $regex: 'Re\\.mera', $options: 'i' }, categoriaId: CATEGORY_ID, activo: false, destacado: true
  });
  assert.deepEqual(countFilter, trace.filter);
  assert.equal(trace.skip, 10);
  assert.equal(trace.limit, 10);
  assert.equal(result.productos.length, 0);
  assert.deepEqual(result.paginacion, { pagina: 2, limite: 10, total: 23, paginas: 3 });

  const noVisibility = createAdminProductService(makeModels({ Producto: { find: (filter) => { trace.filter = filter; return queryResult([]); } } }));
  await noVisibility.listProducts();
  assert.equal(Object.hasOwn(trace.filter, 'activo'), false);
});

test('el detalle por ID incluye categoría, variantes, atributos e imágenes', async () => {
  const service = createAdminProductService(makeModels());
  const product = await service.getProductById(PRODUCT_ID);
  assert.equal(product.id, PRODUCT_ID);
  assert.equal(product.categoria.slug, 'remeras');
  assert.equal(product.variantes[0].stock, 4);
  assert.deepEqual(product.variantes[0].valores, [{ valor: 'L', atributo: 'Talle' }]);
  assert.equal(product.imagenes[0].id, IMAGE_ID);
  await assert.rejects(service.getProductById('id-invalido'), (error) => error.statusCode === 400);
  const missing = createAdminProductService(makeModels({ Producto: { findById: () => queryResult(null) } }));
  await assert.rejects(missing.getProductById(PRODUCT_ID), (error) => error.statusCode === 404);
});

test('crea producto con Decimal128, defaults y únicamente los campos admitidos', async () => {
  let created;
  const service = createAdminProductService(makeModels({ Producto: {
    create: async (data) => { created = data; return { _id: PRODUCT_ID, ...data }; }
  } }));
  const result = await service.createProduct(validProduct);
  assert.ok(created.precioBase instanceof mongoose.Types.Decimal128);
  assert.equal(created.precioBase.toString(), '45000.00');
  assert.equal(created.activo, true);
  assert.equal(created.destacado, false);
  assert.equal(Object.hasOwn(created, 'stock'), false);
  assert.equal(result.nombre, validProduct.nombre);
  await assert.rejects(service.createProduct({ ...validProduct, activo: 'true' }), (error) => error.statusCode === 400);
  await assert.rejects(service.createProduct({ ...validProduct, interno: true }), (error) => error.statusCode === 400);
});

test('valida campos requeridos, precio, ID y existencia de categoría al crear', async () => {
  const service = createAdminProductService(makeModels());
  await assert.rejects(service.createProduct({ ...validProduct, precioBase: '-1' }), (error) => error.statusCode === 400);
  await assert.rejects(service.createProduct({ ...validProduct, precioBase: '12.345' }), (error) => error.statusCode === 400);
  await assert.rejects(service.createProduct({ slug: validProduct.slug }), (error) => error.statusCode === 400);
  await assert.rejects(service.createProduct({ ...validProduct, categoriaId: 'categoria-no-valida' }), (error) => error.statusCode === 400);
  const noCategory = createAdminProductService(makeModels({ Categoria: { findOne: async () => null } }));
  await assert.rejects(noCategory.createProduct(validProduct), (error) => error.statusCode === 404);
});

test('resuelve slug duplicado tanto en comprobación previa como en carrera de índice único', async () => {
  const duplicate = createAdminProductService(makeModels({ Producto: { findOne: async () => ({ _id: PRODUCT_ID }) } }));
  await assert.rejects(duplicate.createProduct(validProduct), (error) => error.statusCode === 409);
  const race = createAdminProductService(makeModels({ Producto: {
    findOne: async () => null,
    create: async () => { throw { code: 11000 }; }
  } }));
  await assert.rejects(race.createProduct(validProduct), (error) => error.statusCode === 409);
});

test('edita solo campos permitidos, valida categoría e informa producto inexistente', async () => {
  let update;
  const service = createAdminProductService(makeModels({ Producto: {
    findByIdAndUpdate: async (id, data) => { update = { id, data }; return { _id: id, ...data, categoriaId: data.categoriaId || CATEGORY_ID }; }
  } }));
  await service.updateProduct(PRODUCT_ID, { precioBase: '27000', destacado: true });
  assert.deepEqual(Object.keys(update.data).sort(), ['destacado', 'precioBase']);
  assert.equal(update.data.precioBase.toString(), '27000.00');
  await assert.rejects(service.updateProduct(PRODUCT_ID, { stock: 2 }), (error) => error.statusCode === 400);
  await assert.rejects(service.updateProduct('invalido', { nombre: 'Nuevo' }), (error) => error.statusCode === 400);
  const missing = createAdminProductService(makeModels({ Producto: { findByIdAndUpdate: async () => null } }));
  await assert.rejects(missing.updateProduct(PRODUCT_ID, { nombre: 'Nuevo' }), (error) => error.statusCode === 404);
  const noCategory = createAdminProductService(makeModels({ Categoria: { findOne: async () => null } }));
  await assert.rejects(noCategory.updateProduct(PRODUCT_ID, { categoriaId: CATEGORY_ID }), (error) => error.statusCode === 404);
});

test('publica y desactiva lógicamente sin tocar variantes ni historial', async () => {
  const writes = [];
  const service = createAdminProductService(makeModels({ Producto: {
    findByIdAndUpdate: async (id, data) => { writes.push(data); return { _id: id, ...data, categoriaId: CATEGORY_ID }; }
  } }));
  await service.setVisibility(PRODUCT_ID, false);
  await service.setVisibility(PRODUCT_ID, true);
  assert.deepEqual(writes, [{ activo: false }, { activo: true }]);
  await assert.rejects(service.setVisibility(PRODUCT_ID, 'false'), (error) => error.statusCode === 400);
  assert.equal(Object.hasOwn(writes[0], 'stock'), false);
  assert.equal(Object.hasOwn(writes[0], 'varianteId'), false);
});

test('el estado destacado se gestiona con PATCH general, sin endpoint duplicado', async () => {
  let update;
  const service = createAdminProductService(makeModels({ Producto: {
    findByIdAndUpdate: async (id, data) => { update = data; return { _id: id, ...data, categoriaId: CATEGORY_ID }; }
  } }));
  await service.updateProduct(PRODUCT_ID, { destacado: true });
  assert.deepEqual(update, { destacado: true });
  await service.updateProduct(PRODUCT_ID, { destacado: false });
  assert.deepEqual(update, { destacado: false });
  await assert.rejects(service.updateProduct(PRODUCT_ID, { destacado: 'true' }), (error) => error.statusCode === 400);
});

test('parsea filtros y paginación, rechaza valores incorrectos', () => {
  assert.deepEqual(parseProductQuery({ activo: 'false', destacado: 'true', page: '3', limit: '25' }), {
    filters: { activo: false, destacado: true }, pagination: { page: 3, limit: 25 }
  });
  assert.throws(() => parseProductQuery({ limit: '101' }), (error) => error.statusCode === 400);
  assert.throws(() => parseProductQuery({ activo: '1' }), (error) => error.statusCode === 400);
  assert.throws(() => parseProductQuery({ sort: 'nombre' }), (error) => error.statusCode === 400);
});

test('las rutas administrativas no están montadas públicamente ni ofrecen DELETE', () => {
  const appSource = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');
  assert.doesNotMatch(appSource, /adminProductRoutes|\/api\/admin\/products/);
  const routes = createAdminProductRoutes(makeModels());
  const definitions = routes.stack.filter((layer) => layer.route).map((layer) => ({
    path: layer.route.path,
    method: Object.keys(layer.route.methods)[0]
  }));
  assert.ok(definitions.some((route) => route.method === 'get' && route.path === '/'));
  assert.ok(definitions.some((route) => route.method === 'get' && route.path === '/:id'));
  assert.ok(definitions.some((route) => route.method === 'patch' && route.path === '/:id'));
  assert.equal(definitions.some((route) => route.path === '/:id/featured'), false);
  assert.equal(definitions.some((route) => route.method === 'delete'), false);
  assert.equal(typeof app, 'function');
});

test('controller reenvía errores al middleware y conserva errores HTTP', async () => {
  const controller = createAdminProductController({
    listProducts: async () => { throw AppError.noEncontrado('Producto no encontrado'); },
    getProductById: async () => ({ id: PRODUCT_ID })
  });
  const error = await new Promise((resolve) => controller.list({ query: {} }, {}, resolve));
  assert.equal(error.statusCode, 404);
  let body;
  await controller.getById({ params: { id: PRODUCT_ID } }, { json: (value) => { body = value; } }, (e) => { throw e; });
  assert.equal(body.id, PRODUCT_ID);
});
