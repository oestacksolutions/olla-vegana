import { getCategories, getProducts } from './api'
import fallbackImage from '../assets/png/logo_olla_vegana.png'

function mapProductSummary(product) {
  const price = Number(product.precioBase)
  return {
    id: product.slug,
    category: product.categoria?.slug,
    name: product.nombre,
    price: Number.isFinite(price) ? price : 0,
    image: product.imagenPrincipal?.url || fallbackImage,
    alt: product.imagenPrincipal?.textoAlternativo || `Imagen de ${product.nombre} no disponible`,
    stockDisponible: product.disponibilidad?.stockDisponible ?? null,
    agotado: product.disponibilidad?.agotado ?? null,
  }
}

export async function fetchStoreProducts(category) {
  const summaries = await getProducts(category)
  return summaries.map(mapProductSummary)
}

export { getCategories }
