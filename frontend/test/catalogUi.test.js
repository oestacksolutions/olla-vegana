import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  attributeGroups,
  canPurchaseVariant,
  catalogFilterSearch,
  catalogListingUrl,
  directCardVariant,
  filterAndSortProducts,
  findVariantForSelection,
  imageForVariant,
  initialVariant,
  orderedImages,
  parseCatalogFilters,
  parseMoney,
  priceForVariant,
  primaryImage,
  selectVariantOption,
  variantStock,
} from '../src/utils/catalogUi.js'
import { extractStoreProductSlug } from '../src/utils/storeRoutes.js'
import { mapProductSummary } from '../src/utils/catalogMapping.js'
import { getLocalProductImages } from '../src/data/localProductImages.js'

const variants = [
  { id: 's-black', precio: null, stockDisponible: 3, agotada: false, valores: [{ atributo: 'Talle', valor: 'S' }, { atributo: 'Color', valor: 'Negro' }] },
  { id: 'm-white', precio: '52000.00', stockDisponible: 0, agotada: true, valores: [{ atributo: 'Color', valor: 'Blanco' }, { atributo: 'Talle', valor: 'M' }] },
  { id: 'm-black', precio: null, stockDisponible: 2, agotada: false, valores: [{ atributo: 'Talle', valor: 'M' }, { atributo: 'Color', valor: 'Negro' }] },
]

test('carga e interpreta valores Decimal128 serializados y rechaza precios inválidos', () => {
  assert.equal(parseMoney('45000.00'), 45000)
  assert.equal(parseMoney({ toString: () => '27000.50' }), 27000.5)
  assert.equal(parseMoney('-1'), null)
  assert.equal(parseMoney('no-es-precio'), null)
})

test('usa el precio específico de variante o el precio base cuando falta', () => {
  assert.equal(priceForVariant(variants[1], '45000.00'), 52000)
  assert.equal(priceForVariant(variants[0], '45000.00'), 45000)
  assert.equal(priceForVariant(variants[0], 'inválido'), null)
})

test('genera atributos de talle y color sin asumir nombres o códigos de color', () => {
  assert.deepEqual(attributeGroups(variants), [
    { nombre: 'Talle', valores: ['S', 'M'] },
    { nombre: 'Color', valores: ['Negro', 'Blanco'] },
  ])
})

test('acepta atributos de estampado y nombres futuros', () => {
  assert.deepEqual(attributeGroups([{ valores: [{ atributo: 'Estampado', valor: 'Flores' }, { atributo: 'Material', valor: 'Gabardina' }] }]), [
    { nombre: 'Estampado', valores: ['Flores'] },
    { nombre: 'Material', valores: ['Gabardina'] },
  ])
})

test('resuelve una combinación real independientemente del orden de sus valores', () => {
  assert.equal(findVariantForSelection(variants, { Talle: 'M', Color: 'Negro' }).id, 'm-black')
})

test('rechaza una combinación inexistente', () => {
  assert.equal(findVariantForSelection(variants, { Talle: 'S', Color: 'Blanco' }), null)
})

test('requiere completar todos los atributos antes de considerar una combinación válida', () => {
  assert.equal(findVariantForSelection(variants, { Talle: 'M' }), null)
})

test('la selección inicial se resuelve después de recibir las variantes y prioriza una disponible', () => {
  assert.equal(initialVariant(variants).variant.id, 's-black')
  assert.deepEqual(initialVariant(variants).selection, { Talle: 'S', Color: 'Negro' })
})

test('si todas las variantes están agotadas conserva una selección válida para mostrar Sin stock', () => {
  const agotadas = variants.map((variant) => ({ ...variant, stockDisponible: 0, agotada: true }))
  assert.equal(initialVariant(agotadas).variant.id, 's-black')
})

test('soporta un producto con una variante sin atributos', () => {
  const onlyVariant = [{ id: 'standard', stockDisponible: 4, agotada: false, valores: [] }]
  assert.equal(initialVariant(onlyVariant).variant.id, 'standard')
  assert.deepEqual(attributeGroups(onlyVariant), [])
  assert.equal(findVariantForSelection(onlyVariant, {}).id, 'standard')
})

test('cambiar un atributo ajusta los otros valores a una variante existente', () => {
  const next = selectVariantOption(variants, { Talle: 'S', Color: 'Negro' }, 'Talle', 'M')
  assert.equal(next.variant.id, 'm-black')
  assert.deepEqual(next.selection, { Color: 'Negro', Talle: 'M' })
})

test('detecta el stock disponible y marca como desconocida una respuesta inconsistente', () => {
  assert.equal(variantStock(variants[0]), 3)
  assert.equal(variantStock(variants[1]), 0)
  assert.equal(variantStock({ id: 'bad', stockDisponible: 0, agotada: false }), null)
  assert.equal(variantStock({ id: 'missing', agotada: false }), null)
})

