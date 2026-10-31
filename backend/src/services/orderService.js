const crypto = require('node:crypto');
const mongoose = require('mongoose');
const AppError = require('../utils/AppError');
const { parseMoneyToCents, formatCents } = require('./cartValidationService');
const { TRANSFER_RESERVATION_MS, isTransientConflict } = require('./stockReservationService');

const PAYMENT_METHODS = new Set(['MERCADO_PAGO', 'TRANSFERENCIA']);
const ALLOWED_KEYS = new Set([
  'nombre', 'apellido', 'correo', 'telefono', 'observaciones',
  'retiroId', 'metodoPago', 'articulos'
]);
const MAX_LINES = 50;
const MAX_QUANTITY = 100;
const MAX_NUMBER_ATTEMPTS = 12;
const ALLOWED_LINE_KEYS = new Set(['productoId', 'varianteId', 'cantidad']);

function invalid(message, detalles) {
  throw AppError.solicitudInvalida(message, detalles);
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeRequest(body, idempotencyKey) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) invalid('El cuerpo del pedido no es válido');
  const unexpected = Object.keys(body).filter((key) => !ALLOWED_KEYS.has(key));
  if (unexpected.length) invalid('El pedido contiene campos no permitidos', unexpected.map((campo) => ({ campo })));

  const nombre = normalizeText(body.nombre);
  const apellido = normalizeText(body.apellido);
  const correo = normalizeText(body.correo).toLowerCase();
  const telefono = normalizeText(body.telefono);
  if (body.observaciones !== undefined && body.observaciones !== null && typeof body.observaciones !== 'string') {
    invalid('Las observaciones deben ser texto');
  }
  const observaciones = normalizeText(body.observaciones);
  if (!nombre || nombre.length > 80) invalid('El nombre es obligatorio y debe tener hasta 80 caracteres');
  if (!apellido || apellido.length > 80) invalid('El apellido es obligatorio y debe tener hasta 80 caracteres');
  if (!correo || correo.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) invalid('El correo electrónico no es válido');
  const phoneDigits = telefono.replace(/\D/g, '');
  if (!telefono || telefono.length > 30 || !/^\+?[\d\s().-]+$/.test(telefono) || phoneDigits.length < 8 || phoneDigits.length > 15) {
    invalid('El teléfono de contacto no es válido');
  }
  if (observaciones.length > 1000) invalid('Las observaciones no pueden superar 1000 caracteres');
  if (!PAYMENT_METHODS.has(body.metodoPago)) invalid('El método de pago no es válido');
  if (typeof body.retiroId !== 'string' || !/^(PUNTO|ESPECIAL):[a-f\d]{24}$/i.test(body.retiroId)) {
    invalid('La opción de retiro no es válida');
  }
  if (!Array.isArray(body.articulos) || body.articulos.length < 1 || body.articulos.length > MAX_LINES) {
    invalid(`El pedido debe contener entre 1 y ${MAX_LINES} artículos`);
  }
  const articulos = body.articulos.map((line, index) => {
    if (!line || typeof line !== 'object' || Array.isArray(line)
      || Object.keys(line).some((field) => !ALLOWED_LINE_KEYS.has(field))
      || typeof line.productoId !== 'string' || !mongoose.isObjectIdOrHexString(line.productoId)
      || typeof line.varianteId !== 'string' || !mongoose.isObjectIdOrHexString(line.varianteId)
      || !Number.isSafeInteger(line.cantidad) || line.cantidad < 1 || line.cantidad > MAX_QUANTITY) {
      invalid('Cada artículo debe incluir IDs válidos y una cantidad entera permitida', [{ indice: index }]);
    }
    return { productoId: line.productoId, varianteId: line.varianteId, cantidad: line.cantidad };
  });
  if (typeof idempotencyKey !== 'string' || idempotencyKey.length < 8 || idempotencyKey.length > 128 || !/^[\w.:/-]+$/.test(idempotencyKey)) {
    invalid('Falta una clave de operación válida en el encabezado Idempotency-Key');
  }
  return {
    nombre, apellido, correo, telefono,
    observaciones: observaciones || null,
    metodoPago: body.metodoPago,
    retiroId: body.retiroId,
    articulos,
    idOperacion: idempotencyKey
  };
}

