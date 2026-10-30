import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readOrderAccessToken, transferStatusPresentation } from '../src/utils/orderTransferUi.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('lee solamente el token opaco del fragmento y rechaza parámetros editables de consulta', () => {
  const token = 'a'.repeat(43)
  assert.equal(readOrderAccessToken(`#acceso=${token}`), token)
  assert.equal(readOrderAccessToken(`?acceso=${token}`), '')
  assert.equal(readOrderAccessToken('#importe=1&alias=falso'), '')
  assert.equal(readOrderAccessToken(`#acceso=${'x'.repeat(20)}`), '')
})

test('presenta estados de pago sin confundir pantalla abierta con acreditación', () => {
  assert.match(transferStatusPresentation('PENDIENTE')[0], /Pendiente/)
  assert.match(transferStatusPresentation('PAGADO')[1], /confirmó administrativamente/)
  assert.match(transferStatusPresentation('VENCIDO')[1], /ya no son válidas/)
  assert.match(transferStatusPresentation('CONFIGURACION_PENDIENTE')[1], /No realices una transferencia/)
})

test('la página obtiene el pedido por API con token, muestra los controles solicitados y no usa datos personales locales', () => {
  const page = fs.readFileSync(path.join(root, 'src/pages/tienda/TransferInstructionsPage.jsx'), 'utf8')
  const app = fs.readFileSync(path.join(root, 'src/App.jsx'), 'utf8')
  const api = fs.readFileSync(path.join(root, 'src/services/api.js'), 'utf8')
  assert.match(page, /getTransferInstructions\(orderId, token/)
  assert.match(page, /Copiar alias/)
  assert.match(page, /Copiar CBU\/CVU/)
  assert.match(page, /24 horas/)
  assert.match(page, /no está integrado/)
  assert.match(page, /sm:flex-row/)
  assert.doesNotMatch(page, /location\.search|localStorage|searchParams\.get\(['"]importe/)
  assert.match(api, /accessToken/)
  assert.match(app, /transferInstructionsMatch/)
  assert.match(app, /TransferInstructionsPage orderId=/)
})

test('el checkout conserva el bloqueo y la ruta pública POST de pedidos sigue deshabilitada', () => {
  const checkout = fs.readFileSync(path.join(root, 'src/pages/tienda/CheckoutPage.jsx'), 'utf8')
  const orderRoutes = fs.readFileSync(path.join(root, '../backend/src/routes/orderRoutes.js'), 'utf8')
  assert.match(checkout, /todavía no se crean desde esta etapa/)
  assert.match(orderRoutes, /status\(503\)/)
})
