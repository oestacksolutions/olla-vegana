const crypto = require('node:crypto');
const { parseMoneyToCents, formatCents } = require('./cartValidationService');
const logger = require('../utils/observability');

const ORDERS_URL = 'https://api.mercadopago.com/v1/orders';
const INDEX_NAME = 'uniq_intento_pago_idempotencia';

function safeReturnBase(value, { allowLocalhost = false } = {}) {
  let url;
  try { url = new URL(value); } catch { throw new Error('FRONTEND_PUBLIC_URL debe ser una URL válida'); }
  const local = allowLocalhost && ['localhost', '127.0.0.1'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !local) || url.username || url.password || url.search || url.hash || url.port && !local) {
    throw new Error('FRONTEND_PUBLIC_URL debe usar HTTPS y no incluir credenciales, puerto, query ni fragmento');
  }
  return url.origin;
}

function buildReturnUrls(frontendPublicUrl, options) {
  const base = safeReturnBase(frontendPublicUrl, options);
  return {
    success_url: `${base}/checkout/exito`,
    pending_url: `${base}/checkout/pendiente`,
    failure_url: `${base}/checkout/error`,
    auto_return: 'approved'
  };
}

function buildOrderPayload({ pedido, items }, frontendPublicUrl, options) {
  if (!pedido || !Array.isArray(items) || items.length === 0) throw new Error('El pedido no tiene ítems persistidos');
  const lines = items.map((item) => {
    const unit = parseMoneyToCents(item.precio);
    const subtotal = parseMoneyToCents(item.subtotal);
    if (unit === null || unit < 0n || !Number.isSafeInteger(item.cantidad) || item.cantidad < 1
      || subtotal === null || subtotal !== unit * BigInt(item.cantidad)) {
      throw new Error('El snapshot del pedido contiene importes inválidos');
    }
    const title = [item.nombreProducto, item.detalleVariante].filter(Boolean).join(' · ').slice(0, 250);
    return { title, unit_price: formatCents(unit), quantity: item.cantidad };
  });
  const total = parseMoneyToCents(pedido.total);
  const linesTotal = items.reduce((sum, item) => sum + parseMoneyToCents(item.subtotal), 0n);
  if (total === null || total <= 0n || total !== linesTotal) throw new Error('El total del pedido no coincide con sus ítems históricos');

  const payload = {
    type: 'online',
    processing_mode: 'manual',
    total_amount: formatCents(total),
    external_reference: `OV-${pedido.numero}`,
    items: lines,
    payer: { email: pedido.correo },
    config: { online: buildReturnUrls(frontendPublicUrl, options) }
  };
  if (typeof payload.payer.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.payer.email)) {
    throw new Error('El correo persistido del comprador no es válido');
  }
  return payload;
}

function stableIdempotencyKey(pedido) {
  const source = `${pedido._id}:${pedido.idOperacion || pedido.numero}`;
  return `olla-${crypto.createHash('sha256').update(source).digest('hex')}`;
}

function fingerprint(payload) {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function parseProviderCheckoutUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Mercado Pago devolvió una URL de checkout inválida'); }
  const hostAllowed = /(^|\.)mercadopago\.(com\.ar|com)$/.test(url.hostname);
  if (url.protocol !== 'https:' || !hostAllowed || url.username || url.password || url.port) {
    throw new Error('Mercado Pago devolvió una URL de checkout no confiable');
  }
  return url.toString();
}

function createMercadoPagoOrdersClient({ accessToken, fetchImpl = globalThis.fetch, timeoutMs = 10000 }) {
  return {
    async createOrder(payload, idempotencyKey) {
      if (!accessToken) throw new Error('Mercado Pago no está configurado');
      if (typeof fetchImpl !== 'function') throw new Error('El cliente HTTP no está disponible');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(ORDERS_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-Idempotency-Key': idempotencyKey
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        let body;
        try { body = await response.json(); } catch { throw new Error('Mercado Pago devolvió una respuesta inválida'); }
        if (!response.ok) {
          const error = new Error('Mercado Pago no pudo crear la operación');
          error.providerStatus = response.status;
          throw error;
        }
        if (typeof body?.id !== 'string' || !body.id.trim() || typeof body?.checkout_url !== 'string') {
          throw new Error('Mercado Pago devolvió una respuesta incompleta');
        }
        return { id: body.id, checkoutUrl: parseProviderCheckoutUrl(body.checkout_url) };
      } finally {
        clearTimeout(timeout);
      }
    }
  };
}

