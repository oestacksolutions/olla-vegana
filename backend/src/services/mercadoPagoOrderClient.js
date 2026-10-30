const { ORDERS_URL } = require('./mercadoPagoOrders');
const { ORDER_ID_PATTERN } = require('./mercadoPagoWebhookSecurity');

function createMercadoPagoOrderClient({ accessToken, fetchImpl = globalThis.fetch, timeoutMs = 4000, retries = 1, wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) }) {
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
    }
  };
}

module.exports = { createMercadoPagoOrderClient };