test('bloquea compra sin variante, con agotado, cantidad superior o precio inválido', () => {
  assert.equal(canPurchaseVariant(null, 1, 100), false)
  assert.equal(canPurchaseVariant(variants[1], 1, 100), false)
  assert.equal(canPurchaseVariant(variants[0], 4, 100), false)
  assert.equal(canPurchaseVariant(variants[0], 1.5, 100), false)
  assert.equal(canPurchaseVariant(variants[0], 1, null), false)
})

test('permite comprar cantidad entera dentro del stock conocido', () => {
  assert.equal(canPurchaseVariant(variants[0], 3, 45000), true)
})

test('solo permite agregar directamente una variante única identificada, disponible y con precio válido', () => {
  assert.equal(directCardVariant({ price: 45000, varianteDirecta: { id: 'v1', precio: null, stockDisponible: 2, agotada: false } }).price, 45000)
  assert.equal(directCardVariant({ price: 45000, varianteDirecta: null }), null)
  assert.equal(directCardVariant({ price: 45000, varianteDirecta: { id: 'v1', stockDisponible: 0, agotada: true } }), null)
  assert.equal(directCardVariant({ price: 45000, varianteDirecta: { id: 'v1', stockDisponible: 2, agotada: false, precio: '-1' } }), null)
})

test('extrae correctamente el slug en navegación y acceso directo, y rechaza rutas inválidas', () => {
  assert.equal(extractStoreProductSlug('/tienda/remera-nadie-se-salva-solx'), 'remera-nadie-se-salva-solx')
  assert.equal(extractStoreProductSlug('/tienda/producto%20especial/'), 'producto especial')
  assert.equal(extractStoreProductSlug('/tienda/productos'), 'productos') // App resuelve el listado antes.
  assert.equal(extractStoreProductSlug('/tienda/productos/filtro'), null)
  assert.equal(extractStoreProductSlug('/tienda/%E0%A4%A'), null)
})

test('ordena imágenes por posición y utiliza la principal definida por administración', () => {
  const images = [
    { id: 'later', posicion: 2, url: '/later.jpg' },
    { id: 'primary', posicion: 3, url: '/main.jpg', esPrincipal: true },
    { id: 'first', posicion: 0, url: '/first.jpg' },
  ]
  assert.deepEqual(orderedImages(images).map((image) => image.id), ['first', 'later', 'primary'])
  assert.equal(primaryImage(images).id, 'primary')
})

test('usa la primera imagen como alternativa si no se declaró una principal', () => {
  assert.equal(primaryImage([{ id: 'second', posicion: 2, url: '/2.jpg' }, { id: 'first', posicion: 0, url: '/1.jpg' }]).id, 'first')
})

test('prioriza imagen asociada a la variante seleccionada', () => {
  const images = [{ id: 'general', url: '/main.jpg' }, { id: 'variant', url: '/black.jpg', varianteId: 'm-black' }]
  assert.equal(imageForVariant(images, 'm-black').id, 'variant')
  assert.equal(imageForVariant(images, 's-black'), null)
})

test('asocia las fotografías locales verificadas a los tres slugs reales y no inventa otras asociaciones', () => {
  const remera = getLocalProductImages('remera-nadie-se-salva-solx')
  const gorra = getLocalProductImages('gorra-olla-vegana')
  const tote = getLocalProductImages('tote-oficial-olla-vegana')
  assert.match(remera[0].url, /remeras\.jpg$/)
  assert.match(remera[1].url, /remera-frente\.jpg$/)
  assert.match(gorra[0].url, /gorra\.JPG$/)
  assert.deepEqual(gorra[0].valores, [{ atributo: 'Color', valor: 'Beige' }])
  assert.match(gorra[1].url, /gorra-negra\.JPG$/)
  assert.deepEqual(gorra[1].valores, [{ atributo: 'Color', valor: 'Negro' }])
  assert.match(tote[0].url, /tote\.JPG$/)
  assert.deepEqual(tote[0].valores, [{ atributo: 'Estampado', valor: 'Logo' }])
  assert.match(tote[1].url, /tote-flores\.JPG$/)
  assert.deepEqual(tote[1].valores, [{ atributo: 'Estampado', valor: 'Flores' }])
  assert.deepEqual(getLocalProductImages('producto-no-verificado'), [])
})

