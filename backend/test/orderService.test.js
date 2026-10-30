const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { createOrderService, normalizeRequest, requestFingerprint, createOrderNumber } = require('../src/services/orderService');
const { createOrderAccessTokenService } = require('../src/services/orderAccessToken');
const { ORDER_TRANSITIONS, PAYMENT_TRANSITIONS, isAllowedTransition } = require('../src/utils/orderStates');

const ids = {
  product: '64b000000000000000000001',
  variant: '64b000000000000000000002',
  point: '64b000000000000000000003',
  special: '64b000000000000000000004'
};
const baseBody = {
  nombre: ' Ana ', apellido: ' Pérez ', correo: ' ANA@example.test ', telefono: '+54 9 11 5555-1234 ',
  observaciones: 'Dejar aviso', retiroId: `PUNTO:${ids.point}`, metodoPago: 'TRANSFERENCIA',
  articulos: [{ productoId: ids.product, varianteId: ids.variant, cantidad: 2 }]
};
const key = 'checkout-op-0001';
const orderAccessTokens = createOrderAccessTokenService('test-secret-for-order-access-only-123456');

function duplicate(field) {
  const error = new Error('duplicate');
  error.code = 11000;
  error.keyPattern = { [field]: 1 };
  return error;
}

function fixture({ cart, pickups, randoms = [123456], failItems = false, failReservation = false } = {}) {
  const rows = { pedidos: [], items: [], histories: [], reservations: [] };
  let inventoryWrites = 0;
  let nextId = 0;
  const sessions = [];
  function query(value) {
    const promise = Promise.resolve(value);
    return { select: () => promise, then: (...args) => promise.then(...args) };
  }
  const Pedido = {
    db: {
      startSession: async () => {
        const session = {
          written: [],
          async withTransaction(callback) {
            try { await callback(); }
            catch (error) {
              for (const [collection, document] of this.written) rows[collection] = rows[collection].filter((row) => row !== document);
              throw error;
            }
          },
          async endSession() { this.ended = true; }
        };
        sessions.push(session);
        return session;
      }
    },
    findOne: ({ idOperacion }) => query(rows.pedidos.find((order) => order.idOperacion === idOperacion) || null),
    create: async ([document], { session }) => {
      if (rows.pedidos.some((row) => row.idOperacion === document.idOperacion)) throw duplicate('idOperacion');
      if (rows.pedidos.some((row) => row.numero === document.numero)) throw duplicate('numero');
      const created = { ...document, _id: document._id || new mongoose.Types.ObjectId(`64b${String(++nextId).padStart(21, '0')}`) };
      rows.pedidos.push(created);
      session.written.push(['pedidos', created]);
      return [created];
    }
  };
  const ItemPedido = {
    find: ({ pedidoId }) => Promise.resolve(rows.items.filter((item) => String(item.pedidoId) === String(pedidoId))),
    create: async (documents, { session }) => {
      if (failItems) throw new Error('simulated item write failure');
      const created = documents.map((document) => ({ ...document, _id: new mongoose.Types.ObjectId() }));
      for (const item of created) { rows.items.push(item); session.written.push(['items', item]); }
      return created;
    }
  };
  const HistorialEstadoPedido = {
    create: async ([document], { session }) => {
      const [created] = [{ ...document, _id: new mongoose.Types.ObjectId() }];
      rows.histories.push(created);
      session.written.push(['histories', created]);
      return [created];
    }
  };
  const cartValidationService = { validateCart: async () => cart || ({
    valido: true,
    total: '150.50',
    articulos: [{ valido: true, productoId: ids.product, varianteId: ids.variant, nombre: 'Remera vigente', slug: 'remera-vigente', variante: [{ atributo: 'Talle', valor: 'L' }], cantidad: 2, precioUnitario: '75.25', subtotal: '150.50' }],
    errores: []
  }) };
  const pickupService = { listOptions: async () => pickups || ({
    puntosRetiro: [{ id: ids.point, nombre: 'Morón', direccion: 'Dirección oficial 1', horarios: 'Viernes de 16 a 19', horariosHabituales: [], disponibleParaSeleccionar: true }],
    retirosEspeciales: [{ id: ids.special, evento: 'VEGANPALUJA', fecha: new Date('2027-05-16T00:00:00Z'), lugar: 'Plaza confirmada', direccion: 'Dirección oficial 2', horaInicio: '10:00', horaFin: '12:00', disponibleParaSeleccionar: true }]
  }) };
  const stockReservationService = {
    assertReservationIndex: async () => {},
    reserveForOrder: async ({ pedidoId, articulos, creadoEn, venceEn, session }) => {
      const reservations = articulos.map((item) => ({
        pedidoId, varianteId: item.varianteId, cantidad: item.cantidad,
        estado: 'ACTIVA', creadoEn, venceEn
      }));
      for (const reservation of reservations) {
        rows.reservations.push(reservation);
        session.written.push(['reservations', reservation]);
      }
      if (failReservation) throw new Error('simulated reservation write failure');
      return reservations;
    }
  };
  let randomIndex = 0;
  const inventoryWriteGuard = new Proxy({}, { get: () => async () => { inventoryWrites += 1; throw new Error('CAR-05 must not write inventory'); } });
  const service = createOrderService({ Pedido, ItemPedido, HistorialEstadoPedido, Variante: inventoryWriteGuard, ReservaStock: inventoryWriteGuard, MovimientoStock: inventoryWriteGuard }, {
    cartValidationService, pickupService, stockReservationService, ahora: () => new Date('2026-10-29T12:00:00Z'),
    randomSuffix: () => randoms[Math.min(randomIndex++, randoms.length - 1)], orderAccessTokens
  });
  return { service, rows, sessions, cartValidationService, pickupService, get inventoryWrites() { return inventoryWrites; } };
}

