const mongoose = require('mongoose');
const AppError = require('../utils/AppError');
const { ORDER_TRANSITIONS, isAllowedTransition } = require('../utils/orderStates');

const MAX_PAGE_SIZE = 50;
const OPERATIONAL_STATES = new Set(['NUEVO', 'EN_PREPARACION', 'LISTO_PARA_RETIRAR', 'RETIRADO']);
const PAYMENT_STATES = new Set(['PENDIENTE', 'APROBADO', 'RECHAZADO', 'REEMBOLSADO']);
const PAYMENT_METHODS = new Set(['MERCADO_PAGO', 'TRANSFERENCIA']);

function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function invalid(message) { throw AppError.solicitudInvalida(message); }
function decimal(value) { return value == null ? null : String(value); }
function historicalSubtotal(item) {
  if (item.subtotal != null || item.precio == null || !Number.isSafeInteger(item.cantidad)) return item.subtotal ?? null;
  const match = String(item.precio).match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return null;
  const cents = (BigInt(match[1]) * 100n + BigInt((match[2] || '').padEnd(2, '0') || '0')) * BigInt(item.cantidad);
  return `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`;
}
function execute(query) { return query && typeof query.exec === 'function' ? query.exec() : Promise.resolve(query); }
function withSession(query, session) { return query && typeof query.session === 'function' ? query.session(session) : query; }

function parseListQuery(query = {}) {
  const allowed = ['q', 'estado', 'estadoPago', 'metodoPago', 'retiro', 'desde', 'hasta', 'page', 'limit'];
  if (Object.keys(query).some((key) => !allowed.includes(key))) invalid('La consulta contiene filtros no permitidos');
  const text = (key, max = 120) => {
    if (query[key] === undefined) return undefined;
    if (typeof query[key] !== 'string' || query[key].trim().length > max) invalid(`El filtro ${key} no es válido`);
    return query[key].trim();
  };
  const positiveInteger = (key, fallback, max) => {
    if (query[key] === undefined) return fallback;
    if (typeof query[key] !== 'string' || !/^\d+$/.test(query[key])) invalid(`El filtro ${key} debe ser entero`);
    const value = Number(query[key]);
    if (!Number.isSafeInteger(value) || value < 1 || value > max) invalid(`El filtro ${key} está fuera de rango`);
    return value;
  };
  const estado = text('estado');
  const estadoPago = text('estadoPago');
  const metodoPago = text('metodoPago');
  if (estado && !OPERATIONAL_STATES.has(estado) && estado !== 'CANCELADO') invalid('El estado del pedido no es válido');
  if (estadoPago && !PAYMENT_STATES.has(estadoPago)) invalid('El estado del pago no es válido');
  if (metodoPago && !PAYMENT_METHODS.has(metodoPago)) invalid('El método de pago no es válido');
  const parseDate = (key, end = false) => {
    const value = text(key, 10);
    if (!value) return undefined;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) invalid(`El filtro ${key} debe tener formato AAAA-MM-DD`);
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) invalid(`El filtro ${key} no es una fecha válida`);
    if (end) date.setUTCDate(date.getUTCDate() + 1);
    return date;
  };
  const desde = parseDate('desde');
  const hasta = parseDate('hasta', true);
  if (desde && hasta && desde >= hasta) invalid('El rango de fechas no es válido');
  return {
    q: text('q'), estado, estadoPago, metodoPago, retiro: text('retiro'), desde, hasta,
    page: positiveInteger('page', 1, Number.MAX_SAFE_INTEGER),
    limit: positiveInteger('limit', 20, MAX_PAGE_SIZE)
  };
}

