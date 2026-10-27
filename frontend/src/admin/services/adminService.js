import { mockOrders, mockProducts } from '../data/mockAdminData'

const STORAGE_KEY = 'olla-vegana-admin-mock'

function readState() {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

function writeState(state) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export async function getAdminSnapshot() {
  await Promise.resolve()
  const saved = readState()
  return {
    orders: saved.orders || mockOrders,
    products: saved.products || mockProducts,
    updatedAt: new Date().toISOString(),
  }
}

export async function updateMockOrder(orderId, updates) {
  const state = readState()
  const orders = state.orders || mockOrders
  const order = orders.find((item) => item.id === orderId)
  if (!order) throw new Error('No encontramos ese pedido.')
  const changes = []
  if (updates.status && updates.status !== order.status) changes.push(`Estado: ${updates.status}`)
  if (updates.notes !== undefined && updates.notes !== order.notes) changes.push('Observación interna actualizada')
  const updated = {
    ...order,
    ...updates,
    history: changes.length ? [...(order.history || []), `${changes.join(' · ')} · ${new Date().toLocaleString('es-AR')}`] : order.history,
    ...(updates.status === 'Retirado' ? { pickedUpAt: new Date().toISOString(), pickedUpBy: 'Administrador de demostración' } : {}),
  }
  state.orders = orders.map((item) => item.id === orderId ? updated : item)
  writeState(state)
  return updated
}

export async function saveMockProducts(products) {
  const state = readState()
  state.products = products
  writeState(state)
  return products
}
