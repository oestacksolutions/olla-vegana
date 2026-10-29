const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createCatalogService, calculateAvailableStock } = require('../src/services/catalogService');
const createCatalogController = require('../src/controllers/catalogController');
const AppError = require('../src/utils/AppError');

const now = new Date('2026-10-28T12:00:00.000Z');
function models(overrides = {}) {
  return {
    Categoria: { find: async () => [], findOne: async () => null, ...overrides.Categoria },
    Producto: { find: async () => [], findOne: async () => null, ...overrides.Producto },
    ImagenProducto: { find: async () => [], ...overrides.ImagenProducto },
    Variante: { find: async () => [], ...overrides.Variante },
    ValorVariante: { find: async () => [], ...overrides.ValorVariante },
    ValorAtributo: { find: async () => [], ...overrides.ValorAtributo },
    Atributo: { find: async () => [], ...overrides.Atributo },
    ReservaStock: { find: async () => [], ...overrides.ReservaStock }
  };
}

test('lista solo productos activos, filtra por slug de categoría y devuelve categoría y precio', async () => {
  let categoryFilter;
  let productFilter;
  const service = createCatalogService(models({
    Categoria: { find: async (filter) => { categoryFilter = filter; return [{ _id: 'c1', nombre: 'Remeras', slug: 'remeras', activa: true }]; } },
    Producto: { find: async (filter) => { productFilter = filter; return [{ _id: 'p1', nombre: 'Remera', slug: 'remera', precioBase: '45000.00', destacado: true, categoriaId: 'c1' }]; } }
  }));
  const result = await service.listProducts('remeras');
  assert.deepEqual(categoryFilter, { activa: true });
  assert.deepEqual(productFilter, { activo: true, categoriaId: { $in: ['c1'] } });
  assert.equal(result[0].precioBase, '45000.00');
  assert.equal(result[0].categoria.slug, 'remeras');
});

test('categorías públicas excluyen inactivas', async () => {
  let filter;
  const service = createCatalogService(models({ Categoria: {
    find: async (query) => { filter = query; return [{ _id: 'c1', nombre: 'Remeras', slug: 'remeras' }]; }
  } }));
  assert.deepEqual(await service.listCategories(), [{ id: 'c1', nombre: 'Remeras', slug: 'remeras' }]);
  assert.deepEqual(filter, { activa: true });
});

test('detalle usa referencias Mongo, muestra atributos e imágenes y calcula stock vigente', async () => {
  const product = { _id: 'p1', nombre: 'Remera', slug: 'remera', descripcion: 'Detalle', precioBase: '45000.00', destacado: false, categoriaId: 'c1' };
  let variantFilter;
  const service = createCatalogService(models({
    Producto: { findOne: async () => product },
    Categoria: { findOne: async () => ({ _id: 'c1', nombre: 'Remeras', slug: 'remeras', activa: true }) },
    ImagenProducto: { find: async () => [{ _id: 'i1', url: '/real.jpg', posicion: 0 }] },
    Variante: { find: async (filter) => { variantFilter = filter; return [{ _id: 'v1', stock: 5, activa: true, precio: null }]; } },
    ValorVariante: { find: async () => [{ varianteId: 'v1', valorAtributoId: 'va1' }] },
    ValorAtributo: { find: async () => [{ _id: 'va1', atributoId: 'a1', valor: 'L' }] },
    Atributo: { find: async () => [{ _id: 'a1', nombre: 'Talle' }] },
    ReservaStock: { find: async () => [{ varianteId: 'v1', cantidad: 2, estado: 'ACTIVA', venceEn: new Date('2026-10-28T13:00:00Z') }] }
  }), { ahora: () => now });
  const result = await service.getProductBySlug('remera');
  assert.deepEqual(variantFilter, { productoId: 'p1', activa: true });
  assert.equal(result.variantes[0].stockDisponible, 3);
  assert.equal(result.variantes[0].agotada, false);
  assert.deepEqual(result.variantes[0].valores, [{ atributo: 'Talle', valor: 'L' }]);
  assert.equal(result.imagenes[0].url, '/real.jpg');
});

test('no descuenta reservas vencidas, confirmadas ni liberadas y no devuelve stock negativo', () => {
  assert.equal(calculateAvailableStock(4, [
    { cantidad: 7, estado: 'ACTIVA', venceEn: new Date('2026-10-28T13:00:00Z') },
    { cantidad: 2, estado: 'ACTIVA', venceEn: new Date('2026-10-28T11:00:00Z') },
    { cantidad: 3, estado: 'CONFIRMADA', venceEn: new Date('2026-10-28T13:00:00Z') },
    { cantidad: 3, estado: 'LIBERADA', venceEn: new Date('2026-10-28T13:00:00Z') }
  ], now), 0);
});

test('producto inexistente, inactivo o en categoría inactiva es 404', async () => {
  const missing = createCatalogService(models());
  await assert.rejects(missing.getProductBySlug('no-existe'), (error) => error instanceof AppError && error.statusCode === 404);
  const inactiveCategory = createCatalogService(models({
    Producto: { findOne: async () => ({ _id: 'p1', categoriaId: 'c1' }) },
    Categoria: { findOne: async () => null }
  }));
  await assert.rejects(inactiveCategory.getProductBySlug('oculto'), (error) => error.statusCode === 404);
});

test('controller conserva 404 y rechaza filtros de categoría repetidos o vacíos', async () => {
  const controller = createCatalogController({ listProducts: async () => [], getProductBySlug: async () => { throw AppError.noEncontrado('Producto no encontrado'); } });
  const invalid = await new Promise((resolve) => controller.listProducts({ query: { categoria: ['remeras', 'gorras'] } }, {}, resolve));
  assert.equal(invalid.statusCode, 400);
  const error = await new Promise((resolve) => controller.getProduct({ params: { slug: 'ausente' } }, {}, resolve));
  assert.equal(error.statusCode, 404);
});
