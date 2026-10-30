import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  availablePickupOptions,
  buildCartValidationPayload,
  cartFingerprint,
  CHECKOUT_DRAFT_KEY,
  formatARS,
  formatPickupSchedule,
  PAYMENT_METHODS,
  readCheckoutDraft,
  saveCheckoutDraft,
  validateCheckoutForm,
  validateBuyerFields,
  validatePaymentSelection,
  validatePickupSelection,
} from '../src/utils/checkout.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const checkoutSource = fs.readFileSync(path.join(dirname, '../src/pages/tienda/CheckoutPage.jsx'), 'utf8')
const apiSource = fs.readFileSync(path.join(dirname, '../src/services/api.js'), 'utf8')
const layoutSource = fs.readFileSync(path.join(dirname, '../src/components/layout/StoreLayout.jsx'), 'utf8')
const form = {
  nombre: '  Ana María ',
  apellido: 'Pérez-López ',
  correo: ' ana@example.org ',
  telefono: '+54 9 11 5555-1234',
  observaciones: ' Dejar aviso al llegar. ',
}
const option = { id: 'real-pickup-id', tipo: 'PUNTO', seleccionId: 'PUNTO:real-pickup-id', disponibleParaSeleccionar: true }

test('payload CAR-02 contiene exclusivamente IDs reales y cantidad', () => {
  assert.deepEqual(buildCartValidationPayload([
    { productId: 'product-db-id', variantId: 'variant-db-id', quantity: 2, price: 123, name: 'no enviar' },
    { productId: 'product-db-id', variantId: 'variant-other', quantity: 1, attributes: [] },
  ]), {
    articulos: [
      { productoId: 'product-db-id', varianteId: 'variant-db-id', cantidad: 2 },
      { productoId: 'product-db-id', varianteId: 'variant-other', cantidad: 1 },
    ],
  })
})

test('identifica cambios de líneas y cantidades para invalidar una validación anterior', () => {
  const first = [{ productId: 'p1', variantId: 'v1', quantity: 1 }]
  assert.equal(cartFingerprint(first), cartFingerprint([{ ...first[0] }]))
  assert.notEqual(cartFingerprint(first), cartFingerprint([{ ...first[0], quantity: 2 }]))
  assert.notEqual(cartFingerprint(first), cartFingerprint([...first, { productId: 'p1', variantId: 'v2', quantity: 1 }]))
  assert.notEqual(cartFingerprint(first), cartFingerprint([]))
})

test('valida datos completos sin rechazar nombres acentuados ni teléfono argentino formateado', () => {
  assert.deepEqual(validateCheckoutForm(form, {
    pickupId: option.seleccionId, paymentMethod: 'MERCADO_PAGO', pickupOptions: [option],
  }), {})
})

test('requiere los cuatro campos de contacto y recorta espacios', () => {
  const errors = validateCheckoutForm({ nombre: '  ', apellido: '', correo: '', telefono: '' }, {
    pickupId: option.seleccionId, paymentMethod: 'TRANSFERENCIA', pickupOptions: [option],
  })
  assert.ok(errors.nombre)
  assert.ok(errors.apellido)
  assert.ok(errors.correo)
  assert.ok(errors.telefono)
})

test('rechaza correos inválidos y acepta una dirección con subdominio', () => {
  assert.ok(validateCheckoutForm({ ...form, correo: 'ana@' }, { pickupId: option.seleccionId, paymentMethod: 'MERCADO_PAGO', pickupOptions: [option] }).correo)
  assert.equal(validateCheckoutForm({ ...form, correo: 'ana@mail.example.org' }, { pickupId: option.seleccionId, paymentMethod: 'MERCADO_PAGO', pickupOptions: [option] }).correo, undefined)
})

test('rechaza teléfono con caracteres no telefónicos o longitud no razonable', () => {
  for (const telefono of ['1234567', '1234567890123456', '11-ABC-5555', '']) {
    assert.ok(validateCheckoutForm({ ...form, telefono }, { pickupId: option.seleccionId, paymentMethod: 'TRANSFERENCIA', pickupOptions: [option] }).telefono)
  }
  for (const telefono of ['011 4444-5555', '+54 (11) 4444 5555', '15-5555-5555']) {
    assert.equal(validateCheckoutForm({ ...form, telefono }, { pickupId: option.seleccionId, paymentMethod: 'TRANSFERENCIA', pickupOptions: [option] }).telefono, undefined)
  }
})

