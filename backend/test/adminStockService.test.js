const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createAdminStockService } = require('../src/services/adminStockService');
const createAdminStockRoutes = require('../src/routes/adminStockRoutes');
const { createAdminStockController, parseInventoryQuery } = require('../src/controllers/adminStockController');
const { calculateStockAvailability } = require('../src/utils/stockAvailability');

const PRODUCT_A = '507f1f77bcf86cd799439011';
const PRODUCT_B = '507f1f77bcf86cd799439021';
const VARIANT_A = '507f1f77bcf86cd799439012';
const VARIANT_B = '507f1f77bcf86cd799439022';
const ADMIN = '507f1f77bcf86cd799439013';
const ATTR_SIZE = '507f1f77bcf86cd799439014';
const VALUE_L = '507f1f77bcf86cd799439015';
const NOW = new Date('2026-10-29T12:00:00.000Z');

function queryResult(rows) {
  return {
    sort(spec) {
      const fields = Object.entries(spec);
      rows.sort((left, right) => {
        for (const [key, direction] of fields) {
          if (left[key] > right[key]) return direction;
          if (left[key] < right[key]) return -direction;
        }
        return 0;
      });
      return this;
    },
    skip(value) { rows = rows.slice(value); return this; },
    limit(value) { rows = rows.slice(0, value); return this; },
    session() { return this; },
    select() { return this; },
    lean() { return this; },
    exec: async () => rows
  };
}

function matches(document, filter = {}) {
  return Object.entries(filter).every(([key, expected]) => {
    const actual = document[key];
    if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
      if (expected.$in) return expected.$in.some((value) => String(value) === String(actual));
      if (expected.$gt !== undefined) return new Date(actual) > expected.$gt;
    }
    return String(actual) === String(expected);
  });
}

function makeSetup({ variants, reservations = [], movements = [], products, failMovement = false, logger = () => {} } = {}) {
  const data = {
    variants: variants || [{ _id: VARIANT_A, productoId: PRODUCT_A, stock: 10, activa: true }],
    reservations: [...reservations],
    movements: [...movements]
  };
  const productsData = products || [
    { _id: PRODUCT_A, nombre: 'Remera', slug: 'remera' },
    { _id: PRODUCT_B, nombre: 'Gorra', slug: 'gorra' }
  ];
  const currentTime = () => NOW;
  let nextMovementId = 40;
  let writeFailure = failMovement;
  let queue = Promise.resolve();
  const session = {
    withTransaction: async (operation) => {
      let release;
      const wait = queue;
      queue = new Promise((resolve) => { release = resolve; });
      await wait;
      const snapshot = structuredClone(data);
      try { return await operation(); }
      catch (error) {
        data.variants = snapshot.variants;
        data.reservations = snapshot.reservations;
        data.movements = snapshot.movements;
        throw error;
      } finally { release(); }
    },
    endSession: async () => {}
  };
  const models = {
    Producto: {
      findById: (id) => queryResult(productsData.find((item) => String(item._id) === String(id)) || null),
      find: (filter) => queryResult(productsData.filter((item) => matches(item, filter)))
    },
    Variante: {
      findById: (id) => queryResult(data.variants.find((item) => String(item._id) === String(id)) || null),
      find: (filter) => queryResult(data.variants.filter((item) => matches(item, filter))),
      countDocuments: async (filter) => data.variants.filter((item) => matches(item, filter)).length,
      aggregate: async (pipeline) => {
        const match = pipeline.find((stage) => stage.$match)?.$match || {};
        const threshold = pipeline.find((stage) => stage.$match?.__disponible)?.$match.__disponible.$lte;
        const facet = pipeline.find((stage) => stage.$facet)?.$facet;
        const skip = facet.rows.find((stage) => stage.$skip !== undefined).$skip;
        const limit = facet.rows.find((stage) => stage.$limit !== undefined).$limit;
        const found = data.variants.filter((item) => matches(item, match)).filter((variant) => {
          const active = data.reservations.filter((reservation) => String(reservation.varianteId) === String(variant._id));
          return calculateStockAvailability(variant.stock, active, currentTime()).stockDisponible <= threshold;
        }).sort((a, b) => String(a.productoId).localeCompare(String(b.productoId)) || String(a._id).localeCompare(String(b._id)));
        return [{ metadata: found.length ? [{ total: found.length }] : [], rows: found.slice(skip, skip + limit) }];
      },
      findOneAndUpdate: async (filter, update) => {
        const variant = data.variants.find((item) => matches(item, filter));
        if (!variant) return null;
        variant.stock += update.$inc.stock;
        return variant;
      }
    },
    ReservaStock: {
      collection: { name: 'reservastocks' },
      find: (filter) => queryResult(data.reservations.filter((item) => matches(item, filter)))
    },
    MovimientoStock: {
      collection: { indexes: async () => [{ name: 'uniq_movimiento_id_operacion', key: { idOperacion: 1 }, unique: true, partialFilterExpression: { idOperacion: { $type: 'string' } } }] },
      findOne: (filter) => queryResult(data.movements.find((item) => matches(item, filter)) || null),
      find: (filter) => queryResult(data.movements.filter((item) => matches(item, filter))),
      countDocuments: async (filter) => data.movements.filter((item) => matches(item, filter)).length,
      create: async ([input]) => {
        if (writeFailure) { writeFailure = false; throw new Error('movement write failed'); }
        if (data.movements.some((item) => item.idOperacion === input.idOperacion)) {
          const error = new Error('duplicate key'); error.code = 11000; throw error;
        }
        const movement = { _id: (nextMovementId++).toString(16).padStart(24, '0'), ...input };
        data.movements.push(movement);
        return [movement];
      }
    },
    ValorVariante: {
      find: (filter) => queryResult([
        { varianteId: VARIANT_A, valorAtributoId: VALUE_L }
      ].filter((item) => matches(item, filter)))
    },
    ValorAtributo: { find: () => queryResult([{ _id: VALUE_L, atributoId: ATTR_SIZE, valor: 'L' }]) },
    Atributo: { find: () => queryResult([{ _id: ATTR_SIZE, nombre: 'Talle' }]) }
  };
  return {
    data, models,
    service: createAdminStockService(models, { startSession: async () => session, ahora: currentTime, logger })
  };
}

