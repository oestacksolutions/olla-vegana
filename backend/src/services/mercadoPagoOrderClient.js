const { ORDERS_URL } = require('./mercadoPagoOrders');
const { ORDER_ID_PATTERN } = require('./mercadoPagoWebhookSecurity');

function createMercadoPagoOrderClient({ accessToken, fetchImpl = globalThis.fetch, timeoutMs = 4000, retries = 1, wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) }) {
  async function postOrderAction(orderId, action, idempotencyKey, payload) {
    if (!accessToken) throw new Error('Mercado Pago no está configurado');
    if (typeof orderId !== 'string' || !ORDER_ID_PATTERN.test(orderId)) throw new Error('El identificador de order no es válido');
    if (typeof idempotencyKey !== 'string' || !/^[\w.:/-]{8,128}$/.test(idempotencyKey)) throw new Error('La clave de idempotencia no es válida');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(`${ORDERS_URL}/${encodeURIComponent(orderId)}/${action}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
          'X-Idempotency-Key': idempotencyKey,
          ...(payload ? { 'Content-Type': 'application/json' } : {})
        },
        ...(payload ? { body: JSON.stringify(payload) } : {}),
        signal: controller.signal
      });
      let body;
      try { body = await response.json(); } catch { body = null; }
      if (!response.ok) {
        const error = new Error('Mercado Pago no pudo procesar la operación');
        error.providerStatus = response.status;
        error.transitorio = response.status >= 500 || response.status === 429;
        throw error;
      }
      if (!body || String(body.id || '') !== orderId || typeof body.status !== 'string') {
        throw new Error('Mercado Pago devolvió una respuesta de operación incompleta');
      }
      return body;
    } catch (error) {
      if (error?.name === 'AbortError') error.transitorio = true;
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    async getOrder(orderId) {
      if (!accessToken) throw new Error('Mercado Pago no está configurado');
      if (typeof orderId !== 'string' || !ORDER_ID_PATTERN.test(orderId)) throw new Error('El identificador de order no es válido');
      let lastError;
      for (let attempt = 0; attempt <= retries; attempt += 1) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const response = await fetchImpl(`${ORDERS_URL}/${encodeURIComponent(orderId)}`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
            signal: controller.signal
          });
          let payload;
          try { payload = await response.json(); } catch { throw new Error('Mercado Pago devolvió una respuesta inválida'); }
          if (!response.ok) {
            const error = new Error('No se pudo consultar la order en Mercado Pago');
            error.providerStatus = response.status;
            if (response.status >= 500 || response.status === 429) error.transitorio = true;
            throw error;
          }
          if (!payload || typeof payload !== 'object') throw new Error('Mercado Pago devolvió una order inválida');
          return payload;
        } catch (error) {
          lastError = error;
          const transient = error?.transitorio || error?.name === 'AbortError' || !Number.isInteger(error?.providerStatus);
          if (!transient || attempt >= retries) throw error;
        } finally {
          clearTimeout(timeout);
        }
        await wait(100 + attempt * 100);
      }
      throw lastError;
    },
    cancelOrder(orderId, idempotencyKey) {
      return postOrderAction(orderId, 'cancel', idempotencyKey, null);
    },
    refundOrder(orderId, idempotencyKey, { paymentId, importe } = {}) {
      if ((paymentId === undefined) !== (importe === undefined)) throw new TypeError('Un reintegro parcial requiere ID de pago e importe');
      const payload = paymentId ? { transactions: [{ id: paymentId, amount: importe }] } : null;
      return postOrderAction(orderId, 'refund', idempotencyKey, payload);
    }
  };
}

module.exports = { createMercadoPagoOrderClient };