test('aplica límites de longitud sin exigir campos opcionales', () => {
  const base = { pickupId: option.seleccionId, paymentMethod: 'MERCADO_PAGO', pickupOptions: [option] }
  assert.ok(validateCheckoutForm({ ...form, nombre: 'n'.repeat(81) }, base).nombre)
  assert.ok(validateCheckoutForm({ ...form, apellido: 'a'.repeat(81) }, base).apellido)
  assert.ok(validateCheckoutForm({ ...form, correo: `${'a'.repeat(250)}@x.com` }, base).correo)
  assert.ok(validateCheckoutForm({ ...form, observaciones: 'x'.repeat(1001) }, base).observaciones)
  assert.equal(validateCheckoutForm({ ...form, observaciones: '' }, base).observaciones, undefined)
})

test('solo muestra opciones que el endpoint marca disponibles y con ID real', () => {
  const options = availablePickupOptions({
    puntosRetiro: [
      { id: 'enabled', nombre: 'Morón', disponibleParaSeleccionar: true },
      { id: 'disabled', nombre: 'Incompleto', disponibleParaSeleccionar: false },
      { nombre: 'Sin ID', disponibleParaSeleccionar: true },
    ],
    retirosEspeciales: [{ id: 'future-date', evento: 'VEGANPALUJA', fecha: '2026-11-01', lugar: 'Centro', disponibleParaSeleccionar: true }],
  })
  assert.deepEqual(options.map(({ seleccionId }) => seleccionId), ['PUNTO:enabled', 'ESPECIAL:future-date'])
})

test('acepta horarios habituales estructurados y conserva horarios heredados oficiales', () => {
  assert.equal(formatPickupSchedule({ tipo: 'PUNTO', horariosHabituales: [{ diaSemana: 'MARTES', horaInicio: '16:00', horaFin: '19:00' }] }), 'Martes: 16:00 a 19:00')
  assert.equal(formatPickupSchedule({ tipo: 'PUNTO', horarios: 'Viernes de 16 a 19 hs.', horariosHabituales: [] }), 'Viernes de 16 a 19 hs.')
})

test('representa la fecha y franja de un retiro especial sin inventarlas', () => {
  const label = formatPickupSchedule({ tipo: 'ESPECIAL', fecha: '2026-11-01T12:00:00Z', horaInicio: '12:00', horaFin: '16:00' })
  assert.match(label, /12:00 a 16:00/)
  assert.doesNotMatch(label, /domingo|cada mes/i)
})

test('no permite continuar sin una opción habilitada seleccionada', () => {
  const errors = validateCheckoutForm(form, { pickupId: '', paymentMethod: 'MERCADO_PAGO', pickupOptions: [] })
  assert.ok(errors.retiro)
})

test('el wizard valida los datos y el retiro por etapa, y exige pago en la última etapa', () => {
  assert.deepEqual(validateBuyerFields(form), {})
  assert.ok(validateBuyerFields({ ...form, correo: '' }).correo)
  assert.ok(validatePickupSelection('', [option]).retiro)
  assert.deepEqual(validatePickupSelection(option.seleccionId, [option]), {})
  assert.ok(validatePaymentSelection('').metodoPago)
  assert.deepEqual(validatePaymentSelection('TRANSFERENCIA'), {})
})

test('CheckoutPage presenta tres etapas navegables y solo muestra el bloque del paso activo', () => {
  assert.match(checkoutSource, /\['Tus datos', 'Retiro', 'Pago'\]/)
  assert.match(checkoutSource, /step === 0 &&/)
  assert.match(checkoutSource, /step === 1 &&/)
  assert.match(checkoutSource, /step === 2 &&/)
  assert.match(checkoutSource, /onClick=\{\(\) => goToStep\(step - 1\)\}/)
  assert.match(checkoutSource, /validateBuyerFields\(form\)/)
  assert.match(checkoutSource, /validatePickupSelection\(pickupId, pickupOptions\)/)
  assert.match(checkoutSource, /validatePaymentSelection\(paymentMethod\)/)
})

