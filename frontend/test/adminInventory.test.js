import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { availabilityLabel, attributePairs, formatAmount, isValidAdjustment, summarizeValues } from '../src/admin/utils/inventory.js'

test('interpreta estados con la disponibilidad real y umbral configurable', () => {
  assert.equal(availabilityLabel({ stockDisponible: 0 }), 'Sin disponibilidad')
  assert.equal(availabilityLabel({ stockDisponible: 3 }, 4), 'Stock bajo')
  assert.equal(availabilityLabel({ stockDisponible: 6 }, 4), 'Disponible')
  assert.equal(availabilityLabel({ stockDisponible: 20, inconsistente: true }), 'Revisar inventario')
})

test('construye combinaciones de uno o varios atributos sin fabricar IDs', () => {
  assert.deepEqual(attributePairs({ color: 'color-id', talle: 'size-id', empty: '' }), [
    { atributoId: 'color', valorAtributoId: 'color-id' },
    { atributoId: 'talle', valorAtributoId: 'size-id' }
  ])
  assert.deepEqual(attributePairs({}), [])
  assert.equal(summarizeValues([{ atributo: 'Color', valor: 'Negro' }, { atributo: 'Talle', valor: 'M' }]), 'Color: Negro · Talle: M')
  assert.equal(summarizeValues([]), 'Sin opciones')
})

test('valida ingresos y ajustes como enteros, con motivo, sin aceptar cero ni negativos en reposición', () => {
  assert.equal(isValidAdjustment('INGRESO', '4', 'Reposición'), true)
  assert.equal(isValidAdjustment('INGRESO', '-2', 'Corrección'), false)
  assert.equal(isValidAdjustment('AJUSTE', '-2', 'Rotura'), true)
  assert.equal(isValidAdjustment('AJUSTE', '1.5', 'Corrección'), false)
  assert.equal(isValidAdjustment('AJUSTE', '0', 'Corrección'), false)
  assert.equal(isValidAdjustment('AJUSTE', '2', '  '), false)
})

test('muestra precio monetario y el panel conecta servicios reales con estado, historial y confirmación', () => {
  assert.match(formatAmount('27000.00'), /27\.000,00/)
  const page = fs.readFileSync(new URL('../src/admin/pages/AdminInventoryPage.jsx', import.meta.url), 'utf8')
  assert.match(page, /getAdminStock\(/)
  assert.match(page, /getAdminStockMovements\(/)
  assert.match(page, /createAdminVariant\(/)
  assert.match(page, /updateAdminVariant\(/)
  assert.match(page, /window\.confirm/)
  assert.match(page, /sm:flex-row/)
  assert.doesNotMatch(page, /localStorage|MOVEMENTS_KEY|onSaveProducts/)
})
