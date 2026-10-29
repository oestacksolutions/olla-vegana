import { logoutAdmin } from './auth'

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

export async function apiRequest(path, options = {}) {
  const { protected: requiresAuth = false, ...requestOptions } = options
  const headers = new Headers(requestOptions.headers)
  if (requestOptions.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

  const auth = localStorage.getItem('olla-vegana-admin-auth')
  if (auth) {
    try {
      const { token } = JSON.parse(auth)
      if (token) headers.set('Authorization', `Bearer ${token}`)
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
  if (!response.ok) throw new Error(data?.error || 'No pudimos completar la solicitud.')
  return data
}

export const getProducts = (category) => apiRequest(`/products${category ? `?categoria=${encodeURIComponent(category)}` : ''}`)
export const getProduct = (slug) => apiRequest(`/products/${encodeURIComponent(slug)}`)
export const getCategories = () => apiRequest('/categories')
export const getAdminProducts = () => apiRequest('/admin/products?limit=100', { protected: true })
export const createAdminProduct = (product) => apiRequest('/admin/products', { method: 'POST', body: JSON.stringify(product), protected: true })
export const updateAdminProduct = (id, product) => apiRequest(`/admin/products/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(product), protected: true })
export const setAdminProductVisibility = (id, activo) => apiRequest(`/admin/products/${encodeURIComponent(id)}/visibility`, { method: 'PATCH', body: JSON.stringify({ activo }), protected: true })
