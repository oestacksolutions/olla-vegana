const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createCatalogService, calculateAvailableStock } = require('../src/services/catalogService');
const createCatalogController = require('../src/controllers/catalogController');
const AppError = require('../src/utils/AppError');

const ahora = new Date('2026-10-28T12:00:00.000Z');

test('lista productos activos con filtro de categoria y destacados primero', async () => {
  let consulta;
  const service = createCatalogService({
    producto: {
      findMany: async (args) => {
        consulta = args;
        return [{ slug: 'remera', destacado: true, precioBase: '45000.00' }];
      }
    }
  });

  const products = await service.listProducts('remeras');

  assert.deepEqual(consulta.where, {
    activo: true,
    categoria: { is: { activa: true, slug: 'remeras' } }
  });
  assert.deepEqual(consulta.orderBy, [
    { destacado: 'desc' },
    { creadoEn: 'desc' }
  ]);
  assert.equal(products.length, 1);
  assert.equal(products[0].precioBase, '45000.00');
});

test('lista solo categorias activas e incluye sus slugs', async () => {
  let consulta;
  const service = createCatalogService({
    categoria: {
      findMany: async (args) => {
        consulta = args;
        return [{ nombre: 'Remeras', slug: 'remeras' }];
      }
    }
  });

  const categories = await service.listCategories();

  assert.deepEqual(consulta.where, { activa: true });
  assert.equal(consulta.select.slug, true);
  assert.deepEqual(categories, [{ nombre: 'Remeras', slug: 'remeras' }]);
});

test('detalle filtra producto y variantes ocultos, ordena imagenes y calcula stock', async () => {
  let consulta;
  const product = {
    id: 'producto-1',
    nombre: 'Remera',
    slug: 'remera',
    descripcion: 'Descripcion',
    precioBase: '45000.00',
    destacado: false,
    categoria: { nombre: 'Remeras', slug: 'remeras' },
    imagenes: [{ id: 'imagen-1', url: '/imagen', posicion: 0 }],
    variantes: [
      {
        id: 'variante-l',
        precio: null,
        stock: 5,
        reservas: [
          { cantidad: 2, estado: 'ACTIVA', venceEn: new Date('2026-10-28T13:00:00.000Z') },
          { cantidad: 5, estado: 'ACTIVA', venceEn: new Date('2026-10-28T11:59:00.000Z') },
          { cantidad: 4, estado: 'CONFIRMADA', venceEn: new Date('2026-10-28T14:00:00.000Z') },
          { cantidad: 1, estado: 'LIBERADA', venceEn: new Date('2026-10-28T14:00:00.000Z') }
        ],
        valores: [{ valorAtributo: { valor: 'L', atributo: { nombre: 'Talle' } } }]
      },
      {
        id: 'variante-sin-stock',
        precio: null,
        stock: 0,
        reservas: [],
        valores: [{ valorAtributo: { valor: 'Negro', atributo: { nombre: 'Color' } } }]
      }
    ]
  };
  const service = createCatalogService({
    producto: {
      findFirst: async (args) => {
        consulta = args;
        return product;
      }
    }
  }, { ahora: () => ahora });

  const result = await service.getProductBySlug('remera');

  assert.deepEqual(consulta.where, {
    slug: 'remera',
    activo: true,
    categoria: { is: { activa: true } }
  });
  assert.deepEqual(consulta.select.imagenes.orderBy, [
    { posicion: 'asc' },
    { id: 'asc' }
  ]);
  assert.deepEqual(consulta.select.variantes.where, { activa: true });
  assert.deepEqual(consulta.select.variantes.select.reservas.where, {
    estado: 'ACTIVA',
    venceEn: { gt: ahora }
  });
  assert.equal(result.variantes[0].stockDisponible, 3);
  assert.equal(result.variantes[0].agotada, false);
  assert.deepEqual(result.variantes[0].valores, [{ atributo: 'Talle', valor: 'L' }]);
  assert.equal(result.variantes[1].stockDisponible, 0);
  assert.equal(result.variantes[1].agotada, true);
});

test('la disponibilidad no descuenta reservas vencidas, confirmadas ni liberadas y no es negativa', () => {
  const available = calculateAvailableStock(4, [
    { cantidad: 7, estado: 'ACTIVA', venceEn: new Date('2026-10-28T13:00:00.000Z') },
    { cantidad: 2, estado: 'ACTIVA', venceEn: new Date('2026-10-28T11:00:00.000Z') },
    { cantidad: 3, estado: 'CONFIRMADA', venceEn: new Date('2026-10-28T13:00:00.000Z') },
    { cantidad: 3, estado: 'LIBERADA', venceEn: new Date('2026-10-28T13:00:00.000Z') }
  ], ahora);

  assert.equal(available, 0);
  assert.equal(calculateAvailableStock(-2, [], ahora), 0);
});

test('producto ausente u oculto se trata como 404', async () => {
  const service = createCatalogService({ producto: { findFirst: async () => null } });

  await assert.rejects(service.getProductBySlug('oculto'), (error) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.statusCode, 404);
    assert.equal(error.message, 'Producto no encontrado');
    return true;
  });
});

test('el controller reenvia errores inesperados al middleware global', async () => {
  const unexpectedError = new Error('fallo simulado');
  const controller = createCatalogController({
    listProducts: async () => { throw unexpectedError; }
  });

  const receivedError = await new Promise((resolve) => {
    controller.listProducts({ query: {} }, {}, resolve);
  });

  assert.equal(receivedError, unexpectedError);
});

test('el filtro categoria repetido o vacio devuelve error de solicitud', async () => {
  const controller = createCatalogController({ listProducts: async () => [] });

  const receivedError = await new Promise((resolve) => {
    controller.listProducts({ query: { categoria: ['remeras', 'gorras'] } }, {}, resolve);
  });

  assert.ok(receivedError instanceof AppError);
  assert.equal(receivedError.statusCode, 400);
});
