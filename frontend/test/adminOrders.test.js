import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../src')

test('la pantalla administrativa usa endpoints reales de listado, detalle y acciones permitidas', () => {
  const page = readFileSync(resolve(root, 'admin/pages/AdminOrdersPage.jsx'), 'utf8')
  assert.match(page, /getAdminOrders/)
  assert.match(page, /getAdminOrder/)
  assert.match(page, /updateAdminOrderStatus/)
  assert.match(page, /confirmAdminTransfer/)
  assert.doesNotMatch(page, /mockOrders|datos de muestra|Exportar CSV/)
});

test('la pantalla presenta estados de carga, error, vacío, bloqueo y datos históricos', () => {
  const page = readFileSync(resolve(root, 'admin/pages/AdminOrdersPage.jsx'), 'utf8')
  assert.match(page, /Cargando pedidos/)
  assert.match(page, /role="alert"/)
  assert.match(page, /No hay pedidos con estos filtros/)
  assert.match(page, /cambiosOperativosHabilitados/)
  assert.match(page, /precios históricos/)
});
