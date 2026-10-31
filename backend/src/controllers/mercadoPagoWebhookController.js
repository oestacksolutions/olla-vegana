const logger = require('../utils/observability');

function createMercadoPagoWebhookController(service) {
  return {
    async receive(req, res) {
      try {
        const result = await service.handle(req);
        logger.info('payment.webhook.processed', {
          requestId: req.requestId || null,
          provider: 'MERCADO_PAGO',
          status: result?.estado || (result?.requiereRevision ? 'REQUIERE_CONCILIACION' : 'RECIBIDO'),
          orderId: typeof req.body?.data?.id === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(req.body.data.id) ? req.body.data.id : undefined
        });
        if (result?.requiereRevision) void logger.alerts?.dispatch('payment:webhook:reconciliation', 'payment.webhook.reconciliation_required', { requestId: req.requestId || null });
        res.status(200).json(result);
      } catch (error) {
        const status = [400, 401, 503].includes(error?.statusCode) ? error.statusCode : 503;
        const message = status === 400
          ? 'La notificación no tiene un formato válido'
          : status === 401
            ? 'No se pudo autenticar la notificación'
            : 'La notificación no pudo procesarse; Mercado Pago puede reintentarla';
        logger.warn(status === 401 ? 'payment.webhook.rejected' : 'payment.webhook.failed', {
          requestId: req.requestId || null, provider: 'MERCADO_PAGO', status,
          errorCode: String(error?.code || error?.name || 'WEBHOOK_ERROR')
        });
        if (status === 503) void logger.alerts?.dispatch(`payment:webhook:${String(error?.code || 'processing')}`, 'payment.webhook.processing_failed', {
          requestId: req.requestId || null, errorCode: String(error?.code || error?.name || 'WEBHOOK_ERROR')
        });
        res.status(status).json({ error: message });
      }
    }
  };
}

module.exports = createMercadoPagoWebhookController;
