import { getAdminAuth, logoutAdmin } from './auth'
import { buildCartValidationPayload } from '../utils/checkout'

const configuredApiUrl = import.meta.env.VITE_API_URL || 'https://api.ollavegana.org'
const apiOrigin = configuredApiUrl.replace(/\/+$/, '').replace(/\/api$/, '')
export const API_BASE_URL = `${apiOrigin}/api`

export async function apiRequest(path, options = {}) {
  const { protected: requiresAuth = false, accessToken, ...requestOptions } = options
  const headers = new Headers(requestOptions.headers)
  const isFormData = typeof FormData !== 'undefined' && requestOptions.body instanceof FormData
  if (requestOptions.body && !isFormData && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  } else if (requiresAuth) {
    const auth = getAdminAuth()
    if (!auth) {
      logoutAdmin()
      if (window.location.pathname !== '/login') window.location.replace('/login')
      const error = new Error('Iniciá sesión para continuar.')
      error.status = 401
      throw error
    }
    headers.set('Authorization', `Bearer ${auth.token}`)
  }

  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...requestOptions,
      headers,
      credentials: 'omit',
      cache: requiresAuth ? 'no-store' : requestOptions.cache
    })
  } catch {
    throw new Error('No pudimos conectarnos con el servidor.')
  }

  if (requiresAuth && (response.status === 401 || response.status === 403)) {
    logoutAdmin()
    if (window.location.pathname !== '/login') window.location.replace('/login')
    const error = new Error('Tu sesión venció. Volvé a iniciar sesión.')
    error.status = 401
    throw error
  }

  let data = null
  if (response.status !== 204) {
    try {
      data = await response.json()
    } catch {
      throw new Error('El servidor devolvió una respuesta inválida.')
    }
  }
  if (!response.ok) {
    const error = new Error(response.status === 403
      ? (data?.error || 'Tu cuenta no tiene permiso para realizar esta operación.')
      : (data?.error || 'No pudimos completar la solicitud.'))
    error.status = response.status
    error.response = data
    throw error
  }
  return data
}

