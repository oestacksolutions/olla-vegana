export const FILTER_DEFAULTS = Object.freeze({
  buscar: '',
  categoria: '',
  disponibilidad: 'todas',
  orden: 'destacados',
})
export const CATALOG_FILTERS_UPDATED_EVENT = 'olla-vegana:catalog-filters-updated'

export function parseCatalogFilters(search = '') {
  const params = new URLSearchParams(search)
  const disponibilidad = ['disponibles', 'agotados'].includes(params.get('disponibilidad'))
    ? params.get('disponibilidad')
    : FILTER_DEFAULTS.disponibilidad
  const orden = ['nombre-asc', 'nombre-desc', 'precio-asc', 'precio-desc'].includes(params.get('orden'))
    ? params.get('orden')
    : FILTER_DEFAULTS.orden
  return {
    buscar: (params.get('buscar') || '').trim(),
    categoria: (params.get('categoria') || '').trim(),
    disponibilidad,
    orden,
  }
}

export function catalogFilterSearch(filters) {
  const params = new URLSearchParams()
  if (filters.buscar?.trim()) params.set('buscar', filters.buscar.trim())
  if (filters.categoria) params.set('categoria', filters.categoria)
  if (filters.disponibilidad && filters.disponibilidad !== FILTER_DEFAULTS.disponibilidad) {
    params.set('disponibilidad', filters.disponibilidad)
  }
  if (filters.orden && filters.orden !== FILTER_DEFAULTS.orden) params.set('orden', filters.orden)
  const query = params.toString()
  return query ? `?${query}` : ''
}

export function catalogListingUrl(filters = {}, { buscar = filters.buscar } = {}) {
  return `/tienda/productos${catalogFilterSearch({ ...FILTER_DEFAULTS, ...filters, buscar })}`
}

export function parseMoney(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(typeof value?.toString === 'function' ? value.toString() : value)
  return Number.isFinite(number) && number >= 0 ? number : null
}

export function formatARS(value) {
  const amount = parseMoney(value)
  if (amount === null) return ''
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 2,
  }).format(amount)
}

export function priceForVariant(variant, basePrice) {
  if (variant?.precio !== null && variant?.precio !== undefined && variant?.precio !== '') {
    return parseMoney(variant.precio)
  }
  return parseMoney(basePrice)
}

export function variantAttributes(variant) {
  return Object.fromEntries((variant?.valores || [])
    .filter((item) => item?.atributo && item?.valor)
    .map(({ atributo, valor }) => [String(atributo), String(valor)]))
}

export function attributeGroups(variants = []) {
  const groups = new Map()
  for (const variant of variants) {
    for (const [attribute, value] of Object.entries(variantAttributes(variant))) {
      if (!groups.has(attribute)) groups.set(attribute, new Set())
      groups.get(attribute).add(value)
    }
  }
  return [...groups].map(([nombre, values]) => ({ nombre, valores: [...values] }))
}

export function variantStock(variant) {
  const stock = variant?.stockDisponible
  if (!Number.isSafeInteger(stock) || stock < 0 || typeof variant?.agotada !== 'boolean') return null
  if (variant.agotada !== (stock === 0)) return null
  return stock
}

export function variantIsAvailable(variant) {
  const stock = variantStock(variant)
  return stock !== null && stock > 0 && variant.agotada === false
}

export function canPurchaseVariant(variant, quantity, price) {
  const stock = variantStock(variant)
  return Boolean(variant?.id)
    && stock !== null
    && stock > 0
    && Number.isSafeInteger(quantity)
    && quantity > 0
    && quantity <= stock
    && parseMoney(price) !== null
}

export function directCardVariant(product) {
  const variant = product?.varianteDirecta
  if (!variant?.id || !Number.isSafeInteger(variant.stockDisponible) || variant.stockDisponible < 1 || variant.agotada !== false) return null
  const price = variant.precio !== null && variant.precio !== undefined && variant.precio !== ''
    ? parseMoney(variant.precio)
    : parseMoney(product.price)
  return price === null ? null : { ...variant, price }
}

export function variantSelection(variant) {
  return variantAttributes(variant)
}

export function initialVariant(variants = []) {
  const hasAttributeVariants = variants.some((variant) => Object.keys(variantAttributes(variant)).length > 0)
  const candidates = hasAttributeVariants
    ? variants.filter((variant) => Object.keys(variantAttributes(variant)).length > 0)
    : variants
  const selected = candidates.find(variantIsAvailable) || candidates[0] || null
  return selected ? { variant: selected, selection: variantSelection(selected) } : { variant: null, selection: {} }
}