function createMercadoPagoPaymentService(models, { env, client, allowLocalhost = false } = {}) {
  const { Pedido, ItemPedido, IntentoPago } = models;
  const enabled = env?.MP_ENVIRONMENT === 'test'
    && env?.MP_ORDER_CREATION_ENABLED === true
    && env?.MP_ORDER_FLOW_READY === true
    && env?.MP_WEBHOOKS_READY === true
    && Boolean(env?.MP_ACCESS_TOKEN && env?.FRONTEND_PUBLIC_URL);

  async function assertIdempotencyIndex() {
    const indexes = await IntentoPago.collection.indexes();
    const present = indexes.some((index) => index.name === INDEX_NAME
      && index.unique === true && index.key?.proveedor === 1 && index.key?.claveIdempotencia === 1);
    if (!present) throw new Error('Falta provisionar y verificar el índice único de intentos de pago');
  }

  async function createCheckoutForPersistedOrder(pedidoId) {
    if (!enabled) {
      const error = new Error('La creación de operaciones de Mercado Pago está deshabilitada hasta completar QA aislado y webhooks');
      error.statusCode = 503;
      throw error;
    }
    await assertIdempotencyIndex();
    const pedido = await Pedido.findById(pedidoId).lean();
    if (!pedido || pedido.metodoPago !== 'MERCADO_PAGO' || pedido.estadoPago !== 'PENDIENTE') {
      const error = new Error('No existe un pedido pendiente habilitado para Mercado Pago');
      error.statusCode = 404;
      throw error;
    }
    const items = await ItemPedido.find({ pedidoId: pedido._id }).sort({ _id: 1 }).lean();
    const payload = buildOrderPayload({ pedido, items }, env.FRONTEND_PUBLIC_URL, { allowLocalhost });
    const key = stableIdempotencyKey(pedido);
    const requestHash = fingerprint(payload);
    let attempt = await IntentoPago.findOne({ proveedor: 'MERCADO_PAGO', claveIdempotencia: key }).lean();
    if (attempt && attempt.huellaSolicitud !== requestHash) {
      const error = new Error('El pedido cambió después de iniciar el intento de pago; requiere conciliación manual');
      error.statusCode = 409;
      throw error;
    }
    if (attempt?.estadoCreacion === 'CREADO') return { orderId: attempt.orderExternaId, checkoutUrl: attempt.checkoutUrl, repetido: true };
    if (!attempt) {
      try {
        const [created] = await IntentoPago.create([{
          pedidoId: pedido._id,
          proveedor: 'MERCADO_PAGO',
          claveIdempotencia: key,
          huellaSolicitud: requestHash,
          solicitud: payload,
          estadoCreacion: 'CREANDO'
        }]);
        attempt = created.toObject();
      } catch (error) {
        if (error?.code !== 11000) throw error;
        attempt = await IntentoPago.findOne({ proveedor: 'MERCADO_PAGO', claveIdempotencia: key }).lean();
        if (!attempt || attempt.huellaSolicitud !== requestHash) throw error;
        if (attempt.estadoCreacion === 'CREADO') return { orderId: attempt.orderExternaId, checkoutUrl: attempt.checkoutUrl, repetido: true };
      }
    }
    // Mantiene el mismo cuerpo y clave tras timeout/reinicio: MP puede devolver la operación ya creada.
    try {
      logger.info('payment.order_creation.started', { orderId: String(pedido._id), attemptId: String(attempt._id), provider: 'MERCADO_PAGO' });
      const external = await client.createOrder(attempt.solicitud, attempt.claveIdempotencia);
      await IntentoPago.updateOne({ _id: attempt._id, estadoCreacion: { $in: ['CREANDO', 'INDETERMINADO', 'FALLIDO'] } }, {
        $set: { estadoCreacion: 'CREADO', orderExternaId: external.id, checkoutUrl: external.checkoutUrl, respuestaRecibidaEn: new Date(), codigoError: null }
      });
      logger.info('payment.order_creation.created', { orderId: String(pedido._id), attemptId: String(attempt._id), externalOrderId: external.id, provider: 'MERCADO_PAGO' });
      return { orderId: external.id, checkoutUrl: external.checkoutUrl, repetido: false };
    } catch (error) {
      const knownFailure = Number.isInteger(error?.providerStatus) && error.providerStatus >= 400 && error.providerStatus < 500;
      await IntentoPago.updateOne({ _id: attempt._id, estadoCreacion: { $ne: 'CREADO' } }, {
        $set: { estadoCreacion: knownFailure ? 'FALLIDO' : 'INDETERMINADO', codigoError: knownFailure ? `HTTP_${error.providerStatus}` : 'RESPUESTA_NO_CONFIRMADA' }
      });
      (knownFailure ? logger.warn : logger.error)('payment.order_creation.failed', {
        orderId: String(pedido._id), attemptId: String(attempt._id), provider: 'MERCADO_PAGO',
        state: knownFailure ? 'FALLIDO' : 'INDETERMINADO', providerStatus: Number.isInteger(error?.providerStatus) ? error.providerStatus : null
      });
      void logger.alerts?.dispatch('payment:order-creation:failure', knownFailure ? 'payment.order_creation.failed' : 'payment.order_creation.indeterminate', {
        orderId: String(pedido._id), state: knownFailure ? 'FALLIDO' : 'INDETERMINADO'
      });
      throw error;
    }
  }

  return { createCheckoutForPersistedOrder, enabled };
}

module.exports = {
  ORDERS_URL, INDEX_NAME, safeReturnBase, buildReturnUrls, buildOrderPayload,
  stableIdempotencyKey, fingerprint, parseProviderCheckoutUrl,
  createMercadoPagoOrdersClient, createMercadoPagoPaymentService
};
