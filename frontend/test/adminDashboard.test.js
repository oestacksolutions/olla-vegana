import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { buildSummaryParagraph, DASHBOARD_PERIODS, hasAttentionItems } from '../src/admin/utils/dashboardSummary.js'

test('selector ofrece hoy, últimos 7 días y últimos 30 días', () => {
  assert.deepEqual(DASHBOARD_PERIODS.map(({ value }) => value), ['today', '7d', '30d'])
})

test('redacta actividad real y no incluye importes inválidos', () => {
  const text = buildSummaryParagraph({ period: '30d', orders: { placed: 2, pendingPayment: 1 }, payments: { confirmedCount: 1, creditedGross: '1200.00', confirmedRefunds: '200.00', netReliable: true, netMovement: '1000.00' } })
  assert.match(text, /2 pedidos/)
  assert.match(text, /1\.200,00/)
  assert.match(text, /1\.000,00/)
  const invalidAmount = buildSummaryParagraph({ period: '30d', orders: { placed: 2, pendingPayment: 0 }, payments: { confirmedCount: 1, creditedGross: null, confirmedRefunds: '0.00' } })
  assert.match(invalidAmount, /no puede calcularse con fiabilidad/)
  assert.doesNotMatch(invalidAmount, /NaN/)
})

test('indica cuando el neto no puede calcularse y detecta alertas', () => {
  const text = buildSummaryParagraph({ period: 'today', orders: { placed: 0, pendingPayment: 0 }, payments: { confirmedCount: 0, creditedGross: '0.00', confirmedRefunds: '0.00', netReliable: false } })
  assert.match(text, /no puede calcularse con fiabilidad/)
  assert.equal(hasAttentionItems({ transferPaymentsPending: 1 }), true)
  assert.equal(hasAttentionItems({ transferPaymentsPending: 0, pickupsPending: 0, lowStockCount: 0, outOfStockCount: 0 }), false)
})

test('dashboard usa API protegida, incluye estados de carga/error y no usa series demo', () => {
  const source = fs.readFileSync(new URL('../src/admin/pages/AdminDashboard.jsx', import.meta.url), 'utf8')
  assert.match(source, /getAdminDashboardSummary/)
  assert.match(source, /DASHBOARD_PERIODS/)
  assert.match(source, /role="status"/)
  assert.match(source, /role="alert"/)
  assert.match(source, /sm:flex-row/)
  assert.doesNotMatch(source, /mockSalesSeries|mockOrders/)
})