function futureReservation(variantId = VARIANT_A, overrides = {}) {
  return { varianteId: variantId, estado: 'ACTIVA', cantidad: 2, venceEn: new Date('2026-10-29T13:00:00Z'), ...overrides };
}

function adjustment(overrides = {}) {
  return { tipo: 'INGRESO', cantidad: 4, motivo: 'Recepción proveedor', idOperacion: 'stock-op-0001', ...overrides };
}

test('consulta físico, reservado, disponible, producto, variante y atributos', async () => {
  const setup = makeSetup({ reservations: [
    futureReservation(), futureReservation(VARIANT_A, { cantidad: 8, venceEn: new Date('2026-10-29T11:00:00Z') }),
    futureReservation(VARIANT_A, { cantidad: 4, estado: 'CONFIRMADA' }),
    futureReservation(VARIANT_A, { cantidad: 3, estado: 'LIBERADA' })
  ] });
  const inventory = await setup.service.getInventory(VARIANT_A);
  assert.equal(inventory.producto.nombre, 'Remera');
  assert.equal(inventory.variante.activa, true);
  assert.deepEqual(inventory.variante.valores.map((value) => [value.atributo, value.valor]), [['Talle', 'L']]);
  assert.equal(inventory.stockFisico, 10);
  assert.equal(inventory.cantidadReservada, 2);
  assert.equal(inventory.stockDisponible, 8);
  assert.equal(inventory.inconsistente, false);
});

test('variante inexistente devuelve 404', async () => {
  await assert.rejects(makeSetup().service.getInventory('507f1f77bcf86cd799439099'), (error) => error.statusCode === 404);
});

test('lista inventario paginado y filtra producto', async () => {
  const setup = makeSetup({ variants: [
    { _id: VARIANT_A, productoId: PRODUCT_A, stock: 4, activa: true },
    { _id: VARIANT_B, productoId: PRODUCT_B, stock: 8, activa: false }
  ] });
  const page = await setup.service.listInventory({ productoId: PRODUCT_A }, { page: 1, limit: 1 });
  assert.equal(page.paginacion.total, 1);
  assert.equal(page.inventario[0].producto.slug, 'remera');
  assert.equal(page.inventario[0].stockFisico, 4);
});

test('filtro stockBajo usa disponibilidad y pagina los resultados filtrados', async () => {
  const setup = makeSetup({
    variants: [
      { _id: VARIANT_A, productoId: PRODUCT_A, stock: 10, activa: true },
      { _id: VARIANT_B, productoId: PRODUCT_B, stock: 3, activa: true }
    ],
    reservations: [futureReservation(VARIANT_A, { cantidad: 9 })]
  });
  const result = await setup.service.listInventory({ stockBajo: 2 }, { page: 1, limit: 10 });
  assert.deepEqual(result.inventario.map((row) => row.variante.id), [VARIANT_A]);
  assert.equal(result.inventario[0].stockDisponible, 1);
  assert.equal(result.paginacion.total, 1);
});

