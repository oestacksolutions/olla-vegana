import { logoutAdmin } from './auth'
import { buildCartValidationPayload } from '../utils/checkout'

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

export async function apiRequest(path, options = {}) {
  const { protected: requiresAuth = false, ...requestOptions } = options
  const headers = new Headers(requestOptions.headers)
  if (requestOptions.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

  const storedAuth = localStorage.getItem('olla-vegana-admin-auth')
  if (storedAuth) {
    try {
      const { token } = JSON.parse(storedAuth)
      if (token) headers.set('Authorization', ['Bearer', token].join(' '))
    } catch {
      if (requiresAuth) logoutAdmin()
    }
  }

  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...requestOptions, headers })
  } catch {
    throw new Error('No pudimos conectarnos con el servidor.')
  }

  if ((response.status === 401 || response.status === 403) && requiresAuth) {
    logoutAdmin()
    window.location.assign('/login')
    throw new Error('Tu sesión expiró. Volvé a iniciar sesión.')
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
    const error = new Error(data?.error || 'No pudimos completar la solicitud.')
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
export const validateStoreCart = (cartItems) => apiRequest('/cart/validate', {
  method: 'POST', body: JSON.stringify(buildCartValidationPayload(cartItems))
})
export const getAdminProducts = () => apiRequest('/admin/products?limit=100', { protected: true })
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
