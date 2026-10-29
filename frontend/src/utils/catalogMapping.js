import { getLocalPrimaryProductImage } from '../data/localProductImages.js'

export function mapProductSummary(product) {
  const localImage = getLocalPrimaryProductImage(product.slug)
  const directPrice = product.varianteDirecta?.precio
  const parsedDirectPrice = directPrice !== null && directPrice !== undefined ? Number(directPrice) : NaN
  const basePrice = Number(product.precioBase)
  const price = Number.isFinite(parsedDirectPrice) && parsedDirectPrice >= 0
    ? parsedDirectPrice
    : basePrice
  return {
    id: product.id,
    slug: product.slug,
    category: product.categoria?.slug,
    name: product.nombre,
    price: Number.isFinite(price) ? price : 0,
    description: product.descripcion || '',
    image: product.imagenPrincipal?.url || localImage?.url || null,
    localImage: localImage?.url || null,
    localAlt: localImage?.textoAlternativo || '',
    alt: product.imagenPrincipal?.textoAlternativo || localImage?.textoAlternativo || `Imagen de ${product.nombre} no disponible`,
    stockDisponible: product.disponibilidad?.stockDisponible ?? null,
    agotado: product.disponibilidad?.agotado ?? null,
    varianteDirecta: product.varianteDirecta || null,
  }
}
