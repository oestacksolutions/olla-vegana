import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { addStoreCartItem, getStoreCart, removeStoreCartItem } from '../src/data/storeCart.js'

const storage = new Map()
globalThis.window = {
  localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
  },
  dispatchEvent: () => true,
}

beforeEach(() => storage.clear())

test('carrito local conserva IDs reales de producto y variante, slug, cantidad e imagen', () => {
  addStoreCartItem({ productId: 'mongo-product-123', productSlug: 'remera-nadie-se-salva-solx', variantId: 'variant-123', variant: 'Talle: L', quantity: 2, price: 45000, image: '/real.jpg' })
  assert.deepEqual(getStoreCart(), [{
    productId: 'mongo-product-123', productSlug: 'remera-nadie-se-salva-solx', variantId: 'variant-123', variant: 'Talle: L', quantity: 2, price: 45000, image: '/real.jpg',
  }])
})

test('reintentos locales suman cantidades solo a la misma variante estable', () => {
  addStoreCartItem({ productId: 'remera', variantId: 'v1', variant: 'Talle: M', quantity: 2 })
  addStoreCartItem({ productId: 'remera', variantId: 'v1', variant: 'Talle: M', quantity: 3 })
  addStoreCartItem({ productId: 'remera', variantId: 'v2', variant: 'Talle: M', quantity: 1 })
  assert.deepEqual(getStoreCart().map(({ variantId, quantity }) => [variantId, quantity]), [['v1', 5], ['v2', 1]])
})

test('remover por variantId no elimina otra variante con etiqueta similar', () => {
  addStoreCartItem({ productId: 'gorra', variantId: 'black', variant: 'Color: Negro' })
  addStoreCartItem({ productId: 'gorra', variantId: 'white', variant: 'Color: Negro' })
  removeStoreCartItem('gorra', undefined, 'Color: Negro', 'black')
  assert.deepEqual(getStoreCart().map((item) => item.variantId), ['white'])
})