test('inconsistencia reservas mayor que el físico produce cero y queda registrada para revisión', async () => {
  const logs = [];
  const setup = makeSetup({ reservations: [futureReservation(VARIANT_A, { cantidad: 15 })], logger: (entry) => logs.push(entry) });
  const inventory = await setup.service.getInventory(VARIANT_A);
  assert.equal(inventory.stockDisponible, 0);
  assert.equal(inventory.inconsistente, true);
  assert.ok(inventory.alertas.includes('RESERVAS_SUPERAN_STOCK'));
  assert.equal(logs[0].tipo, 'INCONSISTENCIA_STOCK');
  assert.equal(logs[0].varianteId, VARIANT_A);
});

test('ingreso registra snapshot, administrador y aumenta stock atómicamente', async () => {
  const setup = makeSetup({ reservations: [futureReservation()] });
  const result = await setup.service.adjustStock(VARIANT_A, adjustment(), ADMIN);
  assert.equal(setup.data.variants[0].stock, 14);
  assert.equal(result.movimiento.tipo, 'INGRESO');
  assert.equal(result.movimiento.cantidad, 4);
  assert.equal(result.movimiento.stockAnterior, 10);
  assert.equal(result.movimiento.stockResultante, 14);
  assert.equal(result.movimiento.adminId, ADMIN);
  assert.equal(result.movimiento.idOperacion, 'stock-op-0001');
  assert.equal(result.inventario.cantidadReservada, 2);
  assert.equal(result.inventario.stockDisponible, 12);
});

test('ajuste negativo válido descuenta físico sin tocar reservas', async () => {
  const setup = makeSetup({ reservations: [futureReservation(VARIANT_A, { cantidad: 3 })] });
  const result = await setup.service.adjustStock(VARIANT_A, adjustment({ tipo: 'AJUSTE', cantidad: -2 }), ADMIN);
  assert.equal(setup.data.variants[0].stock, 8);
  assert.equal(result.inventario.cantidadReservada, 3);
  assert.equal(result.inventario.stockDisponible, 5);
  assert.equal(setup.data.movements[0].cantidad, -2);
});

test('rechaza stock negativo y reducción del físico por debajo de reservas', async () => {
  const negative = makeSetup({ variants: [{ _id: VARIANT_A, productoId: PRODUCT_A, stock: 2 }] });
  await assert.rejects(negative.service.adjustStock(VARIANT_A, adjustment({ tipo: 'AJUSTE', cantidad: -3 }), ADMIN), (error) => error.statusCode === 409);
  assert.equal(negative.data.variants[0].stock, 2);

  const reserved = makeSetup({ reservations: [futureReservation(VARIANT_A, { cantidad: 4 })] });
  await assert.rejects(reserved.service.adjustStock(VARIANT_A, adjustment({ tipo: 'AJUSTE', cantidad: -7 }), ADMIN), (error) => error.statusCode === 409);
  assert.equal(reserved.data.variants[0].stock, 10);
});

test('un ingreso positivo puede corregir inconsistencia de físico bajo cero', async () => {
  const setup = makeSetup({ variants: [{ _id: VARIANT_A, productoId: PRODUCT_A, stock: -2 }] });
  const result = await setup.service.adjustStock(VARIANT_A, adjustment({ cantidad: 2 }), ADMIN);
  assert.equal(result.inventario.stockFisico, 0);
  assert.equal(result.inventario.stockDisponible, 0);
});

test('rechaza cantidades decimales, cero, ingresos negativos, motivos faltantes y campos no permitidos', async () => {
  const service = makeSetup().service;
  for (const body of [
    adjustment({ cantidad: 1.5 }), adjustment({ cantidad: 0 }),
    adjustment({ tipo: 'INGRESO', cantidad: -1 }), adjustment({ motivo: ' ' }),
    adjustment({ adminId: ADMIN })
  ]) {
    await assert.rejects(service.adjustStock(VARIANT_A, body, ADMIN), (error) => error.statusCode === 400);
  }
});

test('rechaza una variante ausente antes de crear movimiento', async () => {
  const setup = makeSetup();
  await assert.rejects(setup.service.adjustStock('507f1f77bcf86cd799439099', adjustment(), ADMIN), (error) => error.statusCode === 404);
  assert.equal(setup.data.movements.length, 0);
});

test('bloquea los ajustes si el índice idempotente no está provisionado', async () => {
  const setup = makeSetup();
  setup.models.MovimientoStock.collection.indexes = async () => [];
  await assert.rejects(setup.service.adjustStock(VARIANT_A, adjustment(), ADMIN), (error) => error.statusCode === 503);
  assert.equal(setup.data.variants[0].stock, 10);
  assert.equal(setup.data.movements.length, 0);
});

test('reintentar misma operación no duplica y reutilizar su id con otros datos da conflicto', async () => {
  const setup = makeSetup();
  const command = adjustment();
  await setup.service.adjustStock(VARIANT_A, command, ADMIN);
  const retry = await setup.service.adjustStock(VARIANT_A, command, ADMIN);
  assert.equal(retry.idempotente, true);
  assert.equal(setup.data.variants[0].stock, 14);
  assert.equal(setup.data.movements.length, 1);
  await assert.rejects(setup.service.adjustStock(VARIANT_A, { ...command, cantidad: 5 }, ADMIN), (error) => error.statusCode === 409);
});

