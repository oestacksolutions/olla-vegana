const asyncHandler = require('../utils/asyncHandler');

function createOrderController(orderService) {
  return {
    createOrder: asyncHandler(async (req, res) => {
      const result = await orderService.createOrder(req.body, req.get('Idempotency-Key'));
      const pedido = result.pedido;
      const id = String(pedido._id);
      const token = result.tokenAccesoPedido;
      res.status(result.repetido ? 200 : 201).json({
        pedido: {
          id,
          numero: pedido.numero,
          estado: pedido.estado,
          estadoPago: pedido.estadoPago,
          metodoPago: pedido.metodoPago,
          total: pedido.total.toString(),
          venceEn: pedido.venceEn?.toISOString?.() || null
        },
        instruccionesUrl: pedido.metodoPago === 'TRANSFERENCIA' && token
          ? `/tienda/pedido/${encodeURIComponent(id)}/transferencia#acceso=${encodeURIComponent(token)}`
          : null,
        repetido: result.repetido
      });
    })
  };
}

module.exports = createOrderController;
