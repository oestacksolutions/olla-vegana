const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const AppError = require('../src/utils/AppError');
const createAdminCategoryRoutes = require('../src/routes/adminCategoryRoutes');
const { createAdminCategoryService } = require('../src/services/adminCategoryService');
const { createAdminCategoryController, parseCategoryFilters } = require('../src/controllers/adminCategoryController');

const ROOT_ID = '507f1f77bcf86cd799439011';
const CHILD_ID = '507f1f77bcf86cd799439012';
const NEW_ID = '507f1f77bcf86cd799439013';
const categoryRoot = {
  _id: ROOT_ID, nombre: 'Ropa', slug: 'ropa', activa: true, padreId: null,
  createdAt: new Date('2025-01-01T00:00:00Z'), updatedAt: new Date('2025-01-02T00:00:00Z')
};
const categoryChild = { _id: CHILD_ID, nombre: 'Remeras', slug: 'remeras', activa: true, padreId: ROOT_ID };

function queryResult(data, trace = {}) {
  return {
    sort(value) { trace.sort = value; return this; },
    select(value) { trace.select = value; return this; },
    lean() { return this; },
    exec: async () => data
  };
}

function matches(category, filter) {
  if (filter._id && String(category._id) !== String(filter._id)) return false;
  if (filter.slug && category.slug !== filter.slug) return false;
  if (filter.padreId && String(category.padreId) !== String(filter.padreId)) return false;
  if (filter.activa !== undefined && category.activa !== filter.activa) return false;
  if (filter._id?.$ne && String(category._id) === String(filter._id.$ne)) return false;
  return true;
}

function makeModels(overrides = {}) {
  const categories = [categoryRoot, categoryChild];
  return {
    Categoria: {
      find: (filter = {}) => queryResult(categories.filter((item) => matches(item, filter))),
      findOne: async (filter = {}) => categories.find((item) => matches(item, filter)) || null,
      create: async (data) => ({ _id: NEW_ID, ...data }),
      findByIdAndUpdate: async (id, data) => ({ ...categoryRoot, _id: id, ...data }),
      ...overrides.Categoria
    },
    Producto: { countDocuments: async () => 4, ...overrides.Producto }
  };
}

test('lista activas e inactivas, filtra por nombre y estado e incluye padre, conteo y fechas', async () => {
  let filter;
  const models = makeModels({ Categoria: {
    find: (value) => { filter = value; return queryResult([categoryRoot, { ...categoryChild, activa: false }]); }
  } });
  const service = createAdminCategoryService(models);
  const result = await service.listCategories({ nombre: 'Rem.era', activa: false });
  assert.deepEqual(filter, { nombre: { $regex: 'Rem\\.era', $options: 'i' }, activa: false });
  assert.equal(result.length, 2);
  assert.deepEqual(result[1].padre, { id: ROOT_ID, nombre: 'Ropa', slug: 'ropa' });
  assert.equal(result[0].cantidadProductos, 4);
  assert.equal(result[0].creadoEn, categoryRoot.createdAt);
});

test('consulta por ID incluye categoría padre, subcategorías y productos asociados', async () => {
  const service = createAdminCategoryService(makeModels());
  const result = await service.getCategoryById(ROOT_ID);
  assert.equal(result.id, ROOT_ID);
  assert.equal(result.cantidadProductos, 4);
  assert.deepEqual(result.subcategorias.map((item) => item.id), [CHILD_ID]);
  await assert.rejects(service.getCategoryById('id-invalido'), (error) => error.statusCode === 400);
  const missing = createAdminCategoryService(makeModels({ Categoria: { findOne: async () => null } }));
  await assert.rejects(missing.getCategoryById(ROOT_ID), (error) => error.statusCode === 404);
});

test('crea categoría activa por defecto y acepta una categoría padre existente', async () => {
  let created;
  const service = createAdminCategoryService(makeModels({ Categoria: {
    findOne: async ({ _id, slug }) => _id ? categoryRoot : (slug === 'nueva' ? null : null),
    create: async (data) => { created = data; return { _id: NEW_ID, ...data }; }
  } }));
  const result = await service.createCategory({ nombre: 'Accesorios', slug: 'nueva', padreId: ROOT_ID });
  assert.deepEqual(created, { nombre: 'Accesorios', slug: 'nueva', activa: true, padreId: ROOT_ID });
  assert.equal(result.id, NEW_ID);
  assert.equal(result.padre.id, ROOT_ID);
});

test('valida nombre, slug, estado, campos inesperados y categoría padre inexistente', async () => {
  const service = createAdminCategoryService(makeModels());
  await assert.rejects(service.createCategory({ nombre: ' ', slug: 'nueva' }), (error) => error.statusCode === 400);
  await assert.rejects(service.createCategory({ nombre: 'Nueva', slug: '' }), (error) => error.statusCode === 400);
  await assert.rejects(service.createCategory({ nombre: 'Nueva', slug: 'nueva', activa: 'true' }), (error) => error.statusCode === 400);
  await assert.rejects(service.createCategory({ nombre: 'Nueva', slug: 'nueva', internal: true }), (error) => error.statusCode === 400);
  await assert.rejects(service.createCategory({ nombre: 'Nueva', slug: 'nueva', padreId: 'not-an-id' }), (error) => error.statusCode === 400);
  const missingParent = createAdminCategoryService(makeModels({ Categoria: { findOne: async () => null } }));
  await assert.rejects(missingParent.createCategory({ nombre: 'Nueva', slug: 'nueva', padreId: CHILD_ID }), (error) => error.statusCode === 404);
});

