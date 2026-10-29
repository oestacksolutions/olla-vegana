const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createCartValidationService } = require('../src/services/cartValidationService');
const createCartController = require('../src/controllers/cartController');
const createCartRoutes = require('../src/routes/cartRoutes');
const AppError = require('../src/utils/AppError');

const ids = {
  producto: '64b000000000000000000001',
  productoOtro: '64b000000000000000000002',
  categoria: '64b000000000000000000003',
  variante: '64b000000000000000000004',
  valor: '64b000000000000000000005',
  atributo: '64b000000000000000000006'
};
const now = new Date('2026-10-29T12:00:00.000Z');

function makeModels(overrides = {}) {
  const calls = [];
  const data = {
    Producto: [{ _id: ids.producto, nombre: 'Remera oficial', slug: 'remera', descripcion: 'Descripción', precioBase: '45000.00', activo: true, categoriaId: ids.categoria }],
    Variante: [{ _id: ids.variante, productoId: ids.producto, precio: null, stock: 10, activa: true }],
    Categoria: [{ _id: ids.categoria, nombre: 'Remeras', slug: 'remeras', activa: true }],
    ValorVariante: [{ varianteId: ids.variante, valorAtributoId: ids.valor }],
    ValorAtributo: [{ _id: ids.valor, atributoId: ids.atributo, valor: 'L' }],
    Atributo: [{ _id: ids.atributo, nombre: 'Talle' }],
    ReservaStock: [],
    MovimientoStock: [],
    Pedido: []
  };
  for (const [name, docs] of Object.entries(overrides)) data[name] = docs;
  const matches = (doc, filter) => Object.entries(filter).every(([key, expected]) => {
    if (key === '_id' && expected?.$in) return expected.$in.some((id) => String(id) === String(doc._id));
    if ((key === 'varianteId' || key === 'productoId') && expected?.$in) {
      return expected.$in.some((id) => String(id) === String(doc[key]));
    }
    return String(doc[key]) === String(expected);
  });
  const models = {};
  for (const name of Object.keys(data)) {
    models[name] = {
      find(filter) {
        calls.push({ model: name, filter });
        return Promise.resolve(data[name].filter((doc) => matches(doc, filter)));
      },
      create() { throw new Error(`${name}.create no debe ejecutarse`); },
      updateOne() { throw new Error(`${name}.updateOne no debe ejecutarse`); },
      deleteMany() { throw new Error(`${name}.deleteMany no debe ejecutarse`); }
    };
  }
  return { models, calls, data };
}

function createService(overrides, options = {}) {
  const fixture = makeModels(overrides);
  const service = createCartValidationService(fixture.models, { ahora: () => now, ...options });
  return { ...fixture, service };
}

const cart = (items = [{ productoId: ids.producto, varianteId: ids.variante, cantidad: 2 }]) => ({ articulos: items });

test('valida un carrito, devuelve datos oficiales y consolida precio y subtotal exactos', async () => {
  const { service } = createService();
  const result = await service.validateCart(cart());
  assert.equal(result.valido, true);
  assert.equal(result.total, '90000.00');
  assert.equal(result.articulos[0].nombre, 'Remera oficial');
  assert.equal(result.articulos[0].slug, 'remera');
  assert.deepEqual(result.articulos[0].variante, [{ atributo: 'Talle', valor: 'L' }]);
  assert.equal(result.articulos[0].precioUnitario, '45000.00');
  assert.equal(result.articulos[0].subtotal, '90000.00');
  assert.equal(result.articulos[0].stockDisponible, 10);
});

test('un carrito vacío es semánticamente inválido', async () => {
  const { service } = createService();
  const result = await service.validateCart(cart([]));
  assert.equal(result.valido, false);
  assert.equal(result.total, null);
  assert.equal(result.errores[0].codigo, 'CARRITO_VACIO');
});

test('rechaza cuerpos, líneas, IDs, cantidades y campos de compra inválidos', async () => {
  const { service } = createService();
  const invalidBodies = [null, [], {}, { articulos: [], precio: 50 }, { articulos: [{}] },
    { articulos: [{ productoId: 'bad', varianteId: ids.variante, cantidad: 1 }] },
    { articulos: [{ productoId: ids.producto, varianteId: ids.variante, cantidad: 0 }] },
    { articulos: [{ productoId: ids.producto, varianteId: ids.variante, cantidad: -1 }] },
    { articulos: [{ productoId: ids.producto, varianteId: ids.variante, cantidad: 1.5 }] },
    { articulos: [{ productoId: ids.producto, varianteId: ids.variante, cantidad: '2' }] },
    { articulos: [{ productoId: ids.producto, varianteId: ids.variante, cantidad: 101 }] },
    { articulos: [{ productoId: ids.producto, varianteId: ids.variante, cantidad: 1, precio: 1 }] }];
  for (const body of invalidBodies) await assert.rejects(service.validateCart(body), (error) => error instanceof AppError && error.statusCode === 400);
});

