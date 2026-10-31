const PREVIEW_PATH = /^\/__preview\/transferencia\/(pendiente|pagado|vencido|cancelado)$/

export function getTransferPreviewStatus(pathname, isDevelopment) {
  if (!isDevelopment || typeof pathname !== 'string') return null
  return PREVIEW_PATH.exec(pathname)?.[1] || null
}
