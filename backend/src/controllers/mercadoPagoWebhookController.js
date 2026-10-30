function createMercadoPagoWebhookController(service) {
  return {
    async receive(req, res) {
      try {
        const result = await service.handle(req);
        res.status(200).json(result);
      } catch (error) {
        const status = [400, 401, 503].includes(error?.statusCode) ? error.statusCode : 503;
        const message = status === 400
          ? 'La notificación no tiene un formato válido'
          : status === 401
            ? 'No se pudo autenticar la notificación'
            : 'La notificación no pudo procesarse; Mercado Pago puede reintentarla';
        res.status(status).json({ error: message });
      }
    }
  };
}

module.exports = createMercadoPagoWebhookController;
