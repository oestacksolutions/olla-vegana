import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  addStoreCartItem,
  adjustStoreCartItemQuantity,
  clearStoreCart,
  getStoreCart,
  getStoreCartItemCount,
  getStoreCartItemSubtotal,
  getStoreCartTotal,
  removeStoreCartItem,
  setStoreCartAvailability,
  updateStoreCartItemQuantity,
} from '../src/data/storeCart.js'

const storage = new Map()
let storageThrows = false
globalThis.window = {
  localStorage: {
    getItem: (key) => {
      if (storageThrows) throw new Error('blocked')
      return storage.get(key) ?? null
    },
    setItem: (key, value) => {
      if (storageThrows) throw new Error('blocked')
      storage.set(key, String(value))
    },
  },
  dispatchEvent: () => true,
}

const line = (overrides = {}) => ({
  productId: 'mongo-product-123',
  productSlug: 'remera-nadie-se-salva-solx',
  variantId: 'variant-123',
  name: 'Remera',
  attributes: [{ atributo: 'Talle', valor: 'L' }],
  variant: 'Talle: L',
  price: 45000,
  quantity: 1,
  stockDisponible: 10,
  availabilityStatus: 'available',
  image: '/real.jpg',
  ...overrides,
})

beforeEach(() => {
  storage.clear()
  storageThrows = false
})

test('guarda IDs reales, slug, atributos, precio, cantidad, stock e imagen', () => {
  assert.deepEqual(addStoreCartItem(line({ quantity: 2 })), { ok: true })
  assert.deepEqual(getStoreCart(), [line({ quantity: 2 })])
})

test('mantiene variantes distintas en líneas independientes aunque compartan etiqueta', () => {
  addStoreCartItem(line())
  addStoreCartItem(line({ variantId: 'variant-124', attributes: [{ atributo: 'Talle', valor: 'M' }] }))
  assert.deepEqual(getStoreCart().map(({ variantId }) => variantId), ['variant-123', 'variant-124'])
})

test('repetir la misma variante suma cantidades y no excede el stock disponible', () => {
  addStoreCartItem(line({ quantity: 2 }))
  assert.deepEqual(addStoreCartItem(line({ quantity: 3 })), { ok: true })
  assert.equal(getStoreCart()[0].quantity, 5)
  assert.deepEqual(addStoreCartItem(line({ quantity: 6 })), { ok: false, reason: 'insufficient-stock' })
  assert.equal(getStoreCart()[0].quantity, 5)
})

test('rechaza variante sin ID, agotada, stock desconocido, precio inválido y cantidades inválidas', () => {
  for (const item of [
    line({ variantId: '' }),
    line({ stockDisponible: 0 }),
    line({ stockDisponible: null }),
    line({ price: Number.NaN }),
    line({ quantity: 0 }),
    line({ quantity: -1 }),
    line({ quantity: 1.5 }),
  ]) assert.equal(addStoreCartItem(item).ok, false)
  assert.deepEqual(getStoreCart(), [])
})

test('actualiza y limita cantidades con enteros positivos', () => {
  addStoreCartItem(line({ quantity: 2 }))
  assert.equal(adjustStoreCartItemQuantity('mongo-product-123', 'variant-123', 1), true)
  assert.equal(getStoreCart()[0].quantity, 3)
  assert.equal(updateStoreCartItemQuantity('mongo-product-123', 'variant-123', 11), false)
  assert.equal(updateStoreCartItemQuantity('mongo-product-123', 'variant-123', 1.5), false)
  assert.equal(updateStoreCartItemQuantity('mongo-product-123', 'variant-123', 0), false)
  assert.equal(adjustStoreCartItemQuantity('mongo-product-123', 'variant-123', -1), true)
  assert.equal(getStoreCart()[0].quantity, 2)
})

test('no permite incrementar cantidades si disponibilidad es desconocida o variante agotada', () => {
  addStoreCartItem(line({ quantity: 2 }))
  assert.equal(setStoreCartAvailability('remera-nadie-se-salva-solx', 'variant-123', 'out-of-stock', 0), true)
  assert.equal(adjustStoreCartItemQuantity('mongo-product-123', 'variant-123', 1), false)
  assert.equal(adjustStoreCartItemQuantity('mongo-product-123', 'variant-123', -1), true)
  assert.equal(getStoreCart()[0].quantity, 1)
  assert.equal(setStoreCartAvailability('remera-nadie-se-salva-solx', 'variant-123', 'unknown'), true)
  assert.equal(adjustStoreCartItemQuantity('mongo-product-123', 'variant-123', 1), false)
  assert.equal(getStoreCart()[0].quantity, 1)
})

test('permite reducir una línea que quedó por encima del stock actualizado', () => {
  addStoreCartItem(line({ quantity: 5 }))
  setStoreCartAvailability('remera-nadie-se-salva-solx', 'variant-123', 'available', 2)
  assert.equal(adjustStoreCartItemQuantity('mongo-product-123', 'variant-123', -1), true)
  assert.equal(getStoreCart()[0].quantity, 4)
  assert.equal(adjustStoreCartItemQuantity('mongo-product-123', 'variant-123', 1), false)
})

test('quitar una variante no elimina otra del mismo producto', () => {
  addStoreCartItem(line())
  addStoreCartItem(line({ variantId: 'variant-124', attributes: [{ atributo: 'Talle', valor: 'M' }] }))
  removeStoreCartItem('mongo-product-123', undefined, 'Talle: L', 'variant-123')
  assert.deepEqual(getStoreCart().map(({ variantId }) => variantId), ['variant-124'])
})

test('calcula subtotal, total general y contador de unidades', () => {
  const first = line({ quantity: 2 })
  addStoreCartItem(first)
  addStoreCartItem(line({ variantId: 'variant-124', price: 27000, quantity: 3 }))
  assert.equal(getStoreCartItemSubtotal(first), 90000)
  assert.equal(getStoreCartTotal(), 171000)
  assert.equal(getStoreCartItemCount(), 5)
})

test('recupera de JSON corrupto y conserva líneas antiguas para revisar disponibilidad', () => {
  storage.set('olla-vegana-store-cart', '{malformed')
  assert.deepEqual(getStoreCart(), [])
  storage.set('olla-vegana-store-cart', JSON.stringify([line({ variantId: undefined, stockDisponible: undefined })]))
  const [legacy] = getStoreCart()
  assert.equal(legacy.availabilityStatus, 'unknown')
  assert.equal(legacy.productSlug, 'remera-nadie-se-salva-solx')
})

test('almacenamiento inaccesible no arroja errores ni afirma que agregó artículos', () => {
  storageThrows = true
  assert.deepEqual(getStoreCart(), [])
  assert.equal(addStoreCartItem(line()).reason, 'storage-unavailable')
  assert.equal(clearStoreCart(), false)
})

test('vacía el carrito sin dejar valores calculados inválidos', () => {
  addStoreCartItem(line())
  assert.equal(clearStoreCart(), true)
  assert.equal(getStoreCart().length, 0)
  assert.equal(getStoreCartTotal(), 0)
  assert.equal(getStoreCartItemCount(), 0)
})
