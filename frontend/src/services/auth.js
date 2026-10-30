const AUTH_STORAGE_KEY = 'olla-vegana-admin-auth'
const configuredApiUrl = import.meta.env.VITE_API_URL || 'https://api.ollavegana.org'
const apiOrigin = configuredApiUrl.replace(/\/+$/, '').replace(/\/api$/, '')
const API_BASE_URL = `${apiOrigin}/api`

async function postAuth(path, body) {
  let response
  try {
    response = await fetch(`${API_BASE_URL}/auth/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error('No pudimos conectarnos con el servidor. Intentá nuevamente en unos minutos.')
  }

  let data
  try {
    data = await response.json()
  } catch {
    throw new Error('La respuesta del servidor no es válida. Intentá nuevamente.')
  }

  if (!response.ok) throw new Error(data.error || 'No pudimos completar la solicitud. Intentá nuevamente.')
  return data
}

function readAuth() {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!stored) return null
    const auth = JSON.parse(stored)
    if (!auth?.token || isTokenExpired(auth.token)) {
      localStorage.removeItem(AUTH_STORAGE_KEY)
      return null
    }
    return auth
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY)
    return null
  }
}

function isTokenExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now()
  } catch {
    return true
  }
}

export async function loginAdmin(correo, contrasena) {
  const data = await postAuth('login', { correo, contrasena })

  const token = data.token || data.accessToken
  if (!token || isTokenExpired(token)) {
    throw new Error('No pudimos validar la sesión. Intentá nuevamente.')
  }

  const auth = { token, admin: data.admin || data.usuario || null }
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth))
  return auth
}

export async function requestPasswordReset(correo) {
  return postAuth('forgot-password', { correo })
}

export async function resetAdminPassword(token, contrasena) {
  return postAuth('reset-password', { token, nuevaContrasena: contrasena })
}

export function getAdminAuth() {
  return readAuth()
}

export function logoutAdmin() {
  localStorage.removeItem(AUTH_STORAGE_KEY)
}