test('normaliza comprador y rechaza campos inesperados, datos inválidos e intentos de imponer precio o estado', () => {
  const input = normalizeRequest(baseBody, key);
  assert.equal(input.nombre, 'Ana');
  assert.equal(input.correo, 'ana@example.test');
  for (const body of [
    { ...baseBody, precio: 1 }, { ...baseBody, estado: 'RETIRADO' }, { ...baseBody, nombre: ' ' },
    { ...baseBody, correo: 'mal' }, { ...baseBody, telefono: '123' }, { ...baseBody, observaciones: 'x'.repeat(1001) },
    { ...baseBody, observaciones: 12 }, { ...baseBody, articulos: [{ ...baseBody.articulos[0], precio: '0.01' }] },
    { ...baseBody, articulos: [{ ...baseBody.articulos[0], cantidad: 1.5 }] }
  ]) assert.throws(() => normalizeRequest(body, key), { statusCode: 400 });
  assert.throws(() => normalizeRequest(baseBody, ''), { statusCode: 400 });
});

test('fingerprint es estable al reordenar líneas y cambia si cambia la solicitud', () => {
  const twoLines = { ...baseBody, articulos: [
    ...baseBody.articulos,
    { productoId: ids.product, varianteId: ids.special, cantidad: 1 }
  ] };
  assert.equal(requestFingerprint(normalizeRequest(twoLines, key)), requestFingerprint(normalizeRequest({ ...twoLines, articulos: [...twoLines.articulos].reverse() }, key)));
  assert.notEqual(requestFingerprint(normalizeRequest(twoLines, key)), requestFingerprint(normalizeRequest({ ...twoLines, metodoPago: 'MERCADO_PAGO' }, key)));
});

test('número legible codifica fecha y sufijo numérico, sin usar countDocuments', () => {
  assert.equal(createOrderNumber(new Date('2026-10-29T12:00:00Z'), () => 7), 20261029000007);
  assert.ok(Number.isSafeInteger(createOrderNumber(new Date('2026-10-29T12:00:00Z'), () => 999999)));
});

