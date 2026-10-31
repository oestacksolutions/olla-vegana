const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const { createMercadoPagoWebhookService } = require('../src/services/mercadoPagoWebhookService');
const { createStockReservationService } = require('../src/services/stockReservationService');
const { createPaymentAuthorization } = require('../src/services/paymentAuthorization');

const TEST_DATABASE = 'olla_vegana_pag02_test';
const uri = process.env.MONGODB_PAG02_TEST_URI;
const writesConfirmed = process.env.PAG02_TEST_ALLOW_WRITES === '1';
const approvalFlagsConfirmed = process.env.PAG02_TEST_APPROVAL_FLAGS === '1';

function assertDedicatedUri(value) {
  if (typeof value !== 'string' || !value) return false;
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error('La URI MongoDB de PAG-02 no es válida; se omite su valor.'); }
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  if (!['mongodb:', 'mongodb+srv:'].includes(parsed.protocol) || database !== TEST_DATABASE) {
    throw new Error(`La prueba de integración escribe exclusivamente en ${TEST_DATABASE}.`);
  }
  return true;
}

const uriSafe = assertDedicatedUri(uri);

test('PAG-02 persiste webhook, transacción de stock y deduplicación en MongoDB aislado', {
  skip: !uri
    ? `Definir MONGODB_PAG02_TEST_URI apuntando a ${TEST_DATABASE}.`
    : !writesConfirmed
      ? 'Confirmar base de testing exclusiva con PAG02_TEST_ALLOW_WRITES=1.'
      : !approvalFlagsConfirmed
        ? 'Confirmar entorno aislado y habilitar explícitamente la prueba con PAG02_TEST_APPROVAL_FLAGS=1.'
        : false,
  timeout: 30_000
}, async (t) => {
  assert.equal(uriSafe, true);
  const connection = await mongoose.createConnection(uri, {
    autoCreate: false,
    autoIndex: false,
    serverSelectionTimeoutMS: 5000
  }).asPromise().catch(() => { throw new Error('No se pudo conectar a la base de testing; URI y credenciales omitidas.'); });
  try {
    const hello = await connection.db.admin().command({ hello: 1 });
    if (!hello.setName) {
      t.skip('MongoDB de testing no es replica set; las transacciones requieren replica set o cluster sharded.');
      return;
    }

    const suffix = crypto.randomBytes(8).toString('hex');
    const sourceModels = {
      Pedido: require('../src/models/Pedido'),
      ItemPedido: require('../src/models/ItemPedido'),
      HistorialEstadoPedido: require('../src/models/HistorialEstadoPedido'),
      ReservaStock: require('../src/models/ReservaStock'),
      Variante: require('../src/models/Variante'),
      MovimientoStock: require('../src/models/MovimientoStock'),
      IntentoPago: require('../src/models/IntentoPago'),
      EventoPago: require('../src/models/EventoPago')
    };
    const models = {};
    for (const [name, source] of Object.entries(sourceModels)) {
      const collection = `pag02_${suffix}_${name.toLowerCase()}`;
      await connection.db.createCollection(collection);
      models[name] = connection.model(`PAG02_${suffix}_${name}`, source.schema, collection);
      await models[name].createIndexes();
    }

    const now = new Date();
    const pedidoId = new mongoose.Types.ObjectId();
    const varianteId = new mongoose.Types.ObjectId();
    const adminOptionId = new mongoose.Types.ObjectId();
    await models.Pedido.create({
      _id: pedidoId, numero: 20261030001234, nombre: 'Comprador QA', apellido: 'Aislado',
      correo: 'qa@example.test', metodoPago: 'MERCADO_PAGO', estadoPago: 'PENDIENTE', estado: 'NUEVO',
      total: mongoose.Types.Decimal128.fromString('12.34'), puntoRetiroId: adminOptionId,
      creadoEn: now, idOperacion: `pag02-${suffix}`, huellaOperacion: 'integration-fingerprint'
    });
    await models.Variante.create({ _id: varianteId, productoId: new mongoose.Types.ObjectId(), stock: 2, activa: true });
    await models.ReservaStock.create({
      pedidoId, varianteId, cantidad: 1, estado: 'ACTIVA', creadoEn: now,
      venceEn: new Date(now.getTime() + 60 * 60 * 1000)
    });
    await models.IntentoPago.create({
      pedidoId, proveedor: 'MERCADO_PAGO', claveIdempotencia: `pag02-${suffix}`,
      huellaSolicitud: 'integration-request', solicitud: {}, estadoCreacion: 'CREADO',
      orderExternaId: 'ORD01PAG02INTEGRATION1234567890'
    });

    const orderId = 'ORD01PAG02INTEGRATION1234567890';
    const applicationId = 'isolated-test-app';
    const paymentAuthorization = createPaymentAuthorization();
    const stockReservationService = createStockReservationService(models, {
      startSession: () => connection.startSession(),
      verifyPaymentAuthorization: paymentAuthorization.verify
    });
    const providerOrder = {
      id: orderId, type: 'online', processing_mode: 'manual', status: 'processed', status_detail: 'accredited',
      external_reference: 'OV-20261030001234', total_amount: '12.34', total_paid_amount: '12.34', currency: 'ARS',
      last_updated_date: new Date(Date.now() + 1000).toISOString(),
      user_id: 'isolated-test-seller',
      integration_data: { application_id: applicationId },
      transactions: { payments: [{ id: 'PAY01PAG02INTEGRATION123456', amount: '12.34', paid_amount: '12.34', status: 'processed', status_detail: 'accredited', currency_id: 'ARS' }] }
    };
    const env = {
      MP_ENVIRONMENT: 'test', MP_ORDER_CREATION_ENABLED: true, MP_ORDER_FLOW_READY: true,
      MP_WEBHOOKS_READY: true, MP_WEBHOOK_EFFECTS_ENABLED: true, MP_ACCESS_TOKEN: 'isolated-token',
      MP_WEBHOOK_SECRET: 'isolated-webhook-secret-for-test', MP_APPLICATION_ID: applicationId, MP_USER_ID: 'isolated-test-seller'
    };
    const service = createMercadoPagoWebhookService(models, {
      env,
      orderClient: { getOrder: async () => providerOrder },
      stockReservationService,
      paymentAuthorization,
      startSession: () => connection.startSession()
    });
    const timestamp = String(Date.now());
    const requestId = `pag02-${suffix}-request`;
    const webhookSecret = env.MP_WEBHOOK_SECRET;
    const manifest = `id:${orderId};request-id:${requestId};ts:${timestamp};`;
    const digest = crypto.createHmac('sha256', webhookSecret).update(manifest).digest('hex');
    const request = {
      headers: { 'x-signature': `ts=${timestamp},v1=${digest}`, 'x-request-id': requestId },
      query: { 'data.id': orderId, type: 'order' },
      body: { type: 'order', application_id: applicationId, user_id: 'isolated-test-seller', live_mode: false, data: { id: orderId } }
    };

    const results = await Promise.all([service.handle(request), service.handle(request)]);
    assert.equal(results.length, 2);
    const savedOrder = await models.Pedido.findById(pedidoId).lean();
    const savedVariant = await models.Variante.findById(varianteId).lean();
    const reservation = await models.ReservaStock.findOne({ pedidoId }).lean();
    const attempt = await models.IntentoPago.findOne({ pedidoId }).lean();
    assert.equal(savedOrder.estadoPago, 'APROBADO');
    assert.equal(savedVariant.stock, 1);
    assert.equal(reservation.estado, 'CONFIRMADA');
    assert.equal(await models.MovimientoStock.countDocuments({ varianteId }), 1);
    assert.equal(await models.EventoPago.countDocuments({ idExterno: orderId }), 1);
    assert.equal(attempt.pagoExternoId, 'PAY01PAG02INTEGRATION123456');
    await t.test('índices únicos quedaron presentes en las colecciones aisladas', async () => {
      const eventIndexes = await models.EventoPago.collection.indexes();
      assert.ok(eventIndexes.some((index) => index.name === 'uniq_evento_pago_idempotencia' && index.unique));
      const attempts = await models.IntentoPago.collection.indexes();
      assert.ok(attempts.some((index) => index.name === 'uniq_intento_pago_order_externa' && index.unique));
      const movements = await models.MovimientoStock.collection.indexes();
      assert.ok(movements.some((index) => index.name === 'uniq_movimiento_id_operacion' && index.unique));
    });
  } finally {
    await connection.close();
  }
});