export function findVariantForSelection(variants = [], selection = {}) {
  const groups = attributeGroups(variants).map(({ nombre }) => nombre)
  if (groups.length === 0) return variants.length === 1 && Object.keys(variantAttributes(variants[0])).length === 0 ? variants[0] : null
  if (groups.some((name) => !selection[name]) || Object.keys(selection).length !== groups.length) return null
  return variants.find((variant) => {
    const attributes = variantAttributes(variant)
    return groups.every((name) => attributes[name] === selection[name])
      && Object.keys(attributes).length === groups.length
  }) || null
}

export function matchingVariants(variants = [], selection = {}) {
  return variants.filter((variant) => {
    const attributes = variantAttributes(variant)
    return Object.entries(selection).every(([name, value]) => attributes[name] === value)
  })
}

export function optionHasCombination(variants, selection, attribute, value) {
  return matchingVariants(variants, { ...selection, [attribute]: value }).length > 0
}

export function selectVariantOption(variants, selection, attribute, value) {
  const candidates = variants.filter((variant) => variantAttributes(variant)[attribute] === value)
  if (!candidates.length) return { variant: null, selection }
  const retainsOtherSelections = (variant) => {
    const attributes = variantAttributes(variant)
    return Object.entries(selection).every(([key, selected]) => key === attribute || attributes[key] === selected)
  }
  const matchingCurrent = candidates.filter(retainsOtherSelections)
  const chosen = matchingCurrent.find(variantIsAvailable)
    || matchingCurrent[0]
    || candidates.find(variantIsAvailable)
    || candidates[0]
  return { variant: chosen, selection: variantSelection(chosen) }
}

export function variantLabel(variant) {
  return Object.entries(variantAttributes(variant)).map(([attribute, value]) => `${attribute}: ${value}`).join(' · ')
}

export function orderedImages(images = []) {
  return images.filter((image) => image?.url).slice().sort((left, right) => {
    const positionDifference = (Number(left.posicion) || 0) - (Number(right.posicion) || 0)
    return positionDifference || String(left.id).localeCompare(String(right.id))
  })
}

export function primaryImage(images = []) {
  const ordered = orderedImages(images)
  return ordered.find((image) => image.esPrincipal === true) || ordered[0] || null
}

export function imageForVariant(images = [], variantId) {
  const variant = typeof variantId === 'object' ? variantId : null
  const id = variant ? variant.id : variantId
  return orderedImages(images).find((image) => {
    if (id && String(image.varianteId || '') === String(id)) return true
    if (!variant || !Array.isArray(image.valores) || image.valores.length === 0) return false
    const selectedValues = new Map((variant.valores || []).map(({ atributo, valor }) => [atributo, valor]))
    return image.valores.every(({ atributo, valor }) => selectedValues.get(atributo) === valor)
  }) || null
}

export function filterAndSortProducts(products = [], filters = FILTER_DEFAULTS) {
  const term = (filters.buscar || '').trim().toLocaleLowerCase('es-AR')
  const matching = products.filter((product) => {
    if (filters.categoria && product.category !== filters.categoria) return false
    if (term && !`${product.name || ''} ${product.description || ''}`.toLocaleLowerCase('es-AR').includes(term)) return false
    if (filters.disponibilidad === 'disponibles' && product.agotado !== false) return false
    if (filters.disponibilidad === 'agotados' && product.agotado !== true) return false
    return true
  })
  const sorters = {
    'nombre-asc': (a, b) => (a.name || '').localeCompare(b.name || '', 'es', { sensitivity: 'base' }),
    'nombre-desc': (a, b) => (b.name || '').localeCompare(a.name || '', 'es', { sensitivity: 'base' }),
    'precio-asc': (a, b) => (parseMoney(a.price) ?? Number.POSITIVE_INFINITY) - (parseMoney(b.price) ?? Number.POSITIVE_INFINITY),
    'precio-desc': (a, b) => (parseMoney(b.price) ?? Number.NEGATIVE_INFINITY) - (parseMoney(a.price) ?? Number.NEGATIVE_INFINITY),
  }
  return sorters[filters.orden] ? matching.sort(sorters[filters.orden]) : matching
}
