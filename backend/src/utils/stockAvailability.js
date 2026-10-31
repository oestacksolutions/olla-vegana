const logger = require('./observability');

const INCONSISTENCY_CODES = Object.freeze({
  STOCK_FISICO_INVALIDO: 'STOCK_FISICO_INVALIDO',
  RESERVA_CANTIDAD_INVALIDA: 'RESERVA_CANTIDAD_INVALIDA',
  RESERVA_VENCIMIENTO_INVALIDO: 'RESERVA_VENCIMIENTO_INVALIDO',
  RESERVAS_SUPERAN_STOCK: 'RESERVAS_SUPERAN_STOCK'
});

function calculateStockAvailability(stockFisicoInput, reservations = [], now = new Date()) {
  const convertedStock = Number(stockFisicoInput);
  const stockIsValid = Number.isSafeInteger(convertedStock) && convertedStock >= 0;
  const stockFisico = Number.isFinite(convertedStock) ? convertedStock : 0;
  const stockForSale = stockIsValid ? convertedStock : Math.max(0, Math.floor(stockFisico));
  const inconsistencias = [];
  if (!stockIsValid) inconsistencias.push(INCONSISTENCY_CODES.STOCK_FISICO_INVALIDO);

  let cantidadReservada = 0;
  for (const reservation of reservations || []) {
    if (reservation.estado !== 'ACTIVA') continue;
    const expiry = new Date(reservation.venceEn);
    if (Number.isNaN(expiry.getTime())) {
      inconsistencias.push(INCONSISTENCY_CODES.RESERVA_VENCIMIENTO_INVALIDO);
      continue;
    }
    if (expiry <= now) continue;
    const quantity = Number(reservation.cantidad);
    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      inconsistencias.push(INCONSISTENCY_CODES.RESERVA_CANTIDAD_INVALIDA);
      continue;
    }
    cantidadReservada += quantity;
    if (!Number.isSafeInteger(cantidadReservada)) {
      cantidadReservada = Number.MAX_SAFE_INTEGER;
      inconsistencias.push(INCONSISTENCY_CODES.RESERVA_CANTIDAD_INVALIDA);
      break;
    }
  }

  if (cantidadReservada > stockForSale) inconsistencias.push(INCONSISTENCY_CODES.RESERVAS_SUPERAN_STOCK);
  return {
    stockFisico,
    cantidadReservada,
    stockDisponible: Math.max(0, stockForSale - cantidadReservada),
    inconsistente: inconsistencias.length > 0,
    inconsistencias: [...new Set(inconsistencias)]
  };
}

function logStockInconsistency(variantId, result, log = (entry) => logger.warn('inventory.inconsistency', entry)) {
  if (!result?.inconsistente) return;
  log({
    fecha: new Date().toISOString(),
    tipo: 'INCONSISTENCIA_STOCK',
    varianteId: String(variantId),
    codigos: result.inconsistencias
  });
}

module.exports = { calculateStockAvailability, logStockInconsistency, INCONSISTENCY_CODES };