function requestFingerprint(input) {
  const articulos = input.articulos.map((line) => ({
    productoId: line?.productoId,
    varianteId: line?.varianteId,
    cantidad: line?.cantidad
  })).sort((a, b) => `${a.productoId}:${a.varianteId}`.localeCompare(`${b.productoId}:${b.varianteId}`));
  const canonical = JSON.stringify({
    nombre: input.nombre, apellido: input.apellido, correo: input.correo,
    telefono: input.telefono, observaciones: input.observaciones,
    metodoPago: input.metodoPago, retiroId: input.retiroId, articulos
  });
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

function hasDuplicateKey(error, field) {
  return error?.code === 11000 && (error.keyPattern?.[field] === 1 || Object.hasOwn(error.keyValue || {}, field));
}

function createOrderNumber(now, randomSuffix) {
  const date = now.toISOString().slice(0, 10).replaceAll('-', '');
  return Number(`${date}${String(randomSuffix()).padStart(6, '0')}`);
}

function optionSnapshot(option) {
  if (option.tipo === 'PUNTO') {
    return {
      puntoRetiroId: new mongoose.Types.ObjectId(option.id),
      puntoRetiroSnapshot: {
        nombre: option.nombre,
        direccion: option.direccion || null,
        indicaciones: option.indicaciones || '',
        zonaHoraria: option.zonaHoraria || 'America/Argentina/Buenos_Aires',
        horarios: option.horarios || null,
        horariosHabituales: option.horariosHabituales || []
      },
      retiroEspecialId: null,
      retiroEspecialSnapshot: null
    };
  }
  return {
    puntoRetiroId: null,
    puntoRetiroSnapshot: null,
    retiroEspecialId: new mongoose.Types.ObjectId(option.id),
    retiroEspecialSnapshot: {
      evento: option.evento,
      nombre: option.nombre || 'Veganpaluja',
      fecha: option.fecha,
      fechaInicio: option.fechaInicio || option.fecha,
      fechaFin: option.fechaFin || option.fecha,
      lugar: option.lugar,
      direccion: option.direccion || null,
      indicaciones: option.indicaciones || '',
      zonaHoraria: option.zonaHoraria || 'America/Argentina/Buenos_Aires',
      horaInicio: option.horaInicio,
      horaFin: option.horaFin,
      horariosRetiro: option.horariosRetiro || []
    }
  };
}

function createOrderService(models, dependencies = {}) {
  const { Pedido, ItemPedido, HistorialEstadoPedido } = models;
  const { cartValidationService, pickupService, stockReservationService, orderAccessTokens, emailOutbox } = dependencies;
  const now = dependencies.ahora || (() => new Date());
  const randomSuffix = dependencies.randomSuffix || (() => crypto.randomInt(0, 1_000_000));
  const startSession = dependencies.startSession || (() => Pedido.db.startSession());

  async function findByOperation(idOperacion) {
    let query = Pedido.findOne({ idOperacion });
    if (query && typeof query.select === 'function') query = query.select('+huellaOperacion +accesoPublicoHash');
    return query;
  }

  async function existingResult(input, fingerprint) {
    const existing = await findByOperation(input.idOperacion);
    if (!existing) return null;
    if (existing.huellaOperacion !== fingerprint) {
      throw AppError.conflicto('La clave de operación ya se utilizó con otros datos');
    }
    const items = await ItemPedido.find({ pedidoId: existing._id });
    const accessToken = orderAccessTokens.issue({ pedidoId: existing._id, idOperacion: input.idOperacion });
    if (!orderAccessTokens.matches(accessToken, existing.accesoPublicoHash)) {
      throw new AppError('El acceso seguro a este pedido requiere revisión', 503);
    }
    return { pedido: existing, articulos: items, tokenAccesoPedido: accessToken, repetido: true };
  }

  async function createOrder(body, idempotencyKey) {
    if (!cartValidationService || !pickupService || !stockReservationService) throw new Error('Falta el coordinador transaccional de reservas');
    if (!orderAccessTokens) throw new AppError('La creación permanece deshabilitada hasta configurar el acceso seguro al pedido', 503);
    const input = normalizeRequest(body, idempotencyKey);
    if (input.metodoPago === 'MERCADO_PAGO') {
      throw new AppError('Mercado Pago seguirá deshabilitado hasta definir y verificar su política de vencimiento de reservas', 503);
    }
    const fingerprint = requestFingerprint(input);
    const previous = await existingResult(input, fingerprint);
    if (previous) return previous;
    await stockReservationService.assertReservationIndex();

    function buildSnapshot(cart) {
      if (!cart?.valido) {
        throw new AppError('El carrito cambió o contiene artículos no disponibles', 422, cart?.errores || []);
      }
      let computedTotalCents = 0n;
      const items = cart.articulos.map((line) => {
        const priceCents = parseMoneyToCents(line.precioUnitario);
        const subtotalCents = parseMoneyToCents(line.subtotal);
        if (!line.valido || !mongoose.isObjectIdOrHexString(line.productoId) || !mongoose.isObjectIdOrHexString(line.varianteId)
          || typeof line.nombre !== 'string' || !line.nombre.trim()
          || !Number.isSafeInteger(line.cantidad) || line.cantidad < 1 || line.cantidad > MAX_QUANTITY
          || !Array.isArray(line.variante)
          || line.variante.some((attribute) => typeof attribute?.atributo !== 'string' || typeof attribute?.valor !== 'string')
          || priceCents === null || subtotalCents === null || priceCents < 0n || subtotalCents < 0n
          || subtotalCents !== priceCents * BigInt(line.cantidad)) {
          throw new AppError('El carrito no devolvió precios oficiales válidos', 422);
        }
        computedTotalCents += subtotalCents;
        const attributes = (line.variante || []).map(({ atributo, valor }) => ({ atributo, valor }));
        return {
          pedidoId: null,
          productoId: new mongoose.Types.ObjectId(line.productoId),
          varianteId: new mongoose.Types.ObjectId(line.varianteId),
          nombreProducto: line.nombre,
          slugProducto: line.slug,
          atributosVariante: attributes,
          detalleVariante: attributes.length ? attributes.map(({ atributo, valor }) => `${atributo}: ${valor}`).join(' · ') : null,
          cantidad: line.cantidad,
          precio: mongoose.Types.Decimal128.fromString(formatCents(priceCents)),
          subtotal: mongoose.Types.Decimal128.fromString(formatCents(subtotalCents))
        };
      });
      const totalCents = parseMoneyToCents(cart.total);
      if (totalCents === null || totalCents < 0n || totalCents !== computedTotalCents) {
        throw new AppError('El carrito no devolvió un total válido', 422);
      }
      return { items, totalCents };
    }

    for (let attempt = 0; attempt < MAX_NUMBER_ATTEMPTS; attempt += 1) {
      const session = await startSession();
      let created;
      try {
        await session.withTransaction(async () => {
          const creadoEn = now();
          if (!(creadoEn instanceof Date) || !Number.isFinite(creadoEn.getTime())) {
            throw new TypeError('El reloj del servicio devolvió una fecha inválida');
          }
          const venceEn = new Date(creadoEn.getTime() + TRANSFER_RESERVATION_MS);
          const cart = await cartValidationService.validateCart({ articulos: input.articulos }, { session });
          const pickupData = await pickupService.listOptions({ session });
          const options = [
            ...(pickupData?.puntosRetiro || []).filter((option) => option.disponibleParaSeleccionar).map((option) => ({ ...option, tipo: 'PUNTO', seleccionId: `PUNTO:${option.id}` })),
            ...(pickupData?.retirosEspeciales || []).filter((option) => option.disponibleParaSeleccionar).map((option) => ({ ...option, tipo: 'ESPECIAL', seleccionId: `ESPECIAL:${option.id}` }))
          ];
          const selectedPickup = options.find((option) => option.seleccionId === input.retiroId);
          if (!selectedPickup) throw AppError.conflicto('La opción de retiro ya no está disponible');
          const { items, totalCents } = buildSnapshot(cart);
          const pickupReference = optionSnapshot(selectedPickup);
          const pedidoId = new mongoose.Types.ObjectId();
          const accessToken = orderAccessTokens.issue({ pedidoId, idOperacion: input.idOperacion });
          const [pedido] = await Pedido.create([{
            _id: pedidoId,
            numero: createOrderNumber(creadoEn, randomSuffix),
            nombre: input.nombre,
            apellido: input.apellido,
            correo: input.correo,
            telefono: input.telefono,
            observaciones: input.observaciones,
            metodoPago: input.metodoPago,
            estado: 'NUEVO',
            estadoPago: 'PENDIENTE',
            total: mongoose.Types.Decimal128.fromString(formatCents(totalCents)),
            creadoEn,
            venceEn,
            accesoPublicoHash: orderAccessTokens.hash(accessToken),
            accesoPublicoHasta: new Date(creadoEn.getTime() + orderAccessTokens.TOKEN_VALIDITY_MS),
            ...pickupReference,
            idOperacion: input.idOperacion,
            huellaOperacion: fingerprint
          }], { session });
          await stockReservationService.reserveForOrder({
            pedidoId: pedido._id,
            articulos: items.map((item) => ({ varianteId: item.varianteId, cantidad: item.cantidad })),
            creadoEn,
            venceEn,
            session
          });
          const itemDocs = await ItemPedido.create(items.map((item) => ({ ...item, pedidoId: pedido._id })), { session });
          const [history] = await HistorialEstadoPedido.create([{
            pedidoId: pedido._id,
            estadoAnterior: null,
            estadoNuevo: 'NUEVO',
            nota: 'Pedido creado'
          }], { session });
          if (emailOutbox) await emailOutbox.enqueue({ pedidoId: pedido._id, tipo: 'PEDIDO_CREADO', session });
          created = { pedido, articulos: itemDocs, historial: history, tokenAccesoPedido: accessToken };
        });
        return { ...created, repetido: false };
      } catch (error) {
        if (hasDuplicateKey(error, 'idOperacion')) {
          const retryResult = await existingResult(input, fingerprint);
          if (retryResult) return retryResult;
        }
        if (isTransientConflict(error)) continue;
        if (!hasDuplicateKey(error, 'numero')) throw error;
      } finally {
        await session.endSession();
      }
    }
    throw AppError.conflicto('No se pudo asignar un número único al pedido; intentá nuevamente');
  }

  return { createOrder };
}

module.exports = {
  createOrderService,
  normalizeRequest,
  requestFingerprint,
  createOrderNumber,
  MAX_NUMBER_ATTEMPTS
};
