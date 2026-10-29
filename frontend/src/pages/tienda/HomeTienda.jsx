import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import StoreLayout from '../../components/layout/StoreLayout'
import ProductCard from '../../components/tienda/ProductCard'
import remeraFrente from '../../assets/jpg/remera-frente.jpg'
import { fetchStoreProducts } from '../../services/catalog'
import { getVisibleStoreBanners, STORE_BANNERS_UPDATED_EVENT } from '../../data/storeBanners'

function HomeTienda() {
  const [heroBanners, setHeroBanners] = useState(() => getVisibleStoreBanners())
  const [bannerIndex, setBannerIndex] = useState(0)
  const [carouselPaused, setCarouselPaused] = useState(false)
  const [products, setProducts] = useState([])
  const [catalogError, setCatalogError] = useState('')
  const heroBanner = heroBanners[bannerIndex] || null
  const selectedCategory = new URLSearchParams(window.location.search).get('categoria')
  const filteredProducts = products
  const distinctProductCount = new Set(products.map((product) => product.id)).size

  useEffect(() => {
    let active = true
    fetchStoreProducts(selectedCategory)
      .then((items) => { if (active) setProducts(items) })
      .catch(() => { if (active) setCatalogError('No pudimos cargar los productos. Intentá nuevamente.') })
    return () => { active = false }
  }, [selectedCategory])

  useEffect(() => {
    const updateBanner = () => {
      setHeroBanners(getVisibleStoreBanners())
      setBannerIndex(0)
    }
    window.addEventListener(STORE_BANNERS_UPDATED_EVENT, updateBanner)
    window.addEventListener('storage', updateBanner)
    return () => {
      window.removeEventListener(STORE_BANNERS_UPDATED_EVENT, updateBanner)
      window.removeEventListener('storage', updateBanner)
    }
  }, [])

  useEffect(() => {
    if (selectedCategory || heroBanners.length < 2 || carouselPaused || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined
    const timer = window.setInterval(() => {
      if (!document.hidden) setBannerIndex((index) => (index + 1) % heroBanners.length)
    }, 5000)
    return () => window.clearInterval(timer)
  }, [heroBanners.length, selectedCategory, carouselPaused])

  const bannerImage = heroBanner?.desktop || remeraFrente
  const mobileBannerImage = heroBanner?.mobile || bannerImage
  const desktopZoom = (heroBanner?.desktopZoom ?? 120) / 100
  const mobileZoom = (heroBanner?.mobileZoom ?? 120) / 100
  const desktopFocusX = heroBanner?.desktopFocusX ?? heroBanner?.focus ?? 50
  const desktopFocusY = heroBanner?.desktopFocusY ?? 50
  const mobileFocusX = heroBanner?.mobileFocusX ?? heroBanner?.focus ?? 50
  const mobileFocusY = heroBanner?.mobileFocusY ?? 50
  const desktopImageStyle = {
    left: `${(50 - desktopFocusX) * (desktopZoom - 1)}%`,
    top: `${(50 - desktopFocusY) * (desktopZoom - 1)}%`,
    transform: `scale(${desktopZoom})`,
    transformOrigin: 'center',
    objectPosition: `${desktopFocusX}% ${desktopFocusY}%`,
  }
  const mobileImageStyle = {
    left: `${(50 - mobileFocusX) * (mobileZoom - 1)}%`,
    top: `${(50 - mobileFocusY) * (mobileZoom - 1)}%`,
    transform: `scale(${mobileZoom})`,
    transformOrigin: 'center',
    objectPosition: `${mobileFocusX}% ${mobileFocusY}%`,
  }
  const bannerPosition = heroBanner?.position === 'Izquierda'
    ? 'items-center justify-start text-left'
    : heroBanner?.position === 'Derecha'
      ? 'items-center justify-end text-right'
      : heroBanner?.position === 'Abajo'
        ? 'items-end justify-center text-center'
        : 'items-center justify-center text-center'

  return (
    <StoreLayout>
      {!selectedCategory && heroBanners.length > 0 && (
        <div
          role={heroBanners.length > 1 ? 'region' : undefined}
          aria-roledescription={heroBanners.length > 1 ? 'carrusel' : undefined}
          aria-label={heroBanners.length > 1 ? 'Banners de la tienda' : undefined}
          onMouseEnter={() => setCarouselPaused(true)}
          onMouseLeave={(event) => { if (!event.currentTarget.contains(document.activeElement)) setCarouselPaused(false) }}
          onFocusCapture={() => setCarouselPaused(true)}
          onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setCarouselPaused(false) }}
          className="relative mt-10 aspect-square w-full overflow-hidden bg-[#466729] sm:aspect-[3/1]"
        >
          <img key={`${heroBanner?.id}-desktop`} src={bannerImage} alt="" aria-hidden="true" className={`absolute hidden h-full w-full object-cover sm:block ${heroBanners.length > 1 ? 'store-banner-slide' : ''}`} style={desktopImageStyle} />
          <img key={`${heroBanner?.id}-mobile`} src={mobileBannerImage} alt={heroBanner?.title || 'Remera de Olla Vegana'} className={`absolute h-full w-full object-cover sm:hidden ${heroBanners.length > 1 ? 'store-banner-slide' : ''}`} style={mobileImageStyle} />
          {(heroBanner?.title || heroBanner?.subtitle || heroBanner?.buttonText) && (
            <div key={`${heroBanner?.id}-copy`} className={`absolute inset-0 flex bg-gradient-to-r from-black/45 via-black/15 to-transparent px-8 py-8 text-white sm:px-14 ${bannerPosition} ${heroBanners.length > 1 ? 'store-banner-slide' : ''}`}>
              <div className="max-w-[620px]">
                {heroBanner.title && <h1 className="font-poppins text-2xl font-semibold sm:text-4xl">{heroBanner.title}</h1>}
                {heroBanner.subtitle && <p className="mt-3 font-poppins text-sm leading-6 text-white/90 sm:text-base">{heroBanner.subtitle}</p>}
                {heroBanner.buttonText && <a href={heroBanner.href || '/tienda'} className="mt-5 inline-flex min-h-11 items-center rounded-full bg-[#AF71DD] px-5 font-poppins text-sm font-semibold text-white transition-colors hover:bg-[#9b58cc]">{heroBanner.buttonText}</a>}
              </div>
            </div>
          )}
          {heroBanners.length > 1 && (
            <>
              <button type="button" aria-label="Ver banner anterior" onClick={() => setBannerIndex((index) => (index - 1 + heroBanners.length) % heroBanners.length)} className="absolute left-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-white/95 text-[#466729] shadow-lg transition-transform hover:scale-105 sm:left-5 sm:h-14 sm:w-14">
                <ArrowLeft size={23} aria-hidden="true" />
              </button>
              <span aria-label={`Banner ${bannerIndex + 1} de ${heroBanners.length}`} className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 font-poppins text-[10px] text-white">
                {bannerIndex + 1} / {heroBanners.length}
              </span>
              <button type="button" aria-label="Ver banner siguiente" onClick={() => setBannerIndex((index) => (index + 1) % heroBanners.length)} className="absolute right-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-white/95 text-[#466729] shadow-lg transition-transform hover:scale-105 sm:right-5 sm:h-14 sm:w-14">
                <ArrowRight size={23} aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      )}
      {!selectedCategory && (
        <div className="mx-auto flex w-full max-w-[1200px] items-center gap-5 px-6 pb-10 pt-16 text-[#466729] sm:gap-8 sm:px-8">
          <span aria-hidden="true" className="h-px min-w-0 flex-1 bg-[#466729]" />
          <h2 className="shrink-0 font-poppins text-[26px] font-normal leading-none">Productos</h2>
          <span aria-hidden="true" className="h-px min-w-0 flex-1 bg-[#466729]" />
        </div>
      )}
      <section id="productos" aria-label="Productos" className={`w-full px-6 pb-16 sm:px-8 ${selectedCategory ? 'pt-12' : ''}`}>
        {catalogError && <p role="alert" className="mx-auto max-w-[960px] rounded-xl bg-red-50 p-4 text-center font-poppins text-sm text-red-800">{catalogError}</p>}
        {!catalogError && products.length === 0 && <p role="status" className="py-12 text-center font-poppins text-sm text-black/55">Cargando productos…</p>}
        {selectedCategory && (
          <a href="/tienda/productos" className="mx-auto mb-8 flex w-full max-w-[960px] items-center gap-2 font-poppins text-sm text-[#466729] transition-colors hover:text-[#F13107]">
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            Volver a todos los productos
          </a>
        )}
        {!selectedCategory && distinctProductCount > 4 && (
          <div className="mx-auto mb-4 flex w-full max-w-[960px] justify-end">
            <a href="/tienda/productos" className="inline-flex items-center gap-1 font-poppins text-xs text-[#466729] transition-colors hover:text-[#F13107]">
              Ver todos los productos <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
            </a>
          </div>
        )}
        <div className="mx-auto grid w-full max-w-[960px] justify-center gap-14" style={{ gridTemplateColumns: 'repeat(auto-fit, 180px)' }}>
          {filteredProducts.map((product, index) => <ProductCard key={product.id} animationIndex={index} {...product} />)}
        </div>
      </section>
      {!selectedCategory && (
        <section aria-label="Información de compra y pago" className="w-full px-6 pb-16 sm:px-8">
          <div className="mx-auto grid w-full max-w-[720px] grid-cols-1 justify-items-center gap-12 sm:grid-cols-2">
            <article id="compra-online" className="flex h-[190px] w-full max-w-[320px] flex-col items-center justify-center rounded-[20px] border border-[#AF71DD] bg-white px-6 py-7 text-center shadow-sm">
              <h2 className="font-poppins text-[18px] font-semibold text-black/80">Compra Online</h2>
              <p className="mt-3 font-poppins text-[14px] font-light text-black/80">Todos los días del año, las 24 hs</p>
            </article>
            <article className="flex h-[190px] w-full max-w-[320px] flex-col items-center justify-center rounded-[20px] border border-[#AF71DD] bg-white px-6 py-7 text-center shadow-sm">
              <h2 className="font-poppins text-[18px] font-semibold text-black/80">Formas de pago</h2>
              <p className="mt-3 font-poppins text-[14px] font-light text-black/80">
                Mercado Pago, tarjetas de crédito de Mercado Pago, transferencia bancaria
              </p>
            </article>
          </div>
        </section>
      )}
      <div className="mb-10 w-full bg-[#AF71DD]/50 px-6 py-8 text-center">
        <p className="mx-auto max-w-[900px] font-poppins text-[16px] italic text-black/80 sm:text-[18px]">
          Todos los productos que se venden en nuestra tienda son 100% a beneficio de Olla Vegana
        </p>
      </div>
    </StoreLayout>
  )
}

export default HomeTienda