test('limita líneas de entrada', async () => {
  const { service } = createService();
  const items = Array.from({ length: 51 }, () => ({ productoId: ids.producto, varianteId: ids.variante, cantidad: 1 }));
  await assert.rejects(service.validateCart(cart(items)), (error) => error.statusCode === 400);
});

test('rechaza producto inexistente, inactivo y categoría inactiva', async () => {
  const missing = createService({ Producto: [] });
  assert.equal((await missing.service.validateCart(cart())).errores[0].codigo, 'PRODUCTO_NO_DISPONIBLE');
  const inactive = createService({ Producto: [{ ...makeModels().data.Producto[0], activo: false }] });
  assert.equal((await inactive.service.validateCart(cart())).errores[0].codigo, 'PRODUCTO_NO_DISPONIBLE');
  const inactiveCategory = createService({ Categoria: [{ ...makeModels().data.Categoria[0], activa: false }] });
  assert.equal((await inactiveCategory.service.validateCart(cart())).errores[0].codigo, 'CATEGORIA_NO_DISPONIBLE');
});

test('rechaza variante inexistente, de otro producto o inactiva', async () => {
  const missing = createService({ Variante: [] });
  assert.equal((await missing.service.validateCart(cart())).errores[0].codigo, 'VARIANTE_NO_DISPONIBLE');
  const wrongProduct = createService({ Variante: [{ ...makeModels().data.Variante[0], productoId: ids.productoOtro }] });
  assert.equal((await wrongProduct.service.validateCart(cart())).errores[0].codigo, 'VARIANTE_NO_CORRESPONDE');
  const inactive = createService({ Variante: [{ ...makeModels().data.Variante[0], activa: false }] });
  assert.equal((await inactive.service.validateCart(cart())).errores[0].codigo, 'VARIANTE_INACTIVA');
});

test('acepta variante sin atributos y devuelve arreglo vacío', async () => {
  const { service } = createService({ ValorVariante: [] });
  const result = await service.validateCart(cart());
  assert.equal(result.valido, true);
  assert.deepEqual(result.articulos[0].variante, []);
});

test('consolida repeticiones de variante y rechaza la suma que supera el límite', async () => {
  const { service } = createService();
  const result = await service.validateCart(cart([
    { productoId: ids.producto, varianteId: ids.variante, cantidad: 2 },
    { productoId: ids.producto, varianteId: ids.variante, cantidad: 3 }
  ]));
  assert.equal(result.articulos.length, 1);
  assert.equal(result.articulos[0].cantidad, 5);
  assert.deepEqual(result.articulos[0].indicesOriginales, [0, 1]);
  await assert.rejects(service.validateCart(cart([
    { productoId: ids.producto, varianteId: ids.variante, cantidad: 60 },
    { productoId: ids.producto, varianteId: ids.variante, cantidad: 41 }
  ])), (error) => error.statusCode === 400);
});

test('comprueba stock físico menos reservas vigentes y solo rechaza cuando no alcanza', async () => {
  const reservations = [
    { varianteId: ids.variante, estado: 'ACTIVA', cantidad: 2, venceEn: new Date('2026-10-29T13:00:00Z') },
    { varianteId: ids.variante, estado: 'ACTIVA', cantidad: 8, venceEn: new Date('2026-10-29T11:00:00Z') },
    { varianteId: ids.variante, estado: 'CONFIRMADA', cantidad: 4, venceEn: new Date('2026-10-29T13:00:00Z') },
    { varianteId: ids.variante, estado: 'LIBERADA', cantidad: 3, venceEn: new Date('2026-10-29T13:00:00Z') }
  ];
  const { service } = createService({ Variante: [{ ...makeModels().data.Variante[0], stock: 5 }], ReservaStock: reservations });
  const enough = await service.validateCart(cart([{ productoId: ids.producto, varianteId: ids.variante, cantidad: 3 }]));
  assert.equal(enough.valido, true);
  assert.equal(enough.articulos[0].cantidadReservada, 2);
  assert.equal(enough.articulos[0].stockDisponible, 3);
  const insufficient = await service.validateCart(cart([{ productoId: ids.producto, varianteId: ids.variante, cantidad: 4 }]));
  assert.equal(insufficient.valido, false);
  assert.equal(insufficient.total, null);
  assert.equal(insufficient.errores[0].codigo, 'STOCK_INSUFICIENTE');
});

