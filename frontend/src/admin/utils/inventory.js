export function availabilityLabel(row, threshold = 5) {
  if (row?.inconsistente) return 'Revisar inventario'
  if (Number(row?.stockDisponible) <= 0) return 'Sin disponibilidad'
  if (Number(row.stockDisponible) <= threshold) return 'Stock bajo'
  return 'Disponible'
}

export function attributePairs(selectedValues = {}) {
  return Object.entries(selectedValues)
    .filter(([, valorAtributoId]) => typeof valorAtributoId === 'string' && valorAtributoId.length > 0)
    .map(([atributoId, valorAtributoId]) => ({ atributoId, valorAtributoId }))
}

export function summarizeValues(values = []) {
  return values.length ? values.map(({ atributo, valor }) => `${atributo}: ${valor}`).join(' · ') : 'Sin opciones'
}

export function formatAmount(value) {
  const amount = typeof value === 'string' ? value : value?.$numberDecimal
  if (typeof amount !== 'string' || !/^\d+(?:\.\d{1,2})?$/.test(amount)) return 'Precio no disponible'
  const [whole, fraction = ''] = amount.split('.')
  const formatted = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(BigInt(whole))
  return `$ ${formatted},${(fraction + '00').slice(0, 2)}`
}

export function isValidAdjustment(type, rawQuantity, reason) {
  if (!['INGRESO', 'AJUSTE'].includes(type) || typeof rawQuantity !== 'string' || !/^-?\d+$/.test(rawQuantity)) return false
  const quantity = Number(rawQuantity)
  if (!Number.isSafeInteger(quantity) || quantity === 0) return false
  if (type === 'INGRESO' && quantity < 1) return false
  return typeof reason === 'string' && reason.trim().length >= 3 && reason.trim().length <= 500
}