test('métodos disponibles corresponden a los enums del modelo y no aceptan otros valores', () => {
  assert.deepEqual(PAYMENT_METHODS.map(({ id }) => id), ['MERCADO_PAGO', 'TRANSFERENCIA'])
  assert.ok(validateCheckoutForm(form, { pickupId: option.seleccionId, paymentMethod: '', pickupOptions: [option] }).metodoPago)
  assert.ok(validateCheckoutForm(form, { pickupId: option.seleccionId, paymentMethod: 'TARJETA', pickupOptions: [option] }).metodoPago)
})

test('formatea importes oficiales y no presenta importes inválidos', () => {
  assert.equal(formatARS('45000.00'), '$\u00a045.000,00')
  assert.equal(formatARS('no-validado'), '—')
})

test('conserva el borrador de checkout en sessionStorage y valida su forma al leerlo', () => {
  const data = new Map()
  const storage = { getItem: (key) => data.get(key) || null, setItem: (key, value) => data.set(key, value) }
  const draft = { form, pickupId: option.seleccionId, paymentMethod: 'TRANSFERENCIA' }
  assert.equal(saveCheckoutDraft(draft, storage), true)
  assert.deepEqual(readCheckoutDraft(storage), draft)
  data.set(CHECKOUT_DRAFT_KEY, '{broken')
  assert.equal(readCheckoutDraft(storage), null)
  assert.equal(saveCheckoutDraft(draft, { setItem() { throw new Error('blocked') } }), false)
})

test('la API consulta opciones reales y envía solo el contrato de CAR-02', () => {
  assert.match(apiSource, /getPickupOptions\s*=\s*\(\)\s*=>\s*apiRequest\('\/pickup-options'\)/)
  assert.match(apiSource, /validateStoreCart\s*=.*apiRequest\('\/cart\/validate'/s)
  assert.match(apiSource, /buildCartValidationPayload\(cartItems\)/)
})

test('checkout muestra precios únicamente tras validar y conserva errores 422 por artículo', () => {
  assert.match(checkoutSource, /line\.precioUnitario/)
  assert.match(checkoutSource, /officialValidation\?\.articulos/)
  assert.match(checkoutSource, /error\.status === 422/)
  assert.match(checkoutSource, /Revisá los artículos del carrito/)
  assert.match(checkoutSource, /Precio pendiente de validar con el servidor/)
})

test('falla de red impide pasar a revisión y el bloqueo evita doble solicitud', () => {
  assert.match(checkoutSource, /validationLock\.current \|\| isValidating/)
  assert.match(checkoutSource, /validationLock\.current = true/)
  assert.match(checkoutSource, /validationLock\.current = false/)
  assert.match(checkoutSource, /No pudimos validar el carrito/)
  assert.match(checkoutSource, /setStage\('review'\)/)
})

test('el checkout vuelve al carrito y StoreLayout vuelve a abrir el panel', () => {
  assert.match(checkoutSource, /const cartLink = '\/tienda\?carrito=abierto'/)
  assert.match(checkoutSource, /Volver al carrito/)
  assert.match(layoutSource, /params\.get\('carrito'\) === 'abierto'/)
  assert.match(layoutSource, /setIsCartOpen\(true\)/)
})

test('resumen identifica variantes distintas y ofrece estado vacío', () => {
  assert.match(checkoutSource, /productId\}:\$\{item\.variantId/)
  assert.match(checkoutSource, /Tu carrito está vacío/)
  assert.match(checkoutSource, /item\.attributes/)
})

test('controles del formulario incluyen etiquetas, errores accesibles y layout responsive', () => {
  for (const field of ['checkout-nombre', 'checkout-apellido', 'checkout-correo', 'checkout-telefono', 'checkout-observaciones']) {
    assert.match(checkoutSource, new RegExp(`htmlFor="${field}"`))
  }
  assert.match(checkoutSource, /aria-invalid=/)
  assert.match(checkoutSource, /role="alert"/)
  assert.match(checkoutSource, /lg:grid-cols-\[minmax\(0,1fr\)_360px\]/)
  assert.match(checkoutSource, /flex-col-reverse/)
})

test('checkout no crea órdenes, no limpia el carrito ni simula una compra o cobro exitoso', () => {
  assert.doesNotMatch(checkoutSource, /createStoreOrder|clearStoreCart|window\.location\.assign\(.*pedido/)
  assert.match(checkoutSource, /No se creó ningún pedido ni se inició ningún cobro/)
  assert.match(checkoutSource, /no reserva unidades/)
})
