export function extractStoreProductSlug(pathname = '') {
  const normalized = pathname.replace(/\/+$/, '') || '/'
  const match = normalized.match(/^\/tienda\/([^/]+)$/)
  if (!match) return null
  try {
    const slug = decodeURIComponent(match[1])
    return slug && !slug.includes('/') ? slug : null
  } catch {
    return null
  }
}