function createAdminOrderService(models, {
  startSession = () => models.Pedido.db.startSession(),
  operationalChangesEnabled = false,
  transferConfirmationEnabled = false,
  emailOutbox = null,
  now = () => new Date()
} = {}) {
  const { Pedido, ItemPedido, HistorialEstadoPedido, IntentoPago, ConfirmacionTransferencia, Reintegro, ReservaStock } = models;

  function matchesSearch(q) {
    if (!q) return {};
    const orderNumberText = q.toUpperCase().replace(/^OV[-#]?/, '');
    if (/^\d+$/.test(orderNumberText) && Number.isSafeInteger(Number(orderNumberText))) return { numero: Number(orderNumberText) };
    const regex = new RegExp(escapeRegex(q), 'i');
    return { $or: [{ nombre: regex }, { apellido: regex }, { correo: regex }] };
  }

  function buildFilter(filters) {
    const match = { ...matchesSearch(filters.q) };
    if (filters.estado) match.estado = filters.estado;
    if (filters.estadoPago) match.estadoPago = filters.estadoPago;
    if (filters.metodoPago) match.metodoPago = filters.metodoPago;
    if (filters.retiro) {
      const regex = new RegExp(escapeRegex(filters.retiro), 'i');
      match.$and = [...(match.$and || []), { $or: [
        { 'puntoRetiroSnapshot.nombre': regex }, { 'puntoRetiroSnapshot.direccion': regex },
        { 'retiroEspecialSnapshot.evento': regex }, { 'retiroEspecialSnapshot.lugar': regex },
        { 'retiroEspecialSnapshot.direccion': regex }
      ] }];
    }
    if (filters.desde || filters.hasta) {
      match.creadoEn = {};
      if (filters.desde) match.creadoEn.$gte = filters.desde;
      if (filters.hasta) match.creadoEn.$lt = filters.hasta;
    }
    return match;
  }

  function pickupInfo(order) {
    if (order.puntoRetiroSnapshot) return { tipo: 'PUNTO', ...order.puntoRetiroSnapshot };
    if (order.retiroEspecialSnapshot) return { tipo: 'ESPECIAL', ...order.retiroEspecialSnapshot };
    return null;
  }

  function serializeOrder(order, items = []) {
    const lines = items.map((item) => ({
      id: String(item._id), productoId: String(item.productoId), varianteId: item.varianteId ? String(item.varianteId) : null,
      nombre: item.nombreProducto, slug: item.slugProducto, atributos: item.atributosVariante || [],
      detalleVariante: item.detalleVariante, cantidad: item.cantidad,
      precioUnitario: decimal(item.precio), subtotal: decimal(historicalSubtotal(item))
    }));
    return {
      id: String(order._id), numero: order.numero, numeroPublico: `OV-${order.numero}`,
      creadoEn: order.creadoEn, actualizadoEn: order.actualizadoEn,
      comprador: { nombre: order.nombre, apellido: order.apellido, correo: order.correo, telefono: order.telefono || null },
      total: decimal(order.total), metodoPago: order.metodoPago, estadoPago: order.estadoPago, estado: order.estado,
      retiro: pickupInfo(order), pagadoEn: order.pagadoEn || order.pagoVerificadoEn || null,
      retiradoEn: order.retiradoEn || null, transferenciaRecibidaEn: order.transferenciaRecibidaEn || null,
      transferenciaReferencia: order.transferenciaReferencia || null,
      pagoReferencia: order.mpPagoId || null,
      articulos: lines
    };
  }

  async function listOrders(query = {}) {
    const filters = parseListQuery(query);
    const where = buildFilter(filters);
    const skip = (filters.page - 1) * filters.limit;
    if (!Number.isSafeInteger(skip)) invalid('La página solicitada no es válida');
    const [orders, total] = await Promise.all([
      execute(Pedido.find(where).sort({ creadoEn: -1, _id: -1 }).skip(skip).limit(filters.limit).lean()),
      Pedido.countDocuments(where)
    ]);
    const ids = orders.map((order) => order._id);
    const items = ids.length ? await execute(ItemPedido.find({ pedidoId: { $in: ids } }).sort({ _id: 1 }).lean()) : [];
    const itemsByOrder = new Map();
    for (const item of items) itemsByOrder.set(String(item.pedidoId), [...(itemsByOrder.get(String(item.pedidoId)) || []), item]);
    return {
      pedidos: orders.map((order) => serializeOrder(order, itemsByOrder.get(String(order._id)) || [])),
      acciones: { cambiosOperativosHabilitados: operationalChangesEnabled, confirmacionTransferenciaHabilitada: transferConfirmationEnabled },
      paginacion: { pagina: filters.page, limite: filters.limit, total, paginas: Math.ceil(total / filters.limit) }
    };
  }

  async function getOrder(orderId) {
    if (!mongoose.isObjectIdOrHexString(orderId)) invalid('El identificador del pedido no es válido');
    const order = await execute(Pedido.findById(orderId).lean());
    if (!order) throw AppError.noEncontrado('Pedido no encontrado');
    const [items, history, attempt, confirmations, refunds, reservations] = await Promise.all([
      execute(ItemPedido.find({ pedidoId: order._id }).sort({ _id: 1 }).lean()),
      execute(HistorialEstadoPedido.find({ pedidoId: order._id }).sort({ creadoEn: 1, _id: 1 }).populate({ path: 'adminId', select: 'correo' }).lean()),
      execute(IntentoPago?.findOne({ pedidoId: order._id }).sort({ creadoEn: -1 }).lean()),
      execute(ConfirmacionTransferencia?.find({ pedidoId: order._id }).sort({ creadoEn: -1 }).populate({ path: 'adminId', select: 'correo' }).lean()),
      execute(Reintegro?.find({ pedidoId: order._id }).sort({ creadoEn: -1 }).lean()),
      execute(ReservaStock?.find({ pedidoId: order._id }).sort({ creadoEn: 1 }).lean())
    ]);
    const serialized = serializeOrder(order, items);
    return {
      ...serialized,
      acciones: { cambiosOperativosHabilitados: operationalChangesEnabled, confirmacionTransferenciaHabilitada: transferConfirmationEnabled },
      observaciones: order.observaciones || null,
      estadoReintegro: order.estadoReintegro || 'SIN_REINTEGRO',
      intentosPago: attempt ? [{ proveedor: attempt.proveedor, orderExternaId: attempt.orderExternaId, pagoExternoId: attempt.pagoExternoId, estadoCreacion: attempt.estadoCreacion, estadoProveedor: attempt.estadoProveedor, detalleEstadoProveedor: attempt.detalleEstadoProveedor, moneda: attempt.moneda, pagoVerificadoEn: attempt.pagoVerificadoEn, incidencia: attempt.incidencia }] : [],
      confirmacionesTransferencia: confirmations.map((entry) => ({ referencia: entry.referencia, importeAcreditado: decimal(entry.importeAcreditado), resultado: entry.resultado, recibidoEn: entry.recibidoEn, admin: entry.adminId?.correo || null })),
      reintegros: refunds.map((entry) => ({ tipo: entry.tipo, importeSolicitado: decimal(entry.importeSolicitado), importeConfirmado: decimal(entry.importeConfirmado), estado: entry.estado, motivo: entry.motivo, solicitadoEn: entry.solicitadoEn, procesadoEn: entry.procesadoEn, incidencia: entry.incidencia })),
      reservas: reservations.map((entry) => ({ varianteId: String(entry.varianteId), cantidad: entry.cantidad, estado: entry.estado, venceEn: entry.venceEn, confirmadaEn: entry.confirmadaEn, liberadaEn: entry.liberadaEn })),
      puedeConfirmarTransferencia: order.metodoPago === 'TRANSFERENCIA' && order.estadoPago === 'PENDIENTE'
        && reservations.length > 0 && reservations.every((entry) => entry.estado === 'ACTIVA' && entry.venceEn instanceof Date && entry.venceEn > now())
        && order.estado !== 'CANCELADO',
      retiradoPor: (() => {
        const retirement = history.find((entry) => entry.estadoNuevo === 'RETIRADO');
        const admin = retirement?.adminId;
        return admin ? { id: String(admin._id || admin), correo: admin.correo || null } : null;
      })(),
      historial: history.map((entry) => ({ estadoAnterior: entry.estadoAnterior, estadoNuevo: entry.estadoNuevo, nota: entry.nota || null, creadoEn: entry.creadoEn, adminId: entry.adminId?._id ? String(entry.adminId._id) : (entry.adminId ? String(entry.adminId) : null), admin: entry.adminId?.correo || null }))
    };
  }

  async function transitionOrder(orderId, input, adminId) {
    if (!mongoose.isObjectIdOrHexString(orderId)) invalid('El identificador del pedido no es válido');
    if (!input || typeof input !== 'object' || Array.isArray(input)
      || Object.keys(input).some((key) => !['estado', 'nota'].includes(key))) invalid('La solicitud contiene campos no permitidos');
    if (!OPERATIONAL_STATES.has(input.estado)) invalid('El estado operativo no es válido');
    if (input.nota !== undefined && (typeof input.nota !== 'string' || input.nota.trim().length > 500)) invalid('La nota debe tener hasta 500 caracteres');
    if (!mongoose.isObjectIdOrHexString(adminId)) throw AppError.prohibido('Se requiere una sesión administrativa válida');
    if (!operationalChangesEnabled) throw new AppError('Los cambios de estado están temporalmente deshabilitados hasta validar transacciones MongoDB aisladas', 503);
    const session = await startSession();
    try {
      let result;
      await session.withTransaction(async () => {
        const order = await execute(withSession(Pedido.findById(orderId).select('_id numero estado estadoPago estadoReintegro'), session));
        if (!order) throw AppError.noEncontrado('Pedido no encontrado');
        if (!isAllowedTransition(ORDER_TRANSITIONS, order.estado, input.estado) || input.estado === 'CANCELADO') {
          throw AppError.conflicto('La transición operativa solicitada no está permitida');
        }
        if (input.estado === 'RETIRADO' && order.estadoPago !== 'APROBADO') {
          throw AppError.conflicto('Solo se puede marcar como retirado un pedido con pago confirmado');
        }
        if (input.estado === 'RETIRADO') {
          const refundState = order.estadoReintegro || 'SIN_REINTEGRO';
          const refund = await execute(withSession(Reintegro?.findOne({ pedidoId: order._id, estado: { $ne: 'FALLIDO' } }), session));
          if (refundState !== 'SIN_REINTEGRO' || refund) {
            throw AppError.conflicto('El pedido tiene un reintegro solicitado o registrado y requiere revisión antes de confirmar la entrega');
          }
        }
        const updated = await execute(Pedido.findOneAndUpdate(
          { _id: order._id, estado: order.estado, estadoPago: order.estadoPago },
          { $set: { estado: input.estado, ...(input.estado === 'RETIRADO' ? { retiradoEn: now() } : {}) } },
          { new: true, runValidators: true, session }
        ));
        if (!updated) throw AppError.conflicto('El pedido cambió en otra sesión; actualizá los datos antes de reintentar');
        await HistorialEstadoPedido.create([{
          pedidoId: order._id, estadoAnterior: order.estado, estadoNuevo: input.estado,
          nota: typeof input.nota === 'string' && input.nota.trim() ? input.nota.trim() : null,
          adminId, creadoEn: now()
        }], { session });
        if (input.estado === 'LISTO_PARA_RETIRAR' && emailOutbox) {
          await emailOutbox.enqueue({ pedidoId: order._id, tipo: 'LISTO_PARA_RETIRAR', session });
        }
        result = String(updated._id);
      });
      return getOrder(result);
    } finally { await session.endSession(); }
  }

  return { listOrders, getOrder, transitionOrder };
}

module.exports = { createAdminOrderService, parseListQuery, MAX_PAGE_SIZE };