test('crea pedido, ítems y estado inicial en transacción con snapshots y precios oficiales', async () => {
  const context = fixture();
  const { service, rows, sessions } = context;
  const result = await service.createOrder(baseBody, key);
  assert.equal(rows.pedidos.length, 1);
  assert.equal(rows.items.length, 1);
  assert.equal(rows.histories.length, 1);
  assert.equal(rows.reservations.length, 1);
  assert.equal(result.pedido.nombre, 'Ana');
  assert.equal(result.pedido.correo, 'ana@example.test');
  assert.equal(result.pedido.total.toString(), '150.50');
  assert.equal(result.pedido.estado, 'NUEVO');
  assert.equal(result.pedido.estadoPago, 'PENDIENTE');
  assert.equal(result.pedido.puntoRetiroSnapshot.nombre, 'Morón');
  assert.equal(orderAccessTokens.matches(result.tokenAccesoPedido, result.pedido.accesoPublicoHash), true);
  assert.equal(result.pedido.accesoPublicoHasta.toISOString(), '2026-11-28T12:00:00.000Z');
  assert.equal(rows.items[0].precio.toString(), '75.25');
  assert.equal(rows.items[0].subtotal.toString(), '150.50');
  assert.equal(rows.items[0].nombreProducto, 'Remera vigente');
  assert.deepEqual(rows.items[0].atributosVariante, [{ atributo: 'Talle', valor: 'L' }]);
  assert.equal(rows.histories[0].estadoNuevo, 'NUEVO');
  assert.equal(rows.reservations[0].estado, 'ACTIVA');
  assert.equal(rows.reservations[0].venceEn.toISOString(), '2026-10-30T12:00:00.000Z');
  assert.equal(rows.reservations[0].venceEn.getTime() - rows.reservations[0].creadoEn.getTime(), 24 * 60 * 60 * 1000);
  assert.equal(sessions[0].ended, true);
  assert.equal(result.repetido, false);
  assert.equal(context.inventoryWrites, 0);
});

test('acepta retiro especial concreto y no permite opción inexistente o deshabilitada', async () => {
  const special = fixture();
  const result = await special.service.createOrder({ ...baseBody, retiroId: `ESPECIAL:${ids.special}` }, key);
  assert.equal(result.pedido.retiroEspecialId.toString(), ids.special);
  assert.equal(result.pedido.retiroEspecialSnapshot.evento, 'VEGANPALUJA');
  for (const pickups of [
    { puntosRetiro: [], retirosEspeciales: [] },
    { puntosRetiro: [{ id: ids.point, nombre: 'Morón', disponibleParaSeleccionar: false }], retirosEspeciales: [] }
  ]) {
    const { service, rows } = fixture({ pickups });
    await assert.rejects(service.createOrder(baseBody, key), { statusCode: 409 });
    assert.equal(rows.pedidos.length, 0);
  }
});

test('rechaza carrito inválido, incluidas cantidades, producto, variante o precio que CAR-02 no valida', async () => {
  for (const cart of [
    { valido: false, errores: [{ codigo: 'PRODUCTO_NO_DISPONIBLE' }] },
    { valido: true, total: '1.00', articulos: [{ valido: true, productoId: ids.product, varianteId: ids.variant, cantidad: 1, precioUnitario: '-1', subtotal: '1.00' }] },
    { valido: true, total: '1.00', articulos: [{ valido: true, productoId: ids.product, varianteId: ids.variant, cantidad: 1, precioUnitario: '1.00', subtotal: 'NaN' }] }
  ]) {
    const { service, rows } = fixture({ cart });
    await assert.rejects(service.createOrder(baseBody, key), { statusCode: 422 });
    assert.equal(rows.pedidos.length, 0);
  }
});

test('reintento idempotente devuelve el mismo pedido histórico aunque cambie el catálogo', async () => {
  const { service, rows, cartValidationService } = fixture();
  const first = await service.createOrder(baseBody, key);
  cartValidationService.validateCart = async () => { throw new Error('no debe recalcular un pedido ya creado'); };
  const retry = await service.createOrder(baseBody, key);
  assert.equal(retry.pedido._id.toString(), first.pedido._id.toString());
  assert.equal(retry.articulos[0].precio.toString(), '75.25');
  assert.equal(retry.repetido, true);
  assert.equal(retry.tokenAccesoPedido, first.tokenAccesoPedido);
  assert.equal(rows.pedidos.length, 1);
  assert.equal(rows.items.length, 1);
});