export const getProducts = (category) => apiRequest(`/products${category ? `?categoria=${encodeURIComponent(category)}` : ''}`)
export const getProduct = (slug) => apiRequest(`/products/${encodeURIComponent(slug)}`)
export const getCategories = () => apiRequest('/categories')
export const getStoreBanners = () => apiRequest('/banners')
export const getAdminBanners = () => apiRequest('/admin/banners', { protected: true })
export const saveAdminBanners = (config, files) => {
  const body = new FormData()
  body.append('config', JSON.stringify(config))
  files.forEach((file) => body.append('imagenes', file))
  return apiRequest('/admin/banners', { method: 'PUT', body, protected: true })
}
export const getPickupOptions = () => apiRequest('/pickup-options')
export const getAdminPickups = () => apiRequest('/admin/pickups', { protected: true })
export const getAdminPickupPoint = (id) => apiRequest(`/admin/pickups/points/${encodeURIComponent(id)}`, { protected: true })
export const createAdminPickupPoint = (pickup) => apiRequest('/admin/pickups/points', { method: 'POST', body: JSON.stringify(pickup), protected: true })
export const updateAdminPickupPoint = (id, pickup) => apiRequest(`/admin/pickups/points/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(pickup), protected: true })
export const getAdminPickupEvent = (id) => apiRequest(`/admin/pickups/events/${encodeURIComponent(id)}`, { protected: true })
export const createAdminPickupEvent = (event) => apiRequest('/admin/pickups/events', { method: 'POST', body: JSON.stringify(event), protected: true })
export const updateAdminPickupEvent = (id, event) => apiRequest(`/admin/pickups/events/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(event), protected: true })
export const getTransferInstructions = (orderId, accessToken, options = {}) => apiRequest(
  `/orders/${encodeURIComponent(orderId)}/transfer-instructions`,
  { ...options, accessToken }
)
export const validateStoreCart = (cartItems) => apiRequest('/cart/validate', {
  method: 'POST', body: JSON.stringify(buildCartValidationPayload(cartItems))
})
export const getAdminProducts = () => apiRequest('/admin/products?limit=100', { protected: true })
export const getAdminAttributes = () => apiRequest('/admin/attributes', { protected: true })
export const createAdminAttribute = (input) => apiRequest('/admin/attributes', { method: 'POST', body: JSON.stringify(input), protected: true })
export const updateAdminAttribute = (id, input) => apiRequest(`/admin/attributes/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input), protected: true })
export const createAdminAttributeValue = (attributeId, input) => apiRequest(`/admin/attributes/${encodeURIComponent(attributeId)}/values`, { method: 'POST', body: JSON.stringify(input), protected: true })
export const updateAdminAttributeValue = (id, input) => apiRequest(`/admin/attribute-values/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input), protected: true })
export const getAdminVariants = (productId) => apiRequest(`/admin/products/${encodeURIComponent(productId)}/variants`, { protected: true })
export const createAdminVariant = (productId, variant) => apiRequest(`/admin/products/${encodeURIComponent(productId)}/variants`, { method: 'POST', body: JSON.stringify(variant), protected: true })
export const updateAdminVariant = (productId, variantId, changes) => apiRequest(`/admin/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}`, { method: 'PATCH', body: JSON.stringify(changes), protected: true })
export const getAdminStock = (filters = {}, options = {}) => {
  const query = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => { if (value !== undefined && value !== null && value !== '') query.set(key, String(value)) })
  return apiRequest(`/admin/stock${query.size ? `?${query}` : ''}`, { ...options, protected: true })
}
export const adjustAdminStock = (variantId, adjustment) => apiRequest(`/admin/stock/${encodeURIComponent(variantId)}/adjustments`, { method: 'POST', body: JSON.stringify(adjustment), protected: true })
export const getAdminStockMovements = (variantId, filters = {}) => {
  const query = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => { if (value !== undefined && value !== null && value !== '') query.set(key, String(value)) })
  return apiRequest(`/admin/stock/${encodeURIComponent(variantId)}/movements${query.size ? `?${query}` : ''}`, { protected: true })
}
export const getAdminDashboardSummary = (period, options = {}) => apiRequest(
  `/admin/dashboard/summary?period=${encodeURIComponent(period)}`,
  { ...options, protected: true }
)
export const getAdminOrders = (filters = {}, options = {}) => {
  const query = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => { if (value !== undefined && value !== null && value !== '') query.set(key, String(value)) })
  return apiRequest(`/admin/orders${query.size ? `?${query}` : ''}`, { ...options, protected: true })
}
export const getAdminOrder = (orderId, options = {}) => apiRequest(`/admin/orders/${encodeURIComponent(orderId)}`, { ...options, protected: true })
export const updateAdminOrderStatus = (orderId, changes) => apiRequest(`/admin/orders/${encodeURIComponent(orderId)}/status`, { method: 'PATCH', body: JSON.stringify(changes), protected: true })
export const confirmAdminTransfer = (orderId, confirmation, idempotencyKey) => apiRequest(
  `/admin/orders/${encodeURIComponent(orderId)}/transfer-confirmation`,
  { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey }, body: JSON.stringify(confirmation), protected: true }
)
export const createAdminProduct = (product) => apiRequest('/admin/products', { method: 'POST', body: JSON.stringify(product), protected: true })
export const updateAdminProduct = (id, product) => apiRequest(`/admin/products/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(product), protected: true })
export const setAdminProductVisibility = (id, activo) => apiRequest(`/admin/products/${encodeURIComponent(id)}/visibility`, { method: 'PATCH', body: JSON.stringify({ activo }), protected: true })
export const uploadAdminProductImages = (productId, files, variantIds = []) => {
  const body = new FormData()
  files.forEach((file) => body.append('imagenes', file))
  body.append('varianteIds', JSON.stringify(variantIds))
  return apiRequest(`/admin/products/${encodeURIComponent(productId)}/images`, { method: 'POST', body, protected: true })
}
export const assignAdminProductImage = (productId, imageId, varianteId) => apiRequest(
  `/admin/products/${encodeURIComponent(productId)}/images/${encodeURIComponent(imageId)}`,
  { method: 'PATCH', body: JSON.stringify({ varianteId }), protected: true }
)
