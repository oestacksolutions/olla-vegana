import { getAdminAuth, logoutAdmin } from './auth'
import { buildCartValidationPayload } from '../utils/checkout'

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

export async function apiRequest(path, options = {}) {
  const { protected: requiresAuth = false, accessToken, ...requestOptions } = options
  const headers = new Headers(requestOptions.headers)
  if (requestOptions.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

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
export const getPickupOptions = () => apiRequest('/pickup-options')
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