test('dos solicitudes simultáneas con la misma clave producen un único pedido', async () => {
  const { service, rows } = fixture();
  const [first, second] = await Promise.all([
    service.createOrder(baseBody, 'checkout-op-same-key'),
    service.createOrder(baseBody, 'checkout-op-same-key')
  ]);
  assert.equal(rows.pedidos.length, 1);
  assert.equal(rows.items.length, 1);
  assert.equal(first.pedido._id.toString(), second.pedido._id.toString());
  assert.equal([first.repetido, second.repetido].filter(Boolean).length, 1);
});

test('reutilizar clave con otros datos devuelve conflicto y no crea duplicados', async () => {
  const { service, rows } = fixture();
  await service.createOrder(baseBody, key);
  await assert.rejects(service.createOrder({ ...baseBody, articulos: [{ ...baseBody.articulos[0], cantidad: 3 }] }, key), { statusCode: 409 });
  assert.equal(rows.pedidos.length, 1);
});

test('colisión concurrente de número se reintenta con unicidad respaldada por el índice', async () => {
  const { service, rows } = fixture({ randoms: [123456, 123456, 654321] });
  const [one, two] = await Promise.all([
    service.createOrder(baseBody, 'checkout-op-concurrent-1'),
    service.createOrder({ ...baseBody, correo: 'b@example.test' }, 'checkout-op-concurrent-2')
  ]);
  assert.notEqual(one.pedido.numero, two.pedido.numero);
  assert.equal(rows.pedidos.length, 2);
});

test('fallo al guardar ítems revierte la escritura transaccional del pedido', async () => {
  const { service, rows } = fixture({ failItems: true });
  await assert.rejects(service.createOrder(baseBody, key), /simulated item write failure/);
  assert.equal(rows.pedidos.length, 0);
  assert.equal(rows.items.length, 0);
  assert.equal(rows.histories.length, 0);
  assert.equal(rows.reservations.length, 0);
});

test('fallo en la reserva revierte pedido, ítems y estado inicial', async () => {
  const { service, rows } = fixture({ failReservation: true });
  await assert.rejects(service.createOrder(baseBody, key), /simulated reservation write failure/);
  assert.equal(rows.pedidos.length, 0);
  assert.equal(rows.items.length, 0);
  assert.equal(rows.histories.length, 0);
  assert.equal(rows.reservations.length, 0);
});

test('Mercado Pago sigue deshabilitado hasta definir vencimiento de sus reservas', async () => {
  const { service, rows } = fixture();
  await assert.rejects(service.createOrder({ ...baseBody, metodoPago: 'MERCADO_PAGO' }, key), { statusCode: 503 });
  assert.equal(rows.pedidos.length, 0);
  assert.equal(rows.reservations.length, 0);
});

test('estados de pedido y pago tienen transiciones separadas y no habilitan cambios del comprador', () => {
  assert.deepEqual(ORDER_TRANSITIONS.NUEVO, ['EN_PREPARACION', 'CANCELADO']);
  assert.equal(isAllowedTransition(ORDER_TRANSITIONS, 'NUEVO', 'RETIRADO'), false);
  assert.equal(isAllowedTransition(ORDER_TRANSITIONS, 'LISTO_PARA_RETIRAR', 'RETIRADO'), true);
  assert.equal(isAllowedTransition(PAYMENT_TRANSITIONS, 'PENDIENTE', 'APROBADO'), true);
  assert.equal(isAllowedTransition(PAYMENT_TRANSITIONS, 'APROBADO', 'RETIRADO'), false);
  assert.throws(() => normalizeRequest({ ...baseBody, estadoPago: 'APROBADO' }, key), { statusCode: 400 });
});