test('imágenes API tienen prioridad; las locales se usan si el API no devuelve galería', () => {
  const dirname = path.dirname(fileURLToPath(import.meta.url))
  const mappingSource = fs.readFileSync(path.join(dirname, '../src/utils/catalogMapping.js'), 'utf8')
  const detailSource = fs.readFileSync(path.join(dirname, '../src/pages/tienda/ProductDetailPage.jsx'), 'utf8')
  const gallerySource = fs.readFileSync(path.join(dirname, '../src/components/tienda/ProductGallery.jsx'), 'utf8')
  const summary = mapProductSummary({
    id: 'p1', slug: 'gorra-olla-vegana', nombre: 'Gorra', precioBase: 100,
    imagenPrincipal: { url: 'https://cdn.example/real.jpg', textoAlternativo: 'Imagen del API' },
  })
  assert.equal(summary.image, 'https://cdn.example/real.jpg')
  assert.match(mappingSource, /imagenPrincipal\?\.url \|\| localImage\?\.url/)
  assert.match(detailSource, /apiImages\.length \? apiImages : getLocalProductImages/)
  assert.match(gallerySource, /recoverImage\(event, localPrimary, primaryImage\(localFallbackImages\)/)
  assert.match(gallerySource, /image\.src = fallbackImage/)
})

test('imagen local de variante se resuelve por atributo aunque no tenga ID Mongo', () => {
  const gorraImages = getLocalProductImages('gorra-olla-vegana')
  const variant = { id: 'mongo-variant-2', valores: [{ atributo: 'Color', valor: 'Negro' }] }
  assert.equal(imageForVariant(gorraImages, variant).id, 'local-gorra-negra')
})

const productRows = [
  { id: 'a', name: 'Remera urbana', description: 'Algodón peinado', category: 'remeras', price: 45000, agotado: false },
  { id: 'b', name: 'Gorra Olla', description: 'Gabardina', category: 'gorras', price: 27000, agotado: true },
  { id: 'c', name: 'Tote oficial', description: 'Flores y logo', category: 'tote-bags', price: 27000, agotado: false },
]

test('busca por nombre sin distinguir mayúsculas', () => {
  assert.deepEqual(filterAndSortProducts(productRows, { buscar: 'REmera', categoria: '', disponibilidad: 'todas', orden: 'destacados' }).map((item) => item.id), ['a'])
})

test('busca por descripción cuando está disponible en el listado', () => {
  assert.deepEqual(filterAndSortProducts(productRows, { buscar: 'peinado', categoria: '', disponibilidad: 'todas', orden: 'destacados' }).map((item) => item.id), ['a'])
})

test('filtra categorías usando el slug real', () => {
  assert.deepEqual(filterAndSortProducts(productRows, { buscar: '', categoria: 'tote-bags', disponibilidad: 'todas', orden: 'destacados' }).map((item) => item.id), ['c'])
})

test('filtra disponibilidad y no trata disponibilidad desconocida como disponible', () => {
  assert.deepEqual(filterAndSortProducts([...productRows, { id: 'd', name: 'Sin dato', price: 1 }], { buscar: '', categoria: '', disponibilidad: 'disponibles', orden: 'destacados' }).map((item) => item.id), ['a', 'c'])
  assert.deepEqual(filterAndSortProducts(productRows, { buscar: '', categoria: '', disponibilidad: 'agotados', orden: 'destacados' }).map((item) => item.id), ['b'])
})

test('combina búsqueda, categoría y disponibilidad', () => {
  assert.deepEqual(filterAndSortProducts(productRows, { buscar: 'flores', categoria: 'tote-bags', disponibilidad: 'disponibles', orden: 'destacados' }).map((item) => item.id), ['c'])
})

test('ordena precios numéricamente de menor a mayor', () => {
  assert.deepEqual(filterAndSortProducts(productRows, { buscar: '', categoria: '', disponibilidad: 'todas', orden: 'precio-asc' }).map((item) => item.id), ['b', 'c', 'a'])
})

test('ordena precios numéricamente de mayor a menor', () => {
  assert.deepEqual(filterAndSortProducts(productRows, { buscar: '', categoria: '', disponibilidad: 'todas', orden: 'precio-desc' }).map((item) => item.id), ['a', 'b', 'c'])
})

test('ordena nombres A-Z y Z-A', () => {
  assert.deepEqual(filterAndSortProducts(productRows, { buscar: '', categoria: '', disponibilidad: 'todas', orden: 'nombre-asc' }).map((item) => item.id), ['b', 'a', 'c'])
  assert.deepEqual(filterAndSortProducts(productRows, { buscar: '', categoria: '', disponibilidad: 'todas', orden: 'nombre-desc' }).map((item) => item.id), ['c', 'a', 'b'])
})

test('lee los filtros de la URL y descarta opciones desconocidas', () => {
  assert.deepEqual(parseCatalogFilters('?buscar=remera&categoria=tote-bags&disponibilidad=agotados&orden=precio-desc'), {
    buscar: 'remera', categoria: 'tote-bags', disponibilidad: 'agotados', orden: 'precio-desc',
  })
  assert.equal(parseCatalogFilters('?disponibilidad=unknown&orden=unknown').disponibilidad, 'todas')
})

test('serializa filtros combinados en URL sin reiniciar otros criterios', () => {
  const query = catalogFilterSearch({ buscar: 'gorra', categoria: 'gorras', disponibilidad: 'disponibles', orden: 'precio-asc' })
  assert.deepEqual(parseCatalogFilters(query), { buscar: 'gorra', categoria: 'gorras', disponibilidad: 'disponibles', orden: 'precio-asc' })
})

test('la búsqueda desde navegación conduce al listado y conserva categoría, disponibilidad y orden', () => {
  assert.equal(catalogListingUrl({ buscar: '', categoria: 'remeras', disponibilidad: 'agotados', orden: 'nombre-asc' }, { buscar: 'solx' }), '/tienda/productos?buscar=solx&categoria=remeras&disponibilidad=agotados&orden=nombre-asc')
})

test('detalle conserva controles visuales, acceso de variantes y desactivación de compra', () => {
  const dirname = path.dirname(fileURLToPath(import.meta.url))
  const detail = fs.readFileSync(path.join(dirname, '../src/pages/tienda/ProductDetailPage.jsx'), 'utf8')
  const gallery = fs.readFileSync(path.join(dirname, '../src/components/tienda/ProductGallery.jsx'), 'utf8')
  assert.match(detail, /<ProductGallery/)
  assert.match(detail, /type="number"/)
  assert.match(detail, /aria-pressed=/)
  assert.match(detail, /disabled={!canAddToCart}/)
  assert.match(gallery, /ArrowRight|ArrowLeft/)
  assert.match(gallery, /aria-pressed=/)
})

test('tarjetas enlazan al detalle y CTA usa variante real o navega para elegir opciones', () => {
  const dirname = path.dirname(fileURLToPath(import.meta.url))
  const card = fs.readFileSync(path.join(dirname, '../src/components/tienda/ProductCard.jsx'), 'utf8')
  assert.match(card, /href=\{href\}/)
  assert.match(card, /directCardVariant/)
  assert.match(card, /Añadir al carrito/)
  assert.match(card, /productId: id/)
  assert.match(card, /variantId: directVariant\.id/)
  assert.match(card, /disabled/)
  assert.match(card, /import \{ ShoppingCart \} from 'lucide-react'/)
  assert.match(card, /<ShoppingCart aria-hidden="true"/)
})

test('App resuelve detalle sin React Router usando el slug extraído del pathname', () => {
  const dirname = path.dirname(fileURLToPath(import.meta.url))
  const app = fs.readFileSync(path.join(dirname, '../src/App.jsx'), 'utf8')
  assert.match(app, /extractStoreProductSlug\(pathname\)/)
  assert.match(app, /<ProductDetailPage productId=\{productSlug\}/)
  assert.doesNotMatch(app, /react-router/)
  const rewrite = JSON.parse(fs.readFileSync(path.join(dirname, '../../frontend/vercel.json'), 'utf8'))
  assert.equal(rewrite.rewrites.some(({ source, destination }) => source === '/(.*)' && destination === '/index.html'), true)
  const home = fs.readFileSync(path.join(dirname, '../src/pages/tienda/HomeTienda.jsx'), 'utf8')
  const listing = fs.readFileSync(path.join(dirname, '../src/pages/tienda/AllProductsPage.jsx'), 'utf8')
  assert.match(home, /<ProductCard/)
  assert.match(listing, /<ProductCard/)
})

test('resumen mapea ID Mongo y slug de ruta por separado junto a variante directa', () => {
  const summary = mapProductSummary({
    id: 'mongo-p1', slug: 'producto-real', nombre: 'Producto', precioBase: '100.00',
    varianteDirecta: { id: 'mongo-v1', precio: '125.50', stockDisponible: 2, agotada: false },
  })
  assert.equal(summary.id, 'mongo-p1')
  assert.equal(summary.slug, 'producto-real')
  assert.equal(summary.varianteDirecta.id, 'mongo-v1')
  assert.equal(summary.price, 125.5)
})

test('filtros y detalle exponen controles accesibles y clases responsive', () => {
  const dirname = path.dirname(fileURLToPath(import.meta.url))
  const listing = fs.readFileSync(path.join(dirname, '../src/pages/tienda/AllProductsPage.jsx'), 'utf8')
  const detail = fs.readFileSync(path.join(dirname, '../src/pages/tienda/ProductDetailPage.jsx'), 'utf8')
  assert.match(listing, /aria-label="Filtros de productos"/)
  assert.match(listing, /aria-label="Filtrar por categoría"/)
  assert.match(listing, /aria-label="Ordenar productos"/)
  assert.match(listing, /sm:grid-cols-2 lg:grid-cols-4/)
  assert.match(detail, /sm:grid-cols-2/)
  assert.match(detail, /role="status"/)
  assert.match(detail, /Reintentar/)
})
