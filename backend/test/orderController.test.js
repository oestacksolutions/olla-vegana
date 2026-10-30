const { test } = require('node:test');
const assert = require('node:assert/strict');
const createOrderController = require('../src/controllers/orderController');

test('respuesta futura de creación no expone datos personales y enlaza instrucciones con token en fragmento', async () => {
  const token = 'a'.repeat(43);
  const controller = createOrderController({
    async createOrder(body, key) {
      assert.equal(body.nombre, 'Persona privada');
      assert.equal(key, 'order-key-0001');
      return {
        pedido: {
          _id: '507f1f77bcf86cd799439011', numero: 123, estado: 'NUEVO', estadoPago: 'PENDIENTE',
          metodoPago: 'TRANSFERENCIA', total: { toString: () => '45.00' }, venceEn: new Date('2026-10-31T00:00:00Z'),
          nombre: 'Persona privada', correo: 'private@example.test'
        },
        tokenAccesoPedido: token,
        repetido: false
      };
    }
  });
  const result = await new Promise((resolve, reject) => {
    const res = { status(code) { this.statusCode = code; return this; }, json(body) { resolve({ statusCode: this.statusCode, body }); } };
    controller.createOrder({ body: { nombre: 'Persona privada' }, get: () => 'order-key-0001' }, res, reject);
  });
  assert.equal(result.statusCode, 201);
  assert.equal(result.body.pedido.total, '45.00');
  assert.equal('nombre' in result.body.pedido, false);
  assert.equal('correo' in result.body.pedido, false);
  assert.match(result.body.instruccionesUrl, /#acceso=/);
  assert.equal(result.body.instruccionesUrl.includes(token), true);
});
