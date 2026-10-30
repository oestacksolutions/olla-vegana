import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getTransferPreviewStatus } from '../src/utils/transferPreview.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('la vista previa de transferencia solo resuelve rutas en desarrollo', () => {
  for (const status of ['pendiente', 'pagado', 'vencido', 'cancelado']) {
    const pathname = `/__preview/transferencia/${status}`
    assert.equal(getTransferPreviewStatus(pathname, true), status)
    assert.equal(getTransferPreviewStatus(pathname, false), null)
  }
  assert.equal(getTransferPreviewStatus('/__preview/transferencia/otro', true), null)
  assert.equal(getTransferPreviewStatus('/tienda/checkout', true), null)
})

test('App condiciona la ruta a import.meta.env.DEV y la vista DEMO no consulta servicios', () => {
  const app = fs.readFileSync(path.join(root, 'src/App.jsx'), 'utf8')
  const preview = fs.readFileSync(path.join(root, 'src/pages/tienda/TransferInstructionsPreviewPage.jsx'), 'utf8')
  assert.match(app, /if\s*\(import\.meta\.env\.DEV\)\s*\{[\s\S]*?getTransferPreviewStatus\(pathname, true\)/)
  assert.match(preview, /DEMO\.NO\.TRANSFERIR/)
  assert.match(preview, /0000000000000000000000/)
  assert.match(preview, /Titular ficticio DEMO/)
  assert.doesNotMatch(preview, /getTransferInstructions|fetch\(|axios/)
})
