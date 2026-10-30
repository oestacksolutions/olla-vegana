const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');

const TEST_DATABASE = 'olla_vegana_car05_test';
const testUri = process.env.MONGODB_CAR05_TEST_URI;
const isolatedDatabaseConfirmed = process.env.CAR05_TEST_DATABASE_ISOLATED === '1';

function validateTestUri(uri) {
  if (typeof uri !== 'string' || !uri) return false;
  try {
    const parsed = new URL(uri);
    const database = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
    if (!['mongodb:', 'mongodb+srv:'].includes(parsed.protocol) || database !== TEST_DATABASE) {
      throw new Error('MONGODB_CAR05_TEST_URI debe apuntar exclusivamente a olla_vegana_car05_test.');
    }
    return true;
  } catch (error) {
    if (error.message === 'MONGODB_CAR05_TEST_URI debe apuntar exclusivamente a olla_vegana_car05_test.') throw error;
    throw new Error('MONGODB_CAR05_TEST_URI no tiene un formato MongoDB válido; el valor se omitió.');
  }
}

const uriIsSafe = validateTestUri(testUri);

test('CAR-05 persistencia, índices, transacciones y concurrencia en MongoDB aislado', {
  skip: !testUri
    ? 'Configurar MONGODB_CAR05_TEST_URI con una URI exclusiva de olla_vegana_car05_test.'
    : !isolatedDatabaseConfirmed
      ? 'Confirmar aislamiento con CAR05_TEST_DATABASE_ISOLATED=1 antes de permitir escrituras de QA.'
      : false
}, async (t) => {
  assert.equal(uriIsSafe, true);
  let connection;
  try {
    connection = await mongoose.createConnection(testUri, {
      autoCreate: false,
      autoIndex: false,
      serverSelectionTimeoutMS: 5000
    }).asPromise();
  } catch {
    throw new Error('No se pudo conectar a la base exclusiva de testing; URI y credenciales omitidas.');
  }

  const runId = crypto.randomBytes(6).toString('hex');
  const ownedCollections = [];
  const createModel = (name, schema) => {
    const collection = `qa_car05_${runId}_${name.toLowerCase()}`;
    ownedCollections.push(collection);
    return connection.model(`CAR05_${runId}_${name}`, schema, collection);
  };

  const sourceModels = {
    Producto: require('../src/models/Producto'),
    Categoria: require('../src/models/Categoria'),
    Variante: require('../src/models/Variante'),
    Atributo: require('../src/models/Atributo'),
    ValorAtributo: require('../src/models/ValorAtributo'),
    ValorVariante: require('../src/models/ValorVariante'),
    ReservaStock: require('../src/models/ReservaStock'),
    MovimientoStock: require('../src/models/MovimientoStock'),
    EventoPago: require('../src/models/EventoPago'),
    PuntoRetiro: require('../src/models/PuntoRetiro'),
    RetiroEspecial: require('../src/models/RetiroEspecial'),
    Pedido: require('../src/models/Pedido'),
    ItemPedido: require('../src/models/ItemPedido'),
    HistorialEstadoPedido: require('../src/models/HistorialEstadoPedido')
  };
  const models = Object.fromEntries(Object.entries(sourceModels).map(([name, source]) => [name, createModel(name, source.schema)]));
  const { createCartValidationService } = require('../src/services/cartValidationService');
  const { createPickupService } = require('../src/services/pickupService');
  const { createOrderService } = require('../src/services/orderService');
  const fixedNow = new Date('2026-10-29T12:00:00.000Z');
  const cartValidationService = createCartValidationService(models, { ahora: () => fixedNow, logger: () => {} });
  const pickupService = createPickupService(models, { ahora: () => fixedNow });

  try {
    assert.equal(connection.name, TEST_DATABASE, 'Conexión fuera de la base de testing rechazada.');
    // Los índices se provisionan únicamente en colecciones con nombre exclusivo de esta ejecución.
    await Promise.all([
      models.Pedido.createIndexes(),
      models.ItemPedido.createIndexes(),
      models.HistorialEstadoPedido.createIndexes()
    ]);

    const category = await models.Categoria.create({ nombre: `CAR05 ${runId}`, slug: `car05-${runId}`, activa: true });
    const product = await models.Producto.create({
      nombre: 'Producto CAR-05 de prueba', slug: `producto-car05-${runId}`, descripcion: 'Fixture aislado',
      precioBase: mongoose.Types.Decimal128.fromString('100.00'), categoriaId: category._id, activo: true
    });
    const variant = await models.Variante.create({
      productoId: product._id, precio: mongoose.Types.Decimal128.fromString('75.25'), stock: 7, activa: true
    });
    const attribute = await models.Atributo.create({ nombre: `Talle CAR05 ${runId}` });
    const attributeValue = await models.ValorAtributo.create({ atributoId: attribute._id, valor: 'L' });
    await models.ValorVariante.create({ varianteId: variant._id, valorAtributoId: attributeValue._id });
    const point = await models.PuntoRetiro.create({
      nombre: `Punto CAR05 ${runId}`, direccion: 'Dirección exclusiva de testing', activo: true, habilitadoCheckout: true,
      horariosHabituales: [{ diaSemana: 'VIERNES', horaInicio: '16:00', horaFin: '19:00' }]
    });

    const orderBody = {
      nombre: 'Compradora de prueba', apellido: 'CAR05', correo: `car05-${runId}@example.test`, telefono: '+54 9 11 5555-1234',
      observaciones: 'Fixture aislado', retiroId: `PUNTO:${point._id}`, metodoPago: 'TRANSFERENCIA',
      articulos: [{ productoId: String(product._id), varianteId: String(variant._id), cantidad: 2 }]
    };
    const createService = (randomSuffix) => createOrderService(models, {
      cartValidationService, pickupService, ahora: () => fixedNow, randomSuffix
    });
    const numberSequence = [123456, 123456, 123457, 123458, 123459, 123460, 123461, 123462];
    const nextNumber = () => numberSequence.shift() ?? crypto.randomInt(0, 1_000_000);
    const service = createService(nextNumber);

    await t.test('escritura exitosa persiste pedido, ítem e historial con snapshots y Decimal128', async () => {
      const writes = [];
      const restore = [];
      for (const name of ['Pedido', 'ItemPedido', 'HistorialEstadoPedido']) {
        const model = models[name];
        const originalCreate = model.create;
        model.create = function trackedCreate(...args) {
          writes.push(args[1]?.session || null);
          return originalCreate.apply(this, args);
        };
        restore.push(() => { model.create = originalCreate; });
      }
      let result;
      try { result = await service.createOrder(orderBody, `car05-op-${runId}-one`); }
      finally { restore.forEach((restoreMethod) => restoreMethod()); }
      assert.equal(writes.length, 3);
      assert.ok(writes.every((session) => session && session === writes[0]), 'pedido, ítems e historial deben usar la misma sesión MongoDB');
      assert.equal(result.pedido.estado, 'NUEVO');
      assert.equal(result.pedido.estadoPago, 'PENDIENTE');
      assert.equal(result.pedido.total.toString(), '150.50');
      assert.ok(result.pedido.creadoEn instanceof Date);
      assert.ok(result.pedido.actualizadoEn instanceof Date);
      assert.equal(result.articulos.length, 1);
      assert.equal(result.articulos[0].precio.toString(), '75.25');
      assert.equal(result.articulos[0].subtotal.toString(), '150.50');
      assert.equal(result.articulos[0].nombreProducto, product.nombre);
      assert.deepEqual(result.articulos[0].atributosVariante.map(({ atributo, valor }) => [atributo, valor]), [['Talle CAR05 ' + runId, 'L']]);
      assert.equal(result.pedido.puntoRetiroSnapshot.nombre, point.nombre);
      assert.equal(result.historial.estadoNuevo, 'NUEVO');
      assert.equal(await models.Pedido.countDocuments(), 1);
      assert.equal(await models.ItemPedido.countDocuments(), 1);
      assert.equal(await models.HistorialEstadoPedido.countDocuments(), 1);
    });

    await t.test('índices reales únicos de número e idempotencia existen y rechazan duplicados', async () => {
      const indexes = await models.Pedido.collection.listIndexes().toArray();
      const numberIndex = indexes.find((index) => index.key.numero === 1 && index.unique);
      const operationIndex = indexes.find((index) => index.key.idOperacion === 1 && index.unique);
      assert.ok(numberIndex);
      assert.equal(operationIndex?.name, 'uniq_pedido_id_operacion');
      assert.deepEqual(operationIndex.partialFilterExpression, { idOperacion: { $type: 'string' } });

      const original = await models.Pedido.findOne({});
      await assert.rejects(models.Pedido.create({
        ...original.toObject(), _id: undefined, numero: original.numero,
        idOperacion: `other-op-${runId}`, huellaOperacion: 'a'.repeat(64)
      }), (error) => error.code === 11000);
      await assert.rejects(models.Pedido.create({
        ...original.toObject(), _id: undefined, numero: original.numero + 1,
        idOperacion: original.idOperacion, huellaOperacion: 'b'.repeat(64)
      }), (error) => error.code === 11000);
    });

    await t.test('idempotencia devuelve el pedido original y rechaza reutilización incompatible', async () => {
      const operationKey = `car05-op-${runId}-retry`;
      const first = await service.createOrder(orderBody, operationKey);
      await models.Variante.updateOne({ _id: variant._id }, { $set: { precio: mongoose.Types.Decimal128.fromString('90.00') } });
      const retry = await service.createOrder(orderBody, operationKey);
      assert.equal(retry.repetido, true);
      assert.equal(String(retry.pedido._id), String(first.pedido._id));
      assert.equal(retry.articulos[0].precio.toString(), '75.25');
      await assert.rejects(service.createOrder({ ...orderBody, articulos: [{ ...orderBody.articulos[0], cantidad: 1 }] }, operationKey), { statusCode: 409 });
    });

    await t.test('falla intermedia revierte pedido, ítems e historial', async () => {
      const brokenItems = {
        find: (...args) => models.ItemPedido.find(...args),
        create: async () => { throw new Error('failure injected before CAR-05 commit'); }
      };
      const brokenService = createOrderService({ ...models, ItemPedido: brokenItems }, {
        cartValidationService, pickupService, ahora: () => fixedNow, randomSuffix: nextNumber
      });
      const before = {
        pedidos: await models.Pedido.countDocuments(), items: await models.ItemPedido.countDocuments(),
        histories: await models.HistorialEstadoPedido.countDocuments()
      };
      await assert.rejects(brokenService.createOrder(orderBody, `car05-op-${runId}-rollback`), /failure injected/);
      assert.deepEqual({
        pedidos: await models.Pedido.countDocuments(), items: await models.ItemPedido.countDocuments(),
        histories: await models.HistorialEstadoPedido.countDocuments()
      }, before);
    });

    await t.test('falla después de insertar el historial también revierte las tres colecciones', async () => {
      const brokenHistory = {
        create: async (documents, options) => {
          await models.HistorialEstadoPedido.create(documents, options);
          throw new Error('failure injected after history write');
        }
      };
      const brokenService = createOrderService({ ...models, HistorialEstadoPedido: brokenHistory }, {
        cartValidationService, pickupService, ahora: () => fixedNow, randomSuffix: nextNumber
      });
      const before = {
        pedidos: await models.Pedido.countDocuments(), items: await models.ItemPedido.countDocuments(),
        histories: await models.HistorialEstadoPedido.countDocuments()
      };
      await assert.rejects(brokenService.createOrder(orderBody, `car05-op-${runId}-rollback-history`), /failure injected after history write/);
      assert.deepEqual({
        pedidos: await models.Pedido.countDocuments(), items: await models.ItemPedido.countDocuments(),
        histories: await models.HistorialEstadoPedido.countDocuments()
      }, before);
    });

    await t.test('colisiones y solicitudes concurrentes mantienen número e idempotencia únicos', async () => {
      const concurrentService = createService(nextNumber);
      const [first, duplicate] = await Promise.all([
        concurrentService.createOrder(orderBody, `car05-op-${runId}-same`),
        concurrentService.createOrder(orderBody, `car05-op-${runId}-same`)
      ]);
      assert.equal(String(first.pedido._id), String(duplicate.pedido._id));
      assert.equal([first.repetido, duplicate.repetido].filter(Boolean).length, 1);

      const [left, right] = await Promise.all([
        concurrentService.createOrder({ ...orderBody, correo: `left-${runId}@example.test` }, `car05-op-${runId}-left`),
        concurrentService.createOrder({ ...orderBody, correo: `right-${runId}@example.test` }, `car05-op-${runId}-right`)
      ]);
      assert.notEqual(left.pedido.numero, right.pedido.numero);
      assert.equal(await models.Pedido.countDocuments({ idOperacion: { $in: [`car05-op-${runId}-left`, `car05-op-${runId}-right`] } }), 2);
    });

    await t.test('no reserva ni modifica stock y no crea movimientos o pagos', async () => {
      assert.equal((await models.Variante.findById(variant._id)).stock, 7);
      assert.equal(await models.ReservaStock.countDocuments(), 0);
      assert.equal(await models.MovimientoStock.countDocuments(), 0);
      assert.equal(await models.EventoPago.countDocuments(), 0);
      const order = await models.Pedido.findOne({});
      assert.equal(order.estadoPago, 'PENDIENTE');
      assert.equal(order.mpPagoId, null);
      assert.equal(order.mpPreferenciaId, null);
    });

    await t.test('error inyectado requiere transacción soportada por MongoDB', async () => {
      const session = await connection.startSession();
      try {
        await assert.rejects(session.withTransaction(async () => {
          await models.Pedido.create([{
            numero: 20261029999999, nombre: 'Rollback', apellido: 'CAR05', correo: `rollback-${runId}@example.test`,
            metodoPago: 'TRANSFERENCIA', total: '1.00', puntoRetiroId: point._id,
            idOperacion: `car05-op-${runId}-session-check`, huellaOperacion: 'c'.repeat(64)
          }], { session });
          throw new Error('abort integration transaction');
        }), /abort integration transaction/);
      } finally {
        await session.endSession();
      }
      assert.equal(await models.Pedido.countDocuments({ idOperacion: `car05-op-${runId}-session-check` }), 0);
    });

    await t.test('el endpoint público sigue sin montar y la ruta futura bloquea persistencia', async () => {
      const fs = require('node:fs');
      const path = require('node:path');
      const appSource = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');
      assert.doesNotMatch(appSource, /createOrderRoutes|\/api\/orders/);
      assert.equal(await models.Pedido.countDocuments(), await models.ItemPedido.countDocuments());
    });
  } finally {
    try {
      for (const collection of ownedCollections) {
        try { await connection.dropCollection(collection); } catch (error) {
          if (error.codeName !== 'NamespaceNotFound') throw error;
        }
      }
    } finally {
      await connection.close();
    }
  }
});
