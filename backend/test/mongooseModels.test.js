const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Pedido = require('../src/models/Pedido');
const ItemPedido = require('../src/models/ItemPedido');
const ReservaStock = require('../src/models/ReservaStock');
const MovimientoStock = require('../src/models/MovimientoStock');
const EventoPago = require('../src/models/EventoPago');
const Admin = require('../src/models/Admin');
const PuntoRetiro = require('../src/models/PuntoRetiro');
const RetiroEspecial = require('../src/models/RetiroEspecial');
const Reintegro = require('../src/models/Reintegro');

test('modelos de pedido requieren datos históricos y enums válidos', async () => {
  const pedido = new Pedido({});
  await assert.rejects(pedido.validate());
  const item = new ItemPedido({ pedidoId: new mongoose.Types.ObjectId(), productoId: new mongoose.Types.ObjectId(), cantidad: 1, precio: '10.00', nombreProducto: 'Producto histórico' });
  await item.validate();
  assert.equal(ItemPedido.schema.path('nombreProducto').isRequired, true);
  assert.equal(ItemPedido.schema.path('precio').instance, 'Decimal128');
});

test('reservas y movimientos validan cantidades, estados e índices consultables', async () => {
  const reservation = new ReservaStock({ pedidoId: new mongoose.Types.ObjectId(), varianteId: new mongoose.Types.ObjectId(), cantidad: 0, venceEn: new Date() });
  await assert.rejects(reservation.validate());
  const movement = new MovimientoStock({ varianteId: new mongoose.Types.ObjectId(), tipo: 'DESCONOCIDO', cantidad: 1 });
  await assert.rejects(movement.validate());
  assert.ok(ReservaStock.schema.indexes().some(([keys, options]) => keys.pedidoId && keys.varianteId && options.unique));
  assert.ok(ReservaStock.schema.indexes().some(([keys]) => keys.estado && keys.venceEn));
  const idempotencyIndex = MovimientoStock.schema.indexes().find(([keys, options]) => keys.idOperacion && options.unique);
  assert.ok(idempotencyIndex);
  assert.deepEqual(idempotencyIndex[1].partialFilterExpression, { idOperacion: { $type: 'string' } });
  assert.equal(MovimientoStock.schema.options.autoIndex, false);
});

test('movimientos nuevos conservan snapshots, administrador e idempotencia sin exigir esos campos en históricos', async () => {
  const movement = new MovimientoStock({
    varianteId: new mongoose.Types.ObjectId(), tipo: 'AJUSTE', cantidad: -2,
    stockAnterior: 8, stockResultante: 6, adminId: new mongoose.Types.ObjectId(),
    idOperacion: 'stock-adjust-0001', motivo: 'Corrección de inventario'
  });
  await movement.validate();
  const legacy = new MovimientoStock({ varianteId: new mongoose.Types.ObjectId(), tipo: 'VENTA', cantidad: -1 });
  await legacy.validate();
});

test('EventoPago no hace único idExterno y deduplica con clave parcial', () => {
  const eventIndexes = EventoPago.schema.indexes();
  assert.equal(eventIndexes.some(([keys, options]) => options.unique && keys.idExterno), false);
  assert.equal(eventIndexes.some(([keys, options]) => options.unique && keys.idempotencia === 1
    && options.partialFilterExpression?.idempotencia?.$type === 'string'), true);
  assert.equal(Admin.schema.path('contrasena').options.select, false);
});

test('puntos aceptan dirección y horario pendientes, validan estructura horaria y permiten nuevos registros', async () => {
  const moron = new PuntoRetiro({
    nombre: 'Morón', direccion: null, activo: true, habilitadoCheckout: false,
    horariosHabituales: [
      { diaSemana: 'MARTES', horaInicio: '16:00', horaFin: '19:00' },
      { diaSemana: 'VIERNES', horaInicio: '16:00', horaFin: '19:00' }
    ]
  });
  await moron.validate();
  const ramos = new PuntoRetiro({ nombre: 'Ramos Mejía', horariosHabituales: [] });
  await ramos.validate();
  const futurePoint = new PuntoRetiro({ nombre: 'Punto nuevo', horariosHabituales: [] });
  await futurePoint.validate();
  const invalidTime = new PuntoRetiro({ nombre: 'Inválido', horariosHabituales: [{ diaSemana: 'VIERNES', horaInicio: '19:00', horaFin: '16:00' }] });
  await assert.rejects(invalidTime.validate());
});

test('PuntoRetiro conserva horarios legados en texto sin exigir migración', async () => {
  const legacyHours = 'Martes y viernes de 16:00 a 19:00';
  const point = new PuntoRetiro({
    nombre: 'Punto legado', direccion: 'Dirección existente', horarios: legacyHours, activo: true
  });
  await point.validate();
  assert.equal(point.horarios, legacyHours);
  assert.deepEqual(point.horariosHabituales, []);
});