test('no afirma disponibilidad cuando las reservas superan el stock y registra la inconsistencia', async () => {
  const logs = [];
  const { service } = createService({
    Variante: [{ ...makeModels().data.Variante[0], stock: 1 }],
    ReservaStock: [{ varianteId: ids.variante, estado: 'ACTIVA', cantidad: 2, venceEn: new Date('2026-10-29T13:00:00Z') }]
  }, { logger: (entry) => logs.push(entry) });
  const result = await service.validateCart(cart());
  assert.equal(result.valido, false);
  assert.equal(result.errores[0].codigo, 'DISPONIBILIDAD_INCONSISTENTE');
  assert.equal(logs.length, 1);
  assert.equal(logs[0].tipo, 'INCONSISTENCIA_STOCK');
});

test('usa Decimal128 de variante o precio base y no admite precisión menor que centavos', async () => {
  const decimalVariant = { toString: () => '123.45' };
  const withVariantPrice = createService({ Variante: [{ ...makeModels().data.Variante[0], precio: decimalVariant }] });
  const result = await withVariantPrice.service.validateCart(cart());
  assert.equal(result.articulos[0].precioUnitario, '123.45');
  assert.equal(result.total, '246.90');
  const withLegacyInteger = createService({ Producto: [{ ...makeModels().data.Producto[0], precioBase: 27000 }] });
  assert.equal((await withLegacyInteger.service.validateCart(cart())).total, '54000.00');
  const invalidPrice = createService({ Producto: [{ ...makeModels().data.Producto[0], precioBase: '1.001' }] });
  assert.equal((await invalidPrice.service.validateCart(cart())).errores[0].codigo, 'PRECIO_INVALIDO');
});

test('un artículo inválido invalida el carrito entero y no devuelve un total parcial', async () => {
  const { service } = createService();
  const result = await service.validateCart(cart([
    { productoId: ids.producto, varianteId: ids.variante, cantidad: 1 },
    { productoId: ids.productoOtro, varianteId: ids.variante, cantidad: 1 }
  ]));
  assert.equal(result.valido, false);
  assert.equal(result.articulos[0].valido, true);
  assert.equal(result.articulos[1].valido, false);
  assert.equal(result.errores.length, 1);
  assert.equal(result.total, null);
});

test('agrupa las consultas por colecciones y solo realiza lecturas', async () => {
  const { service, calls, models } = createService();
  await service.validateCart(cart([
    { productoId: ids.producto, varianteId: ids.variante, cantidad: 1 },
    { productoId: ids.producto, varianteId: ids.variante, cantidad: 1 }
  ]));
  assert.equal(calls.filter(({ model }) => model === 'Producto').length, 1);
  assert.equal(calls.filter(({ model }) => model === 'Variante').length, 1);
  assert.ok(Object.values(models).every((model) => typeof model.create === 'function'));
  // Los métodos de escritura de los mocks lanzan si el servicio intenta usarlos.
});

test('propaga errores de MongoDB al middleware central', async () => {
  const fixture = makeModels();
  fixture.models.Producto.find = () => Promise.reject(new Error('db unavailable'));
  const service = createCartValidationService(fixture.models, { ahora: () => now });
  await assert.rejects(service.validateCart(cart()), /db unavailable/);
});

test('controller devuelve 200 o 422 con el contrato documentado y reenvía fallas', async () => {
  const sent = [];
  const validController = createCartController({ validateCart: async () => ({ valido: true, articulos: [], errores: [], total: '0.00' }) });
  await new Promise((resolve, reject) => validController.validateCart({ body: {} }, {
    status(code) { sent.push(code); return this; },
    json(body) { sent.push(body); resolve(); }
  }, reject));
  assert.equal(sent[0], 200);
  assert.equal(sent[1].valido, true);

  sent.length = 0;
  const controller = createCartController({ validateCart: async () => ({ valido: false, articulos: [], errores: [], total: null }) });
  await new Promise((resolve, reject) => controller.validateCart({ body: {} }, {
    status(code) { sent.push(code); return this; },
    json(body) { sent.push(body); resolve(); }
  }, reject));
  assert.equal(sent[0], 422);
  assert.equal(sent[1].valido, false);

  let forwarded;
  const broken = createCartController({ validateCart: async () => { throw new Error('database'); } });
  await new Promise((resolve) => broken.validateCart({ body: {} }, {}, (error) => { forwarded = error; resolve(); }));
  assert.match(forwarded.message, /database/);
});

test('la ruta registra únicamente POST /cart/validate', () => {
  const router = createCartRoutes({ validateCart() {} });
  const route = router.stack.map((layer) => layer.route).find(Boolean);
  assert.equal(route.path, '/cart/validate');
  assert.equal(route.methods.post, true);
  assert.equal(route.methods.get, undefined);
  assert.ok(express);
});
