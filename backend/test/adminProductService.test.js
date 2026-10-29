const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const AppError = require('../src/utils/AppError');
const createAdminProductRoutes = require('../src/routes/adminProductRoutes');
const { createAdminProductService } = require('../src/services/adminProductService');
const { createAdminProductController } = require('../src/controllers/adminProductController');

const validProduct = { nombre: 'Remera Olla', slug: 'remera-olla', descripcion: 'Descripción', precioBase: '45000.00', categoriaId: 'categoria-1' };
function makeModels(overrides = {}) {
  return {
    Categoria: { findOne: async () => ({ _id: 'categoria-1', nombre: 'Remeras', slug: 'remeras', activa: true }), ...overrides.Categoria },
    Producto: {
      find: async () => [], findOne: async () => null,
      create: async (data) => ({ _id: 'producto-1', ...data }),
      findByIdAndUpdate: async (id, data) => ({ _id: id, ...data }), ...overrides.Producto
    },
    Variante: { find: async () => [], ...overrides.Variante },
    ValorVariante: { find: async () => [], ...overrides.ValorVariante },
    ValorAtributo: { find: async () => [], ...overrides.ValorAtributo },
    Atributo: { find: async () => [], ...overrides.Atributo }
  };
}

test('lista productos ocultos y construye filtros Mongo para nombre, categoría y visibilidad', async () => {
  let query;
  const service = createAdminProductService(makeModels({ Producto: { find: async (filter) => { query = filter; return []; } } }));
  await service.listProducts({ nombre: 'Remera', categoriaId: 'cat-1', activo: false });
  assert.deepEqual(query, { nombre: { $regex: 'Remera', $options: 'i' }, categoriaId: 'cat-1', activo: false });
  await service.listProducts({});
  assert.equal(Object.hasOwn(query, 'activo'), false);
});

test('crea producto con Decimal128 y defaults sin crear variantes', async () => {
  let created;
  const service = createAdminProductService(makeModels({ Producto: {
    findOne: async () => null,
    create: async (data) => { created = data; return { _id: 'p1', ...data }; }
  } }));
  await service.createProduct(validProduct);
  assert.ok(created.precioBase instanceof mongoose.Types.Decimal128);
  assert.equal(created.precioBase.toString(), '45000.00');
  assert.equal(created.activo, true);
  assert.equal(created.destacado, false);
  assert.equal(Object.hasOwn(created, 'stock'), false);
});

test('valida precio, campos obligatorios, categoría activa y slug duplicado', async () => {
  const service = createAdminProductService(makeModels());
  await assert.rejects(service.createProduct({ ...validProduct, precioBase: '-1' }), (error) => error.statusCode === 400);
  await assert.rejects(service.createProduct({ slug: validProduct.slug }), (error) => error.statusCode === 400);
  const noCategory = createAdminProductService(makeModels({ Categoria: { findOne: async () => null } }));
  await assert.rejects(noCategory.createProduct(validProduct), (error) => error.statusCode === 404);
  const duplicate = createAdminProductService(makeModels({ Producto: { findOne: async () => ({ _id: 'p0' }) } }));
  await assert.rejects(duplicate.createProduct(validProduct), (error) => error.statusCode === 409);
});

test('traduce conflicto de índice único y edita campos permitidos sin tocar stock ni historial', async () => {
  let update;
  const service = createAdminProductService(makeModels({
    Producto: {
      findByIdAndUpdate: async (id, data) => { update = { id, data }; return { _id: id, ...data }; }
    }
  }));
  const result = await service.updateProduct('p1', { precioBase: '27000', destacado: true });
  assert.equal(result.precioBase, '27000.00');
  assert.deepEqual(Object.keys(update.data).sort(), ['destacado', 'precioBase']);
  assert.equal(Object.hasOwn(update.data, 'stock'), false);
  const conflict = createAdminProductService(makeModels({ Producto: {
    findOne: async () => null,
    create: async () => { throw { code: 11000 }; }
  } }));
  await assert.rejects(conflict.createProduct(validProduct), (error) => error.statusCode === 409);
  await assert.rejects(service.updateProduct('p1', { stock: 2 }), (error) => error.statusCode === 400);
});

test('publica y oculta lógicamente, informa inexistentes y reenvía errores al middleware', async () => {
  const updates = [];
  const service = createAdminProductService(makeModels({ Producto: {
    findByIdAndUpdate: async (id, data) => { updates.push(data); return data.activo === false ? { _id: id, ...data } : null; }
  } }));
  await service.setVisibility('p1', false);
  assert.deepEqual(updates, [{ activo: false }]);
  await assert.rejects(service.setVisibility('p1', true), (error) => error.statusCode === 404);
  await assert.rejects(service.setVisibility('p1', 'false'), (error) => error.statusCode === 400);
  const controller = createAdminProductController({ listProducts: async () => { throw new Error('simulado'); } });
  const passed = await new Promise((resolve) => controller.list({ query: {} }, {}, resolve));
  assert.equal(passed.message, 'simulado');
});

test('las rutas admin no se montan en la app pública ni ofrecen DELETE', () => {
  const appSource = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');
  assert.doesNotMatch(appSource, /adminProductRoutes|\/api\/admin\/products/);
  const routes = createAdminProductRoutes(makeModels());
  assert.equal(routes.stack.some((layer) => layer.route && layer.route.methods.delete), false);
});
