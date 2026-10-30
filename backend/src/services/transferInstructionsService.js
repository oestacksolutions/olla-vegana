const AppError = require('../utils/AppError');
const mongoose = require('mongoose');

const CONFIG_KEYS = Object.freeze({
  alias: 'transferencia_alias',
  cbuCvu: 'transferencia_cbu_cvu',
  titular: 'transferencia_titular',
  banco: 'transferencia_banco',
  instrucciones: 'transferencia_instrucciones'
});

function moneyText(value) {
  const amount = Number(typeof value?.toString === 'function' ? value.toString() : value);
  if (!Number.isFinite(amount) || amount < 0) throw AppError.conflicto('El total del pedido no está disponible para preparar la transferencia');
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount);
}

function execute(query) {
  if (query && typeof query.lean === 'function') query = query.lean();
  return query && typeof query.exec === 'function' ? query.exec() : Promise.resolve(query);
}

function createTransferInstructionsService({ Configuracion, Pedido, ReservaStock }, { ahora = () => new Date(), orderAccessTokens } = {}) {
  async function getInstructions(pedido) {
    if (!pedido || pedido.metodoPago !== 'TRANSFERENCIA') throw AppError.solicitudInvalida('El pedido no corresponde a una transferencia');
    if (pedido.estadoPago !== 'PENDIENTE' || pedido.estado === 'CANCELADO') {
      throw AppError.conflicto('El pedido no admite instrucciones de transferencia');
    }
    let query = Configuracion.find({ _id: { $in: Object.values(CONFIG_KEYS) } });
    if (query && typeof query.lean === 'function') query = query.lean();
    const rows = query && typeof query.exec === 'function' ? await query.exec() : await query;
    const config = Object.fromEntries((rows || []).map((row) => [row._id, typeof row.valor === 'string' ? row.valor.trim() : '']));
    const alias = config[CONFIG_KEYS.alias] || null;
    const cbuCvu = config[CONFIG_KEYS.cbuCvu] || null;
    const titular = config[CONFIG_KEYS.titular] || null;
    if ((!alias && !cbuCvu) || !titular) {
      throw new AppError('Las instrucciones de transferencia todavía no están configuradas', 503);
    }
    if (!(pedido.venceEn instanceof Date) || !Number.isFinite(pedido.venceEn.getTime())) {
      throw AppError.conflicto('El vencimiento de la transferencia no está disponible');
    }
    if (!(pedido.venceEn > ahora())) throw AppError.conflicto('El plazo para transferir ya venció');
    return {
      pedidoNumero: pedido.numero,
      titular,
      alias,
      cbuCvu,
      banco: config[CONFIG_KEYS.banco] || null,
      importe: moneyText(pedido.total),
      importeDecimal: pedido.total.toString(),
      venceEn: pedido.venceEn.toISOString(),
      referencia: String(pedido.numero),
      instrucciones: config[CONFIG_KEYS.instrucciones] || 'Indicá el número de pedido como referencia de la transferencia.'
    };
  }

  async function getForBuyer(pedidoId, token) {
    // Usar el mismo mensaje para IDs inexistentes y accesos inválidos evita enumerar pedidos.
    if (!orderAccessTokens || !mongoose.isObjectIdOrHexString(pedidoId)) throw AppError.noEncontrado('Pedido no encontrado o enlace inválido');
    let query = Pedido.findById(pedidoId);
    if (query && typeof query.select === 'function') {
      query = query.select('numero total metodoPago estado estadoPago venceEn creadoEn accesoPublicoHasta +accesoPublicoHash');
    }
    const pedido = await execute(query);
    const now = ahora();
    if (!pedido || !orderAccessTokens.matches(token, pedido.accesoPublicoHash)
      || !(pedido.accesoPublicoHasta instanceof Date) || pedido.accesoPublicoHasta <= now) {
      throw AppError.noEncontrado('Pedido no encontrado o enlace inválido');
    }
    if (pedido.metodoPago !== 'TRANSFERENCIA') throw AppError.noEncontrado('Pedido no encontrado o enlace inválido');

    const base = {
      pedidoNumero: pedido.numero,
      importe: moneyText(pedido.total),
      importeDecimal: pedido.total.toString(),
      venceEn: pedido.venceEn?.toISOString?.() || null,
      estadoPedido: pedido.estado,
      estadoPago: pedido.estadoPago
    };
    if (pedido.estadoPago === 'APROBADO') return { ...base, estado: 'PAGADO', instrucciones: null };
    if (pedido.estadoPago === 'RECHAZADO') return { ...base, estado: 'RECHAZADO', instrucciones: null };
    if (pedido.estadoPago === 'REEMBOLSADO') return { ...base, estado: 'REEMBOLSADO', instrucciones: null };
    if (pedido.estado === 'CANCELADO') return { ...base, estado: 'CANCELADO', instrucciones: null };
    if (!(pedido.venceEn instanceof Date) || pedido.venceEn <= now) {
      return { ...base, estado: 'VENCIDO', venceEn: pedido.venceEn?.toISOString?.() || null, instrucciones: null };
    }
    if (pedido.estadoPago !== 'PENDIENTE') return { ...base, estado: 'REQUIERE_REVISION', instrucciones: null };

    const reservations = await execute(ReservaStock.find({ pedidoId: pedido._id }));
    const reservationIsValid = reservations.length > 0
      && reservations.every((reservation) => reservation.estado === 'ACTIVA'
        && reservation.venceEn instanceof Date && reservation.venceEn > now);
    if (!reservationIsValid) return { ...base, estado: 'REQUIERE_REVISION', instrucciones: null };

    try {
      const instructions = await getInstructions(pedido);
      return { ...base, estado: 'PENDIENTE', instrucciones: instructions };
    } catch (error) {
      if (error?.statusCode === 503) {
        return { ...base, estado: 'CONFIGURACION_PENDIENTE', venceEn: pedido.venceEn.toISOString(), instrucciones: null };
      }
      throw error;
    }
  }

  return { getInstructions, getForBuyer };
}

module.exports = { createTransferInstructionsService, CONFIG_KEYS };
