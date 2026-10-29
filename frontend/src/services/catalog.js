import { getCategories, getProduct, getProducts } from './api'

function mapProductSummary(product, detail) {
  const source = detail || product
  const variants = source.variantes || []
  const firstVariant = variants[0]
  const image = source.imagenes?.[0]?.url
  return {
    id: source.slug || source.id,
    category: source.categoria?.slug,
    name: source.nombre,
    price: Number(source.precioBase || firstVariant?.precio || 0),
    image,
    alt: source.nombre,
    description: source.descripcion ? [source.descripcion] : [],
    colorVariants: variants.map((variant) => ({
      label: variant.valores?.map(({ valor }) => valor).join(' · ') || 'Variante',
      image: variant.imagen || source.imagenes?.find(({ varianteId }) => varianteId === variant.id)?.url || image,
      stock: variant.stockDisponible,
    })),
    variants,
  }
}

export async function fetchStoreProducts(category) {
  const summaries = await getProducts(category)
  const details = await Promise.all(summaries.map((product) => getProduct(product.slug)))
  return summaries.map((product, index) => mapProductSummary(product, details[index]))
}

export { getCategories }
