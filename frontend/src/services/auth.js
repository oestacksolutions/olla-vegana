const AUTH_STORAGE_KEY = 'olla-vegana-admin-auth'
const configuredApiUrl = import.meta.env?.VITE_API_URL || 'http://localhost:3001/api'
const API_URL = configuredApiUrl.replace(/\/$/, '').endsWith('/api')
  ? configuredApiUrl.replace(/\/$/, '')
  : `${configuredApiUrl.replace(/\/$/, '')}/api`

function getStorage() {
  try { return globalThis.localStorage || globalThis.window?.localStorage || null }
  catch { return null }
}

async function postAuth(path, body) {
  let response
  try {
    response = await fetch(`${API_URL}/auth/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error('No pudimos conectarnos con el servidor. Intentá nuevamente en unos minutos.')
  }

  let data
  try { data = await response.json() }
  catch { throw new Error('La respuesta del servidor no es válida. Intentá nuevamente.') }
  if (!response.ok) {
    const error = new Error(data?.error || 'No pudimos completar la solicitud. Intentá nuevamente.')
    error.status = response.status
    throw error
  }
  return data
}

function isTokenExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now()
  } catch {
    return true
  }
}

function readAuth() {
  try {
    const storage = getStorage()
    if (!storage) return null
    const stored = storage.getItem(AUTH_STORAGE_KEY)
    if (!stored) return null
    const auth = JSON.parse(stored)
    if (!auth?.token || isTokenExpired(auth.token)) {
      storage.removeItem(AUTH_STORAGE_KEY)
      return null
    }
    return auth
  } catch {
    try { getStorage()?.removeItem(AUTH_STORAGE_KEY) } catch { /* Storage puede estar deshabilitado. */ }
    return null
  }
}

export async function loginAdmin(correo, contrasena) {
  const data = await postAuth('login', { correo, contrasena })
  const token = data.token || data.accessToken
  if (!token || isTokenExpired(token)) throw new Error('No pudimos validar la sesión. Intentá nuevamente.')
  const auth = { token, admin: data.admin || data.usuario || null }
  try {
    const storage = getStorage()
    if (!storage) throw new Error('storage unavailable')
    storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth))
  }
  catch { throw new Error('El navegador no permite guardar la sesión. Habilitá el almacenamiento e intentá nuevamente.') }
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

// El JWT es bearer: eliminarlo del navegador cierra este cliente, pero no lo revoca
// en el servidor hasta su vencimiento. Los otros dispositivos no comparten este storage.
export function logoutAdmin() {
  try { getStorage()?.removeItem(AUTH_STORAGE_KEY) } catch { /* No hay token legible para conservar. */ }
}
