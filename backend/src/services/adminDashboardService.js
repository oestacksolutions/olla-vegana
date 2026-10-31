const AppError = require('../utils/AppError');

const PERIODS = Object.freeze({ today: 'today', '7d': '7d', '30d': '30d' });
const TIME_ZONE = 'America/Argentina/Buenos_Aires';

function argentinaDayStart(now) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE, year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23'
  }).formatToParts(now).reduce((result, part) => ({ ...result, [part.type]: Number(part.value) }), {});
  const localNowAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  const offset = localNowAsUtc - Math.floor(new Date(now).getTime() / 1000) * 1000;
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day) - offset);
}

function periodRange(period, now = new Date()) {
  if (!Object.hasOwn(PERIODS, period)) throw AppError.solicitudInvalida('El período solicitado no es válido');
  const end = new Date(now);
  const start = period === 'today'
    ? argentinaDayStart(end)
    : new Date(end.getTime() - (period === '7d' ? 7 : 30) * 24 * 60 * 60 * 1000);
  return { start, end };
}

function rows(model, pipeline) {
  const result = model.aggregate(pipeline);
  return result && typeof result.exec === 'function' ? result.exec() : Promise.resolve(result);
}

function decimalString(value) {
  if (value == null) return '0.00';
  const string = typeof value === 'object' && value.toString ? value.toString() : String(value);
  return /^-?\d+(?:\.\d+)?$/.test(string) ? string : null;
}

