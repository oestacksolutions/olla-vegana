const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calculateStockAvailability } = require('../src/utils/stockAvailability');

const now = new Date('2026-10-29T12:00:00.000Z');

test('descuenta solo reservas activas vigentes y limita el resultado a cero', () => {
  const result = calculateStockAvailability(4, [
    { estado: 'ACTIVA', cantidad: 2, venceEn: new Date('2026-10-29T13:00:00Z') },
    { estado: 'ACTIVA', cantidad: 8, venceEn: new Date('2026-10-29T11:00:00Z') },
    { estado: 'CONFIRMADA', cantidad: 4, venceEn: new Date('2026-10-29T13:00:00Z') },
    { estado: 'LIBERADA', cantidad: 3, venceEn: new Date('2026-10-29T13:00:00Z') }
  ], now);
  assert.equal(result.cantidadReservada, 2);
  assert.equal(result.stockDisponible, 2);
  assert.equal(result.inconsistente, false);
});

test('no devuelve disponibilidad negativa e informa si las reservas exceden el físico', () => {
  const result = calculateStockAvailability(2, [
    { estado: 'ACTIVA', cantidad: 3, venceEn: new Date('2026-10-29T13:00:00Z') }
  ], now);
  assert.equal(result.stockDisponible, 0);
  assert.equal(result.inconsistente, true);
  assert.ok(result.inconsistencias.includes('RESERVAS_SUPERAN_STOCK'));
});

test('reporta stock físico y reservas inválidas para revisión', () => {
  const result = calculateStockAvailability(-2, [
    { estado: 'ACTIVA', cantidad: 0, venceEn: new Date('2026-10-29T13:00:00Z') },
    { estado: 'ACTIVA', cantidad: 2, venceEn: 'fecha-inválida' }
  ], now);
  assert.equal(result.stockFisico, -2);
  assert.equal(result.stockDisponible, 0);
  assert.equal(result.inconsistente, true);
  assert.ok(result.inconsistencias.includes('STOCK_FISICO_INVALIDO'));
  assert.ok(result.inconsistencias.includes('RESERVA_CANTIDAD_INVALIDA'));
  assert.ok(result.inconsistencias.includes('RESERVA_VENCIMIENTO_INVALIDO'));
});