test('retiro Veganpaluja exige fecha concreta, lugar y horario y queda deshabilitado por defecto', async () => {
  const withoutDate = new RetiroEspecial({ evento: 'VEGANPALUJA', lugar: 'Lugar confirmado', horaInicio: '10:00', horaFin: '12:00' });
  await assert.rejects(withoutDate.validate());
  const withDate = new RetiroEspecial({ evento: 'VEGANPALUJA', fecha: new Date('2027-05-16T00:00:00Z'), lugar: 'Lugar confirmado', horaInicio: '10:00', horaFin: '12:00' });
  await withDate.validate();
  assert.equal(withDate.activo, false);
  assert.equal(withDate.habilitadoCheckout, false);
  assert.equal(RetiroEspecial.schema.path('puntoRetiroId'), undefined);
});

test('pedido conserva referencia al punto o a una fecha especial, exactamente una', async () => {
  const regularId = new mongoose.Types.ObjectId();
  const order = new Pedido({
    numero: 1, nombre: 'Persona', apellido: 'Compradora', correo: 'persona@example.test',
    metodoPago: 'TRANSFERENCIA', total: '100.00', puntoRetiroId: regularId
  });
  await order.validate();
  order.puntoRetiroId = null;
  order.retiroEspecialId = new mongoose.Types.ObjectId();
  await order.validate();
  order.puntoRetiroId = regularId;
  await assert.rejects(order.validate());
});

test('pedido admite snapshots de retiro, observaciones e idempotencia sin cambiar estados históricos', async () => {
  const order = new Pedido({
    numero: 20261029000001, nombre: 'Persona', apellido: 'Compradora', correo: 'persona@example.test',
    telefono: '+54 9 11 5555-1234', observaciones: 'Avisar al llegar', metodoPago: 'TRANSFERENCIA',
    total: '100.00', puntoRetiroId: new mongoose.Types.ObjectId(),
    puntoRetiroSnapshot: { nombre: 'Morón', direccion: 'Dirección existente', horarios: 'Viernes 16 a 19' },
    idOperacion: 'checkout-op-0001', huellaOperacion: 'f'.repeat(64)
  });
  await order.validate();
  assert.equal(order.estado, 'NUEVO');
  assert.equal(order.estadoPago, 'PENDIENTE');
  assert.equal(Pedido.schema.options.timestamps.updatedAt, 'actualizadoEn');
  assert.equal(Pedido.schema.options.autoIndex, false);
  assert.ok(Pedido.schema.indexes().some(([keys, options]) => keys.numero && options.unique));
  assert.ok(Pedido.schema.indexes().some(([keys, options]) => keys.idOperacion && options.unique && options.partialFilterExpression));
  const legacy = new Pedido({ numero: 1, nombre: 'Antigua', apellido: 'Compradora', correo: 'old@example.test', metodoPago: 'MERCADO_PAGO', total: '10.00', puntoRetiroId: new mongoose.Types.ObjectId() });
  await legacy.validate();
  assert.equal(legacy.observaciones, null);
});

test('ítem pedido admite snapshot de atributos y subtotal Decimal128 sin exigirlos a registros antiguos', async () => {
  const historical = new ItemPedido({
    pedidoId: new mongoose.Types.ObjectId(), productoId: new mongoose.Types.ObjectId(), cantidad: 2,
    precio: '75.25', subtotal: '150.50', nombreProducto: 'Remera al comprar', slugProducto: 'remera',
    atributosVariante: [{ atributo: 'Talle', valor: 'L' }]
  });
  await historical.validate();
  assert.equal(historical.subtotal.toString(), '150.50');
  assert.deepEqual(historical.atributosVariante.map(({ atributo, valor }) => [atributo, valor]), [['Talle', 'L']]);
  const legacy = new ItemPedido({ pedidoId: new mongoose.Types.ObjectId(), productoId: new mongoose.Types.ObjectId(), cantidad: 1, precio: '10.00', nombreProducto: 'Producto antiguo' });
  await legacy.validate();
  assert.equal(legacy.subtotal, null);
});

test('Reintegro conserva estados y actores auditables, Decimal128 e índices declarados sin autoIndex', async () => {
  const refund = new Reintegro({
    pedidoId: new mongoose.Types.ObjectId(), metodoPago: 'TRANSFERENCIA', proveedor: 'TRANSFERENCIA',
    tipo: 'PARCIAL', importeSolicitado: '20.50', estado: 'PENDIENTE_MANUAL', motivo: 'Motivo revisado',
    adminSolicitanteId: new mongoose.Types.ObjectId(), idOperacion: 'refund-test-0001',
    huellaSolicitud: 'a'.repeat(64), solicitadoEn: new Date(), historial: [{ estado: 'PENDIENTE_MANUAL' }]
  });
  await refund.validate();
  assert.equal(Reintegro.schema.path('importeSolicitado').instance, 'Decimal128');
  assert.equal(Reintegro.schema.options.autoIndex, false);
  assert.equal(Reintegro.schema.options.autoCreate, false);
  assert.ok(Reintegro.schema.indexes().some(([keys, options]) => keys.idOperacion && options.unique));
  assert.ok(Reintegro.schema.indexes().some(([keys, options]) => keys.idConfirmacion && options.unique && options.partialFilterExpression));
  assert.ok(Reintegro.schema.indexes().some(([keys, options]) => keys.pedidoId && keys.referenciaDevolucion && options.unique && options.partialFilterExpression));
  assert.equal(Pedido.schema.path('estadoReintegro').defaultValue, 'SIN_REINTEGRO');
  assert.equal(ReservaStock.schema.path('liberadaPorAdminId').instance, 'ObjectId');
});
