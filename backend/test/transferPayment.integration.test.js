const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');

const DB_NAME = 'olla_vegana_pag03_test';
const uri = process.env.MONGODB_PAG03_TEST_URI;
const isolated = process.env.PAG03_TEST_DATABASE_ISOLATED === '1';

function validateDedicatedUri(value) {
  if (!value) return false;
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error('MONGODB_PAG03_TEST_URI no es una URI válida; se omitió su valor.'); }
  const dbName = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  if (!['mongodb:', 'mongodb+srv:'].includes(parsed.protocol) || dbName !== DB_NAME) {
    throw new Error(`La integración de PAG-03 solo admite la base exclusiva ${DB_NAME}.`);
  }
  return true;
}

const uriSafe = validateDedicatedUri(uri);

test('PAG-03 confirma transferencia, auditoría, índice único y stock dentro de una transacción aislada', {
  skip: !uri ? `Configurar MONGODB_PAG03_TEST_URI para ${DB_NAME}.` : !isolated ? 'Confirmar aislamiento con PAG03_TEST_DATABASE_ISOLATED=1.' : false,
  timeout: 30_000
}, async (t) => {
  assert.equal(uriSafe, true);
  const connection = await mongoose.createConnection(uri, {
    autoCreate: false,
    autoIndex: false,
    serverSelectionTimeoutMS: 5000
  }).asPromise().catch(() => { throw new Error('No se pudo conectar a la base exclusiva de testing; URI omitida.'); });
  const ownedCollections = [];
  try {
    const hello = await connection.db.admin().command({ hello: 1 });
    if (!hello.setName && !hello.msg?.includes('isdbgrid')) {
      t.skip('MongoDB de pruebas no es replica set ni cluster sharded; las transacciones no están disponibles.');
      return;
    }

    const suffix = crypto.randomBytes(8).toString('hex');
    const createIsolatedModel = (name, source) => {
      const collection = `qa_pag03_${suffix}_${name.toLowerCase()}`;
      ownedCollections.push(collection);
      return connection.model(`PAG03_${suffix}_${name}`, source.schema, collection);
    };
    const sources = {
      Pedido: require('../src/models/Pedido'),
      Variante: require('../src/models/Variante'),
      ReservaStock: require('../src/models/ReservaStock'),
      MovimientoStock: require('../src/models/MovimientoStock'),
      HistorialEstadoPedido: require('../src/models/HistorialEstadoPedido'),
      ConfirmacionTransferencia: require('../src/models/ConfirmacionTransferencia')
    };
    const models = Object.fromEntries(Object.entries(sources).map(([name, source]) => [name, createIsolatedModel(name, source)]));
    for (const model of Object.values(models)) await model.createIndexes();

    const { createTransferPaymentAuthorization } = require('../src/services/transferPaymentAuthorization');
    const { createStockReservationService } = require('../src/services/stockReservationService');
    const { createTransferPaymentService } = require('../src/services/transferPaymentService');
    const auth = createTransferPaymentAuthorization();
    const stock = createStockReservationService(models, { verifyPaymentAuthorization: auth.verify });
    const transfer = createTransferPaymentService(models, {
      stockReservationService: stock,
      transferPaymentAuthorization: auth,
      startSession: () => connection.startSession()
    });

    const productId = new mongoose.Types.ObjectId();
    const variant = await models.Variante.create({ productoId: productId, stock: 4 });
    const pickupId = new mongoose.Types.ObjectId();
    const order = await models.Pedido.create({
      numero: Number(`${new Date().toISOString().slice(0, 10).replaceAll('-', '')}${String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')}`),
      nombre: 'QA', apellido: 'Aislado', correo: 'qa@example.test', telefono: '+5491112345678',
      metodoPago: 'TRANSFERENCIA', estado: 'NUEVO', estadoPago: 'PENDIENTE', total: mongoose.Types.Decimal128.fromString('20.00'),
      puntoRetiroId: pickupId, venceEn: new Date(Date.now() + 60 * 60 * 1000), idOperacion: `qa:${suffix}`,
      huellaOperacion: crypto.createHash('sha256').update(suffix).digest('hex')
    });
    await models.ReservaStock.create({ pedidoId: order._id, varianteId: variant._id, cantidad: 2, estado: 'ACTIVA', venceEn: order.venceEn });

    const operation = `qa-transfer:${suffix}`;
    const adminId = String(new mongoose.Types.ObjectId());
    const confirmation = { pedidoId: String(order._id), adminId, referencia: `QA-${suffix}`, importeAcreditado: '20.00', idOperacion: operation };
    const result = await transfer.confirmTransfer(confirmation);
    assert.equal(result.confirmado, true);
    const persistedOrder = await models.Pedido.findById(order._id).lean();
    const persistedVariant = await models.Variante.findById(variant._id).lean();
    const persistedReservations = await models.ReservaStock.find({ pedidoId: order._id }).lean();
    const movements = await models.MovimientoStock.find({ varianteId: variant._id }).lean();
    const repeated = await transfer.confirmTransfer(confirmation);
    assert.equal(persistedOrder.estadoPago, 'APROBADO');
    assert.equal(persistedVariant.stock, 2);
    assert.equal(persistedReservations[0].estado, 'CONFIRMADA');
    assert.equal(movements.length, 1);
    assert.equal(repeated.idempotente, true);
  } finally {
    for (const collection of ownedCollections) {
      try { await connection.dropCollection(collection); } catch (error) { if (error.codeName !== 'NamespaceNotFound') throw error; }
    }
    await connection.close();
  }
});
