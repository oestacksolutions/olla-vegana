const CART_STORAGE_KEY = 'olla-vegana-store-cart'
export const CART_UPDATED_EVENT = 'olla-vegana:cart-updated'

export function getStoreCart() {
  try {
    const cart = JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) || '[]')
    return Array.isArray(cart) ? cart : []
  } catch {
    return []
  }
}

export function getStoreCartTotal() {
  return getStoreCart().reduce((total, item) => total + item.price * item.quantity, 0)
}

export function clearStoreCart() {
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify([]))
  window.dispatchEvent(new Event(CART_UPDATED_EVENT))
}

export function removeStoreCartItem(productId, size, variant, variantId) {
  const cart = getStoreCart().filter((item) =>
    !(item.productId === productId && (variantId
      ? item.variantId === variantId
      : item.size === size && item.variant === variant))
  )
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart))
  window.dispatchEvent(new Event(CART_UPDATED_EVENT))
}

export function addStoreCartItem(item) {
  const cart = getStoreCart()
  const quantity = Number.isSafeInteger(item.quantity) && item.quantity > 0 ? item.quantity : 1
  const existingItem = cart.find((cartItem) =>
    cartItem.productId === item.productId && (item.variantId
      ? cartItem.variantId === item.variantId
      : !cartItem.variantId && cartItem.size === item.size && cartItem.variant === item.variant)
  )

  if (existingItem) {
    existingItem.quantity += quantity
  } else {
    cart.push({ ...item, quantity })
  }

  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart))
  window.dispatchEvent(new Event(CART_UPDATED_EVENT))
}
