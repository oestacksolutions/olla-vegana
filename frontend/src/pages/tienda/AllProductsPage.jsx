import ProductCard from '../../components/tienda/ProductCard'
import StoreLayout from '../../components/layout/StoreLayout'
import { useEffect, useMemo, useState } from 'react'
import { fetchStoreProducts, getCategories } from '../../services/catalog'
import {
  catalogFilterSearch,
  CATALOG_FILTERS_UPDATED_EVENT,
  FILTER_DEFAULTS,
  filterAndSortProducts,
  parseCatalogFilters,
} from '../../utils/catalogUi'

function AllProductsPage() {
  const [products, setProducts] = useState([])
  const [loadError, setLoadError] = useState('')
  const [loadState, setLoadState] = useState('loading')
  const [retryCount, setRetryCount] = useState(0)
  const [categories, setCategories] = useState([])
  const [categoryError, setCategoryError] = useState(false)
  const [filters, setFilters] = useState(() => parseCatalogFilters(window.location.search))
  const visibleProducts = useMemo(() => filterAndSortProducts(products, filters), [products, filters])

  useEffect(() => {
    let active = true
    setLoadState('loading')
    setLoadError('')
    setProducts([])
    fetchStoreProducts()
      .then((items) => {
        if (!active) return
        setProducts(items)
        setLoadState(items.length ? 'loaded' : 'empty')
      })
      .catch(() => {
        if (!active) return
        setLoadError('No pudimos cargar los productos. Revisá tu conexión e intentá nuevamente.')
        setLoadState('error')
      })
    return () => { active = false }
  }, [retryCount])

  useEffect(() => {
    let active = true
    getCategories()
      .then((items) => { if (active) setCategories(items) })
      .catch(() => { if (active) setCategoryError(true) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    const syncFilters = () => setFilters(parseCatalogFilters(window.location.search))
    window.addEventListener('popstate', syncFilters)
    return () => window.removeEventListener('popstate', syncFilters)
  }, [])

  const updateFilters = (changes) => {
    const next = { ...filters, ...changes }
    setFilters(next)
    window.history.replaceState(null, '', `${window.location.pathname}${catalogFilterSearch(next)}`)
    window.dispatchEvent(new Event(CATALOG_FILTERS_UPDATED_EVENT))
  }

  const clearFilters = () => updateFilters(FILTER_DEFAULTS)
  const hasFilters = filters.buscar || filters.categoria || filters.disponibilidad !== 'todas' || filters.orden !== 'destacados'

  return (
    <StoreLayout>
      <main className="mx-auto w-full max-w-[1100px] flex-1 px-6 py-12 sm:px-10 sm:py-16">
        <div className="mx-auto flex w-full max-w-[1200px] items-center gap-5 pb-8 text-[#466729] sm:gap-8 sm:pb-10">
          <span aria-hidden="true" className="h-px min-w-0 flex-1 bg-[#466729]" />
          <h1 className="shrink-0 font-poppins text-[24px] font-normal leading-none sm:text-[30px]">Todos los productos</h1>
          <span aria-hidden="true" className="h-px min-w-0 flex-1 bg-[#466729]" />
        </div>

        <section aria-label="Filtros de productos" className="mx-auto mb-9 w-full max-w-[960px] rounded-[18px] border border-[#AF71DD]/35 bg-white p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="font-poppins text-xs font-medium text-[#466729]">
              Buscar
              <span className="mt-1 flex h-11 items-center gap-2 rounded-lg border border-[#466729]/25 bg-[#FFFDF8] px-3 focus-within:border-[#AF71DD]">
                <input type="search" aria-label="Buscar por nombre o descripción" placeholder="Nombre o descripción" value={filters.buscar} onChange={(event) => updateFilters({ buscar: event.target.value })} className="min-w-0 flex-1 bg-transparent text-sm font-normal text-[#292621] outline-none placeholder:text-black/40" />
                {filters.buscar && <button type="button" aria-label="Limpiar búsqueda" onClick={() => updateFilters({ buscar: '' })} className="px-1 text-base text-[#466729]">×</button>}
              </span>
            </label>

            <label className="font-poppins text-xs font-medium text-[#466729]">
              Categoría
              <select aria-label="Filtrar por categoría" value={filters.categoria} onChange={(event) => updateFilters({ categoria: event.target.value })} className="mt-1 h-11 w-full rounded-lg border border-[#466729]/25 bg-[#FFFDF8] px-3 text-sm font-normal text-[#292621] outline-none focus:border-[#AF71DD]">
                <option value="">Todas las categorías</option>
                {categories.map(({ id, nombre, slug }) => <option key={id || slug} value={slug}>{nombre}</option>)}
              </select>
              {categoryError && <span role="status" className="mt-1 block font-normal text-black/50">No pudimos cargar las categorías.</span>}
            </label>

            <label className="font-poppins text-xs font-medium text-[#466729]">
              Disponibilidad
              <select aria-label="Filtrar por disponibilidad" value={filters.disponibilidad} onChange={(event) => updateFilters({ disponibilidad: event.target.value })} className="mt-1 h-11 w-full rounded-lg border border-[#466729]/25 bg-[#FFFDF8] px-3 text-sm font-normal text-[#292621] outline-none focus:border-[#AF71DD]">
                <option value="todas">Todas</option>
                <option value="disponibles">Con stock</option>
                <option value="agotados">Agotados</option>
              </select>
            </label>

            <label className="font-poppins text-xs font-medium text-[#466729]">
              Ordenar por
              <select aria-label="Ordenar productos" value={filters.orden} onChange={(event) => updateFilters({ orden: event.target.value })} className="mt-1 h-11 w-full rounded-lg border border-[#466729]/25 bg-[#FFFDF8] px-3 text-sm font-normal text-[#292621] outline-none focus:border-[#AF71DD]">
                <option value="destacados">Destacados</option>
                <option value="nombre-asc">Nombre: A-Z</option>
                <option value="nombre-desc">Nombre: Z-A</option>
                <option value="precio-asc">Precio: menor a mayor</option>
                <option value="precio-desc">Precio: mayor a menor</option>
              </select>
            </label>
          </div>
          {hasFilters && <button type="button" onClick={clearFilters} className="mt-4 rounded-full border border-[#466729]/40 px-4 py-2 font-poppins text-xs text-[#466729] transition-colors hover:bg-[#466729]/5">Limpiar filtros</button>}
        </section>

        <div className="mx-auto grid w-full max-w-[960px] justify-center gap-14" style={{ gridTemplateColumns: 'repeat(auto-fit, 180px)' }}>
          {loadState === 'error' && <div className="col-span-full text-center"><p role="alert" className="font-poppins text-sm text-red-800">{loadError}</p><button type="button" onClick={() => setRetryCount((count) => count + 1)} className="mt-3 rounded-full border border-[#466729] px-4 py-2 font-poppins text-xs text-[#466729]">Reintentar</button></div>}
          {loadState === 'loading' && <p role="status" className="col-span-full text-center font-poppins text-sm text-black/55">Cargando productos…</p>}
          {loadState === 'empty' && <p role="status" className="col-span-full text-center font-poppins text-sm text-black/55">Todavía no hay productos disponibles.</p>}
          {loadState === 'loaded' && visibleProducts.length === 0 && <div className="col-span-full text-center"><p role="status" className="font-poppins text-sm text-black/60">No encontramos productos con esos filtros.</p>{hasFilters && <button type="button" onClick={clearFilters} className="mt-3 rounded-full border border-[#466729] px-4 py-2 font-poppins text-xs text-[#466729]">Limpiar filtros</button>}</div>}
          {loadState === 'loaded' && visibleProducts.map((product, index) => <ProductCard key={product.id} animationIndex={index} {...product} />)}
        </div>
      </main>
    </StoreLayout>
  )
}

export default AllProductsPage
