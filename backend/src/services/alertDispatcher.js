const { sanitize } = require('../utils/logger');

function createAlertDispatcher({ enabled = false, sink = null, webhookUrl, fetchImpl = globalThis.fetch, logger, cooldownMs = 5 * 60 * 1000, now = () => Date.now() } = {}) {
  const recent = new Map();
  let delivery = sink;
  if (!delivery && webhookUrl && typeof fetchImpl === 'function') {
    let validUrl = false;
    try { validUrl = new URL(webhookUrl).protocol === 'https:'; } catch { validUrl = false; }
    if (validUrl) {
      delivery = async (alert) => {
        const response = await fetchImpl(webhookUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(alert),
          signal: AbortSignal.timeout(3000)
        });
        if (!response.ok) throw Object.assign(new Error('Alert sink rejected request'), { code: `HTTP_${response.status}` });
      };
    }
  }
  return Object.freeze({
    configured: enabled && typeof delivery === 'function',
    async dispatch(key, event, context = {}) {
      if (!enabled || typeof delivery !== 'function') return { sent: false, disabled: true };
      const instant = now();
      const previous = recent.get(key);
      if (previous && instant - previous < cooldownMs) return { sent: false, deduplicated: true };
      recent.set(key, instant);
      if (recent.size > 1000) {
        for (const [entry, at] of recent) if (instant - at >= cooldownMs) recent.delete(entry);
      }
      try {
        await delivery(sanitize({ key, event, context }));
        return { sent: true };
      } catch (error) {
        logger?.error('monitoring.alert_delivery_failed', { alertKey: key, errorCode: String(error?.code || error?.name || 'ALERT_DELIVERY_ERROR') });
        return { sent: false, failed: true };
      }
    }
  });
}

module.exports = { createAlertDispatcher };