test('rechaza slugs duplicados antes de escribir y traduce carreras de índice único', async () => {
  const duplicate = createAdminCategoryService(makeModels({ Categoria: { findOne: async () => categoryRoot } }));
  await assert.rejects(duplicate.createCategory({ nombre: 'Otra', slug: 'ropa' }), (error) => error.statusCode === 409);
  const race = createAdminCategoryService(makeModels({ Categoria: {
    findOne: async () => null,
    create: async () => { throw { code: 11000 }; }
  } }));
  await assert.rejects(race.createCategory({ nombre: 'Otra', slug: 'otra' }), (error) => error.statusCode === 409);
});

test('edita campos admitidos, evita slugs duplicados y rechaza IDs o propiedades incorrectas', async () => {
  let update;
  const service = createAdminCategoryService(makeModels({ Categoria: {
    findByIdAndUpdate: async (id, data) => { update = data; return { ...categoryRoot, _id: id, ...data }; },
    findOne: async (filter) => filter._id === ROOT_ID ? categoryRoot : null
  } }));
  const result = await service.updateCategory(ROOT_ID, { nombre: 'Ropa vegana', slug: 'ropa-vegana', activa: false });
  assert.deepEqual(update, { nombre: 'Ropa vegana', slug: 'ropa-vegana', activa: false });
  assert.equal(result.activa, false);
  await assert.rejects(service.updateCategory('bad-id', { nombre: 'Nueva' }), (error) => error.statusCode === 400);
  await assert.rejects(service.updateCategory(ROOT_ID, { productos: [] }), (error) => error.statusCode === 400);
  await assert.rejects(service.updateCategory(ROOT_ID, { activa: 'false' }), (error) => error.statusCode === 400);
  const duplicate = createAdminCategoryService(makeModels({ Categoria: {
    findOne: async (filter) => filter._id === ROOT_ID ? categoryRoot : categoryChild
  } }));
  await assert.rejects(duplicate.updateCategory(ROOT_ID, { slug: 'remeras' }), (error) => error.statusCode === 409);
  const missing = createAdminCategoryService(makeModels({ Categoria: { findOne: async () => null } }));
  await assert.rejects(missing.updateCategory(ROOT_ID, { nombre: 'Nueva' }), (error) => error.statusCode === 404);
});

test('previene autorreferencias y ciclos indirectos al cambiar la categoría padre', async () => {
  const service = createAdminCategoryService(makeModels());
  await assert.rejects(service.updateCategory(ROOT_ID, { padreId: ROOT_ID }), (error) => error.statusCode === 400);
  await assert.rejects(service.updateCategory(ROOT_ID, { padreId: CHILD_ID }), (error) => error.statusCode === 400);
});

test('desactivar conserva la relación de productos y el catálogo público omite categorías inactivas', async () => {
  let update;
  const service = createAdminCategoryService(makeModels({ Categoria: {
    findByIdAndUpdate: async (id, data) => { update = { id, data }; return { ...categoryRoot, _id: id, ...data }; }
  } }));
  await service.updateCategory(ROOT_ID, { activa: false });
  assert.deepEqual(update.data, { activa: false });
  assert.equal(Object.hasOwn(update.data, 'productos'), false);
  const catalogSource = fs.readFileSync(path.join(__dirname, '../src/services/catalogService.js'), 'utf8');
  assert.match(catalogSource, /Categoria\.find\(\{ activa: true \}\)/);
  assert.match(catalogSource, /Categoria\.findOne\(\{ _id: product\.categoriaId, activa: true \}\)/);
});

test('el PATCH general modifica activa y no se crea una ruta de visibilidad duplicada', () => {
  const routes = createAdminCategoryRoutes(makeModels());
  const paths = routes.stack.filter((layer) => layer.route).map((layer) => ({
    path: layer.route.path, method: Object.keys(layer.route.methods)[0]
  }));
  assert.ok(paths.some((route) => route.method === 'patch' && route.path === '/:id'));
  assert.equal(paths.some((route) => route.path === '/:id/visibility'), false);
  assert.equal(paths.some((route) => route.method === 'delete'), false);
});

test('las rutas de categorías no se montan sin autenticación y parsean filtros válidos', () => {
  const appSource = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');
  assert.doesNotMatch(appSource, /adminCategoryRoutes|\/api\/admin\/categories/);
  assert.deepEqual(parseCategoryFilters({ nombre: 'Remeras', activa: 'false' }), { nombre: 'Remeras', activa: false });
  assert.throws(() => parseCategoryFilters({ activa: '0' }), (error) => error.statusCode === 400);
  assert.throws(() => parseCategoryFilters({ sort: 'nombre' }), (error) => error.statusCode === 400);
});

test('controller reenvía errores al middleware', async () => {
  const controller = createAdminCategoryController({ listCategories: async () => { throw AppError.noEncontrado('No encontrada'); } });
  const error = await new Promise((resolve) => controller.list({ query: {} }, {}, resolve));
  assert.equal(error.statusCode, 404);
});
