import test from 'node:test'
import assert from 'node:assert/strict'
import { getAdminAuth, loginAdmin, logoutAdmin } from '../src/services/auth.js'

function makeJwt(exp = Math.floor(Date.now() / 1000) + 3600) {
  const payload = Buffer.from(JSON.stringify({ exp })).toString('base64url')
  return `header.${payload}.signature`
}

function response(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, async json() { return body } }
}

test('login guarda el JWT en localStorage y el perfil administrativo', async () => {
  const originalFetch = globalThis.fetch
  const originalWindow = globalThis.window
  const originalStorage = globalThis.localStorage
  const stored = new Map()
  globalThis.localStorage = {
    getItem: (key) => stored.get(key) || null,
    setItem: (key, value) => stored.set(key, value),
    removeItem: (key) => stored.delete(key),
  }
  globalThis.window = { localStorage: globalThis.localStorage }
  let request
  globalThis.fetch = async (url, options) => {
    request = { url, options }
    return response({ token: makeJwt(), admin: { id: 'admin-1', correo: 'admin@example.test' } })
  }
  try {
    const auth = await loginAdmin('admin@example.test', 'password-test')
    assert.match(request.url, /\/api\/auth\/login$/)
    assert.equal(request.options.credentials, undefined)
    assert.equal(auth.admin.id, 'admin-1')
    assert.equal(JSON.parse(stored.get('olla-vegana-admin-auth')).token, auth.token)
    assert.equal(getAdminAuth().admin.correo, 'admin@example.test')
  } finally {
    globalThis.fetch = originalFetch
    globalThis.window = originalWindow
    globalThis.localStorage = originalStorage
  }
})

test('token vencido se elimina y las rutas protegidas pueden detectar la sesión ausente', async () => {
  const originalWindow = globalThis.window
  const originalStorage = globalThis.localStorage
  const stored = new Map([['olla-vegana-admin-auth', JSON.stringify({ token: makeJwt(1), admin: { id: 'admin-1' } })]])
  globalThis.localStorage = { getItem: (key) => stored.get(key), removeItem: (key) => stored.delete(key) }
  globalThis.window = { localStorage: globalThis.localStorage }
  try {
    assert.equal(getAdminAuth(), null)
    assert.equal(stored.has('olla-vegana-admin-auth'), false)
  } finally { globalThis.window = originalWindow; globalThis.localStorage = originalStorage }
})

test('logout elimina el JWT local sin llamar un endpoint de revocación', async () => {
  const originalWindow = globalThis.window
  const originalStorage = globalThis.localStorage
  const originalFetch = globalThis.fetch
  const stored = new Map([['olla-vegana-admin-auth', JSON.stringify({ token: makeJwt(), admin: { id: 'admin-1' } })]])
  globalThis.localStorage = { getItem: (key) => stored.get(key), removeItem: (key) => stored.delete(key) }
  globalThis.window = { localStorage: globalThis.localStorage }
  let requests = 0
  globalThis.fetch = async () => { requests += 1 }
  try {
    logoutAdmin()
    assert.equal(stored.has('olla-vegana-admin-auth'), false)
    assert.equal(requests, 0)
  } finally {
    globalThis.window = originalWindow
    globalThis.localStorage = originalStorage
    globalThis.fetch = originalFetch
  }
})

test('credenciales erróneas no persisten ningún token', async () => {
  const originalWindow = globalThis.window
  const originalStorage = globalThis.localStorage
  const originalFetch = globalThis.fetch
  const stored = new Map()
  globalThis.localStorage = { getItem: (key) => stored.get(key) || null, setItem: (key, value) => stored.set(key, value), removeItem: (key) => stored.delete(key) }
  globalThis.window = { localStorage: globalThis.localStorage }
  globalThis.fetch = async () => response({ error: 'Credenciales incorrectas' }, 401)
  try {
    await assert.rejects(loginAdmin('admin@example.test', 'wrong'), /Credenciales incorrectas/)
    assert.equal(stored.has('olla-vegana-admin-auth'), false)
  } finally {
    globalThis.window = originalWindow
    globalThis.localStorage = originalStorage
    globalThis.fetch = originalFetch
  }
})
