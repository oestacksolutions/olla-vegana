import { createAdminProduct, getAdminProducts, getCategories, setAdminProductVisibility, updateAdminProduct } from '../../services/api'
import { mockOrders } from '../data/mockAdminData'

let currentProducts = []

function mapVariant(variant) {
  return {
    label: variant.valores?.map(({ atributo, valor }) => `${atributo}: ${valor}`).join(' · ') || 'Variante',
    stock: Number(variant.stock ?? variant.stockDisponible ?? 0),
    id: variant.id,
    image: variant.imagen || null,
  }
}

function mapProduct(product) {
  const combinations = (product.variantes || []).map(mapVariant)
  return {
    id: product.id,
    name: product.nombre,
    category: product.categoria?.nombre || 'Sin categoría',
    price: Number(product.precioBase || product.variantes?.[0]?.precio || 0),
    stock: combinations.reduce((total, item) => total + item.stock, 0),
    status: product.activo === false ? 'Oculto' : 'Activo',
    featured: Boolean(product.destacado),
    description: product.descripcion || '',
    images: (product.imagenes || []).map((image) => ({ name: image.id, url: image.url })),
    combinations,
    variants: combinations.length,
    slug: product.slug,
    categoryId: product.categoriaId,
  }
}

export async function getAdminSnapshot() {
  const response = await getAdminProducts()
  currentProducts = (response.productos || []).map(mapProduct)
  return {
    orders: mockOrders,
    products: currentProducts,
    updatedAt: new Date().toISOString(),
  }
}

function toApiProduct(product, categoryId) {
  return {
    nombre: product.name.trim(),
    descripcion: product.description?.trim() || product.name.trim(),
    precioBase: String(product.price),
    categoriaId: categoryId || product.categoryId,
    destacado: Boolean(product.featured),
  }
}

export async function saveMockProducts(products) {
  const previousById = new Map(currentProducts.map((product) => [product.id, product]))
  const categories = await getCategories()
  const saved = []

  for (const product of products) {
    const previous = previousById.get(product.id)
    if (!previous) {
      const category = categories.find(({ nombre }) => nombre.toLowerCase() === product.category.toLowerCase())
      if (!category) throw new Error('La categoría seleccionada no existe en el catálogo.')
      const created = await createAdminProduct({
        ...toApiProduct(product, category.id),
        slug: product.slug || product.name.toLowerCase().trim().replace(/\s+/g, '-'),
        activo: product.status !== 'Oculto',
      })
      saved.push(mapProduct(created))
      continue
    }

    const changed = {}
    if (product.name !== previous.name) changed.nombre = product.name.trim()
    if (product.description !== previous.description) changed.descripcion = product.description?.trim() || product.name.trim()
    if (Number(product.price) !== Number(previous.price)) changed.precioBase = String(product.price)
    if (Boolean(product.featured) !== Boolean(previous.featured)) changed.destacado = Boolean(product.featured)
    if (Object.keys(changed).length) await updateAdminProduct(product.id, changed)
    if ((product.status === 'Oculto') !== (previous.status === 'Oculto')) await setAdminProductVisibility(product.id, product.status !== 'Oculto')
    saved.push({ ...previous, ...product })
  }

  currentProducts = saved
  return saved
}

export async function updateMockOrder(orderId, updates) {
  const order = mockOrders.find((item) => item.id === orderId)
  if (!order) throw new Error('No encontramos ese pedido.')
  return {
    ...order,
    ...updates,
    history: [...(order.history || []), `Actualizado: ${new Date().toLocaleString('es-AR')}`],
  }
}
