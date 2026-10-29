const CART_STORAGE_KEY = 'olla-vegana-store-cart'
export const CART_UPDATED_EVENT = 'olla-vegana:cart-updated'

function notifyCartUpdated() {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new Event(CART_UPDATED_EVENT))
  } catch {
    // El almacenamiento también se usa en pruebas y puede no tener Event del navegador.
  }
}

function saveCart(cart) {
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart))
    notifyCartUpdated()
    return true
  } catch {
    return false
  }
}

function validCartLine(item) {
  return item && typeof item === 'object'
    && typeof item.productId === 'string' && item.productId.trim()
    && typeof item.name === 'string'
    && Number.isFinite(Number(item.price)) && Number(item.price) >= 0
    && Number.isSafeInteger(item.quantity) && item.quantity > 0
}

export function getStoreCart() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) || '[]')
    if (!Array.isArray(stored)) return []
    return stored.filter(validCartLine).map((item) => {
      const hasKnownStock = Boolean(item.variantId && item.productSlug
        && Number.isSafeInteger(item.stockDisponible) && item.stockDisponible >= 0)
      const availabilityStatus = item.availabilityStatus || (hasKnownStock ? 'available' : 'unknown')
      return {
        ...item,
        price: Number(item.price),
        availabilityStatus: availabilityStatus === 'available' && !hasKnownStock ? 'unknown' : availabilityStatus,
        attributes: Array.isArray(item.attributes) ? item.attributes : [],
      }
    })
  } catch {
    return []
  }
}

export function getStoreCartTotal() {
  return getStoreCart().reduce((total, item) => total + Number(item.price) * item.quantity, 0)
}

export function getStoreCartItemCount() {
  return getStoreCart().reduce((count, item) => count + item.quantity, 0)
}

export function getStoreCartItemSubtotal(item) {
  const price = Number(item?.price)
  const quantity = item?.quantity
  return Number.isFinite(price) && price >= 0 && Number.isSafeInteger(quantity) && quantity > 0
    ? price * quantity
    : 0
}

export function clearStoreCart() {
  return saveCart([])
}

export function removeStoreCartItem(productId, size, variant, variantId) {
  const cart = getStoreCart().filter((item) =>
    !(item.productId === productId && (variantId
      ? item.variantId === variantId
      : item.size === size && item.variant === variant))
  )
  return saveCart(cart)
}

export function updateStoreCartItemQuantity(productId, variantId, quantity) {
  if (!Number.isSafeInteger(quantity) || quantity < 1 || !variantId) return false
  const cart = getStoreCart()
  const item = cart.find((line) => line.productId === productId && line.variantId === variantId)
  if (!item) return false
  if (quantity > item.quantity && (item.availabilityStatus !== 'available'
    || !Number.isSafeInteger(item.stockDisponible) || quantity > item.stockDisponible)) return false
  item.quantity = quantity
  return saveCart(cart)
}

export function adjustStoreCartItemQuantity(productId, variantId, difference) {
  if (!Number.isSafeInteger(difference) || difference === 0) return false
  const item = getStoreCart().find((line) => line.productId === productId && line.variantId === variantId)
  if (!item) return false
  return updateStoreCartItemQuantity(productId, variantId, item.quantity + difference)
}

export function setStoreCartAvailability(productSlug, variantId, status, stockDisponible = null) {
  const allowedStatuses = ['available', 'out-of-stock', 'unavailable', 'unknown']
  if (!allowedStatuses.includes(status)) return false
  const cart = getStoreCart()
  let changed = false
  for (const item of cart) {
    if ((item.productSlug || '') !== productSlug || (variantId && item.variantId !== variantId)) continue
    item.availabilityStatus = status
    item.stockDisponible = Number.isSafeInteger(stockDisponible) && stockDisponible >= 0
      ? stockDisponible
      : null
    changed = true
  }
  return changed ? saveCart(cart) : false
}

export function addStoreCartItem(item) {
  const quantity = item?.quantity
  const price = Number(item?.price)
  const stock = item?.stockDisponible
  if (!item || typeof item.productId !== 'string' || !item.productId.trim()
    || typeof item.variantId !== 'string' || !item.variantId.trim()
    || typeof item.productSlug !== 'string' || !item.productSlug.trim()
    || !Number.isFinite(price) || price < 0
    || !Number.isSafeInteger(quantity) || quantity < 1
    || !Number.isSafeInteger(stock) || stock < 1
    || quantity > stock) return { ok: false, reason: 'invalid-or-unavailable' }

  const cart = getStoreCart()
  const existingItem = cart.find((cartItem) =>
    cartItem.productId === item.productId && cartItem.variantId === item.variantId)
  const nextQuantity = (existingItem?.quantity || 0) + quantity
  if (nextQuantity > stock) return { ok: false, reason: 'insufficient-stock' }

  const cleanItem = {
    ...item,
    price,
    quantity,
    stockDisponible: stock,
    availabilityStatus: 'available',
    attributes: Array.isArray(item.attributes) ? item.attributes : [],
  }
  if (existingItem) Object.assign(existingItem, cleanItem, { quantity: nextQuantity })
  else cart.push(cleanItem)
  return saveCart(cart) ? { ok: true } : { ok: false, reason: 'storage-unavailable' }
}