test('ajustes simultáneos con claves distintas no pierden incrementos', async () => {
  const setup = makeSetup();
  await Promise.all([
    setup.service.adjustStock(VARIANT_A, adjustment({ idOperacion: 'operation-0001', cantidad: 2 }), ADMIN),
    setup.service.adjustStock(VARIANT_A, adjustment({ idOperacion: 'operation-0002', cantidad: 3 }), ADMIN)
  ]);
  assert.equal(setup.data.variants[0].stock, 15);
  assert.equal(setup.data.movements.length, 2);
});

test('reintentos simultáneos de la misma operación se aplican una sola vez', async () => {
  const setup = makeSetup();
  const command = adjustment();
  const results = await Promise.all([
    setup.service.adjustStock(VARIANT_A, command, ADMIN),
    setup.service.adjustStock(VARIANT_A, command, ADMIN)
  ]);
  assert.equal(setup.data.variants[0].stock, 14);
  assert.equal(setup.data.movements.length, 1);
  assert.equal(results.filter((result) => result.idempotente).length, 1);
});

test('si falla el registro del movimiento, se revierte también el cambio de stock', async () => {
  const setup = makeSetup({ failMovement: true });
  await assert.rejects(setup.service.adjustStock(VARIANT_A, adjustment(), ADMIN), /movement write failed/);
  assert.equal(setup.data.variants[0].stock, 10);
  assert.equal(setup.data.movements.length, 0);
});

test('consulta historial ordenado y paginado, con filtro de tipo y solo lectura', async () => {
  const setup = makeSetup({ movements: [
    { _id: '000000000000000000000001', varianteId: VARIANT_A, tipo: 'INGRESO', cantidad: 3, creadoEn: new Date('2026-10-28T10:00:00Z') },
    { _id: '000000000000000000000002', varianteId: VARIANT_A, tipo: 'AJUSTE', cantidad: -1, creadoEn: new Date('2026-10-29T10:00:00Z') }
  ] });
  const page = await setup.service.listMovements(VARIANT_A, { tipo: 'AJUSTE', page: 1, limit: 1 });
  assert.equal(page.movimientos.length, 1);
  assert.equal(page.movimientos[0].tipo, 'AJUSTE');
  assert.equal(page.paginacion.total, 1);
  assert.equal(typeof setup.models.MovimientoStock.deleteMany, 'undefined');
});

test('parsea filtros y rechaza parámetros no admitidos', () => {
  assert.deepEqual(parseInventoryQuery({ productoId: PRODUCT_A, stockBajo: '0', page: '2', limit: '5' }), {
    filters: { productoId: PRODUCT_A, stockBajo: 0 }, pagination: { page: 2, limit: 5 }
  });
  assert.throws(() => parseInventoryQuery({ stockBajo: '-1' }), (error) => error.statusCode === 400);
  assert.throws(() => parseInventoryQuery({ adminId: ADMIN }), (error) => error.statusCode === 400);
});

test('rutas de stock están montadas bajo autenticación real y no incluyen mutaciones de movimientos', () => {
  const appSource = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');
  assert.match(appSource, /app\.use\(\s*['"]\/api\/admin\/stock['"],\s*authenticate,\s*authorizeAdmin,/s);
  const setup = makeSetup();
  const router = createAdminStockRoutes(setup.models, { startSession: async () => ({ withTransaction: async (fn) => fn(), endSession: async () => {} }) });
  const definitions = router.stack.filter((layer) => layer.route).map((layer) => ({
    path: layer.route.path, method: Object.keys(layer.route.methods)[0]
  }));
  assert.deepEqual(definitions, [
    { path: '/', method: 'get' },
    { path: '/:variantId/movements', method: 'get' },
    { path: '/:variantId', method: 'get' },
    { path: '/:variantId/adjustments', method: 'post' }
  ]);
});

test('controller exige identidad autenticada y nunca toma adminId desde el cuerpo', async () => {
  const controller = createAdminStockController({ adjustStock: async (_id, _input, adminId) => ({ adminId }) });
  const unauthorized = await new Promise((resolve) => controller.adjust({ params: { variantId: VARIANT_A }, body: adjustment() }, {}, resolve));
  assert.equal(unauthorized.statusCode, 401);
  let response;
  await new Promise((resolve, reject) => controller.adjust({
    params: { variantId: VARIANT_A }, body: adjustment({ adminId: PRODUCT_B }), auth: { sub: ADMIN }
  }, {
    status() { return this; }, json(body) { response = body; resolve(); }
  }, reject));
  assert.equal(response.adminId, ADMIN);
});
