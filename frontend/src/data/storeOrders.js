const ORDERS_STORAGE_KEY = 'olla-vegana-store-orders'

export const ORDER_STATUSES = ['confirmed', 'pending', 'rejected', 'error']

function readOrders() {
  try {
    const orders = JSON.parse(window.localStorage.getItem(ORDERS_STORAGE_KEY) || '{}')
    return orders && typeof orders === 'object' ? orders : {}
  } catch {
    return {}
  }
}

export function getStoreOrder(orderId) {
  return readOrders()[orderId] || null
}

/** Búsqueda temporal local; la API deberá hacer esta validación en servidor. */
export function findStoreOrder(orderId, email) {
  const order = getStoreOrder(orderId.trim())
  if (!order || order.customer?.email?.trim().toLowerCase() !== email.trim().toLowerCase()) return null
  return order
}

function normalizeStatus(status) {
  return ORDER_STATUSES.includes(status) ? status : 'pending'
}

/** Mock temporal de la API. Reemplazar por POST /orders al integrar el backend. */
export async function createStoreOrder(orderData) {
  await Promise.resolve()
  const order = {
    ...orderData,
    id: `OV-${Date.now().toString(36).toUpperCase()}`,
    status: 'pending',
    createdAt: new Date().toISOString(),
  }
  const orders = readOrders()
  orders[order.id] = order
  window.localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders))
  return { ...order, status: normalizeStatus(order.status) }
}