function createAdminDashboardService({ Pedido, Reintegro, Producto, Variante, ReservaStock }, {
  lowStockThreshold = 5,
  ahora = () => new Date()
} = {}) {
  if (![Pedido, Reintegro, Producto, Variante, ReservaStock].every(Boolean)) {
    throw new TypeError('El resumen administrativo requiere modelos de pedidos, reintegros y stock');
  }
  if (!Number.isSafeInteger(lowStockThreshold) || lowStockThreshold < 0) throw new TypeError('El umbral de stock bajo debe ser un entero no negativo');

  async function getSummary(period) {
    const { start, end } = periodRange(period, ahora());
    const window = { $gte: start, $lte: end };
    const [orderResult, refundResult, stockResult] = await Promise.all([
      rows(Pedido, [{ $facet: {
        placed: [{ $match: { creadoEn: window } }, { $count: 'count' }],
        pendingPayment: [{ $match: { creadoEn: window, estadoPago: 'PENDIENTE', estado: { $ne: 'CANCELADO' } } }, { $count: 'count' }],
        credited: [
          { $match: { estadoPago: { $in: ['APROBADO', 'REEMBOLSADO'] } } },
          { $addFields: { creditDate: { $ifNull: ['$pagoVerificadoEn', { $ifNull: ['$pagadoEn', '$transferenciaRecibidaEn'] }] } } },
          { $match: { creditDate: window } },
          { $addFields: { convertedTotal: { $convert: { input: '$total', to: 'decimal', onError: null, onNull: null } } } },
          { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$convertedTotal' }, malformed: { $sum: { $cond: [{ $eq: ['$convertedTotal', null] }, 1, 0] } } } }
        ],
        pendingTransfers: [{ $match: { metodoPago: 'TRANSFERENCIA', estadoPago: 'PENDIENTE', estado: { $ne: 'CANCELADO' } } }, { $count: 'count' }],
        awaitingPickup: [{ $match: { estadoPago: 'APROBADO', estado: 'LISTO_PARA_RETIRAR' } }, { $count: 'count' }]
      } }]),
      rows(Reintegro, [{ $facet: {
        completed: [
          { $match: { estado: 'COMPLETADO' } },
          { $match: { confirmadoEn: window } },
          { $addFields: { convertedAmount: { $convert: { input: '$importeConfirmado', to: 'decimal', onError: null, onNull: null } } } },
          { $group: { _id: null, amount: { $sum: '$convertedAmount' }, count: { $sum: 1 }, malformed: { $sum: { $cond: [{ $eq: ['$convertedAmount', null] }, 1, 0] } } } }
        ],
        malformedCompleted: [{ $match: { estado: 'COMPLETADO', $or: [{ confirmadoEn: { $exists: false } }, { confirmadoEn: null }, { importeConfirmado: { $exists: false } }, { importeConfirmado: null }] } }, { $count: 'count' }]
      } }]),
      stockSummary({ Producto, Variante, ReservaStock }, end, lowStockThreshold)
    ]);

    const order = orderResult?.[0] || {};
    const refunds = refundResult?.[0] || {};
    const creditedAmount = decimalString(order.credited?.[0]?.amount);
    const refundedAmount = decimalString(refunds.completed?.[0]?.amount);
    const netReliable = !refunds.malformedCompleted?.[0]?.count
      && !order.credited?.[0]?.malformed && creditedAmount !== null && refundedAmount !== null;
    const net = netReliable ? subtractDecimalStrings(creditedAmount, refundedAmount) : null;
    const attention = stockResult || {};
    return {
      period,
      range: { from: start.toISOString(), to: end.toISOString(), timeZone: TIME_ZONE },
      orders: { placed: order.placed?.[0]?.count || 0, pendingPayment: order.pendingPayment?.[0]?.count || 0 },
      payments: {
        confirmedCount: order.credited?.[0]?.count || 0,
        creditedGross: order.credited?.[0]?.malformed ? null : creditedAmount,
        confirmedRefunds: refunds.completed?.[0]?.malformed ? null : refundedAmount,
        netMovement: net,
        netReliable
      },
      attention: {
        transferPaymentsPending: order.pendingTransfers?.[0]?.count || 0,
        pickupsPending: order.awaitingPickup?.[0]?.count || 0,
        stockThreshold: lowStockThreshold,
        lowStockCount: attention.lowStockCount || 0,
        lowStockProducts: attention.lowStockProducts || [],
        outOfStockCount: attention.outOfStockCount || 0,
        outOfStockProducts: attention.outOfStockProducts || []
      }
    };
  }
  return { getSummary };
}

function subtractDecimalStrings(left, right) {
  // ARS is displayed to cents; convert decimal strings to integer cents without binary float arithmetic.
  const cents = (value) => {
    const [whole, fraction = ''] = value.split('.');
    return BigInt(whole) * 100n + BigInt((fraction + '00').slice(0, 2));
  };
  const value = cents(left) - cents(right);
  const sign = value < 0n ? '-' : '';
  const absolute = value < 0n ? -value : value;
  return `${sign}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`;
}

async function stockSummary({ Producto, Variante, ReservaStock }, now, threshold) {
  const pipeline = [
    { $match: { activa: true } },
    { $lookup: { from: Producto.collection.name, localField: 'productoId', foreignField: '_id', as: 'producto' } },
    { $unwind: '$producto' },
    { $match: { 'producto.activo': { $ne: false } } },
    { $lookup: {
      from: ReservaStock.collection.name, let: { variantId: '$_id' }, as: 'reservas',
      pipeline: [{ $match: { $expr: { $and: [
        { $eq: ['$varianteId', '$$variantId'] }, { $eq: ['$estado', 'ACTIVA'] }, { $gt: ['$venceEn', now] }
      ] } } }, { $group: { _id: null, cantidad: { $sum: '$cantidad' } } }]
    } },
    { $addFields: {
      stockDisponibleCalculado: { $max: [0, { $subtract: [{ $max: [0, '$stock'] }, { $ifNull: [{ $first: '$reservas.cantidad' }, 0] }] }] }
    } },
    { $group: { _id: '$producto._id', nombre: { $first: '$producto.nombre' }, disponible: { $sum: '$stockDisponibleCalculado' } } },
    { $facet: {
      low: [{ $match: { disponible: { $gt: 0, $lte: threshold } } }, { $sort: { disponible: 1, nombre: 1 } }, { $count: 'count' }],
      lowProducts: [{ $match: { disponible: { $gt: 0, $lte: threshold } } }, { $sort: { disponible: 1, nombre: 1 } }, { $limit: 5 }, { $project: { _id: 0, name: '$nombre', available: '$disponible' } }],
      out: [{ $match: { disponible: 0 } }, { $sort: { nombre: 1 } }, { $count: 'count' }],
      outProducts: [{ $match: { disponible: 0 } }, { $sort: { nombre: 1 } }, { $limit: 5 }, { $project: { _id: 0, name: '$nombre', available: '$disponible' } }]
    } }
  ];
  const result = await rows(Variante, pipeline);
  const data = result?.[0] || {};
  return {
    lowStockCount: data.low?.[0]?.count || 0,
    lowStockProducts: data.lowProducts || [],
    outOfStockCount: data.out?.[0]?.count || 0,
    outOfStockProducts: data.outProducts || []
  };
}

module.exports = { createAdminDashboardService, periodRange, argentinaDayStart, stockSummary, subtractDecimalStrings, TIME_ZONE };
