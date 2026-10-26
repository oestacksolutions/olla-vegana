import { useState } from 'react'
import { Menu, Search, ShoppingCart, X } from 'lucide-react'
import StoreFooter from '../../components/layout/StoreFooter'
import ProductCard from '../../components/tienda/ProductCard'
import logoOllaVegana from '../../assets/brand/svgMagui/logo_olla_vegana.png'
import remeraFrente from '../../assets/brand/svgMagui/remera-frente.jpg'
import remeras from '../../assets/brand/svgMagui/remeras.jpg'
import gorraBeige from '../../assets/brand/svgMagui/gorra.JPG'
import gorraNegra from '../../assets/brand/svgMagui/gorra-negra.JPG'
import tote from '../../assets/brand/svgMagui/tote.JPG'

const products = [
  { id: 'remera', name: 'Remera “Nadie se salva solx”', price: 45000, image: remeras, alt: 'Remera de Olla Vegana' },
  {
    id: 'gorra',
    name: 'Gorra Olla Vegana',
    price: 27000,
    image: gorraBeige,
    alt: 'Gorra Olla Vegana',
    imageFit: 'contain',
    colorVariants: [
      { label: 'Beige', color: '#D8C7A3', image: gorraBeige },
      { label: 'Negra', color: '#292621', image: gorraNegra },
    ],
  },
  { id: 'tote', name: 'Tote oficial Olla Vegana', price: 27000, image: tote, alt: 'Tote bag de Olla Vegana', imageFit: 'contain' },
]

const categories = [
  ['Remeras', '#remera'],
  ['Gorras', '#gorra'],
  ['Totes', '#tote'],
]

function HomeTienda() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const cartTotal = 0
  return (
    <div className="flex min-h-screen flex-col bg-[#FFF8E9]">
      <header className="min-h-[76px] w-full border-b border-[#AF71DD]/20 bg-[#FFF8E9] sm:h-[84px]">
        <div className="grid min-h-[76px] w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 px-4 py-3 sm:flex sm:h-full sm:flex-nowrap sm:justify-between sm:px-6 sm:py-0 lg:px-8">
          <div className="col-start-1 row-start-1 flex min-w-0 flex-col items-start gap-2 sm:flex-none sm:flex-row sm:items-center sm:gap-4">
            <form
              role="search"
              onSubmit={(event) => event.preventDefault()}
              className="hidden h-[42px] min-w-0 w-[220px] max-w-full items-center gap-2 rounded-[20px] border border-[#AF71DD] bg-white px-3 text-[#AF71DD] sm:flex sm:h-[46px] sm:w-full sm:max-w-[280px]"
            >
              <Search aria-hidden="true" className="h-5 w-5 shrink-0" />
              <input
                type="search"
                name="productos"
                aria-label="Buscar productos"
                placeholder="Buscar productos"
                className="min-w-0 flex-1 bg-transparent font-poppins text-sm text-[#292621] outline-none placeholder:text-[#AF71DD]/70"
              />
            </form>
          </div>
          <nav aria-label="Cuenta" className="col-start-1 row-start-1 ml-0 flex shrink-0 flex-row items-center gap-2 font-scripter text-[12px] text-[#466729] sm:ml-auto sm:gap-4 sm:text-[16px]">
            <a className="transition-colors hover:text-[#F13107]" href="#iniciar-sesion">
              Iniciar Sesion
            </a>
            <span aria-hidden="true" className="h-5 w-px bg-[#466729]/60" />
            <a className="transition-colors hover:text-[#F13107]" href="#registrarme">
              Registrarme
            </a>
          </nav>
          <button
            type="button"
            aria-label={isMenuOpen ? 'Cerrar categorías' : 'Abrir categorías'}
            aria-expanded={isMenuOpen}
            aria-controls="menu-categorias-tienda"
            onClick={() => setIsMenuOpen((open) => !open)}
            className="col-start-2 row-start-1 flex h-10 w-10 items-center justify-center rounded-full text-[#466729] transition-colors hover:bg-[#AF71DD]/15 sm:hidden"
          >
            {isMenuOpen ? <X aria-hidden="true" className="h-6 w-6" /> : <Menu aria-hidden="true" className="h-6 w-6" />}
          </button>
        </div>
        {isMenuOpen && (
          <nav id="menu-categorias-tienda" aria-label="Categorías de la tienda" className="border-t border-[#AF71DD]/20 px-4 py-3 sm:hidden">
            <ul className="flex flex-col gap-3">
              {categories.map(([label, href]) => (
                <li key={href}>
                  <a
                    href={href}
                    onClick={() => setIsMenuOpen(false)}
                    className="block font-scripter text-[18px] text-black/80 transition-colors hover:text-[#F13107]"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </header>
      <main className="flex h-[120px] w-full flex-none items-center justify-between px-6 py-4 sm:h-[250px] sm:justify-center sm:py-8" aria-label="Tienda online">
        <div className="flex flex-1 items-center justify-start sm:justify-center">
          <img
            src={logoOllaVegana}
            alt="Olla Vegana"
            className="h-[96px] w-[96px] object-contain sm:h-[300px] sm:w-[300px]"
          />
        </div>
        <div className="flex shrink-0 flex-col items-center gap-1 font-poppins text-[14px] text-[#466729] sm:hidden" aria-label="Carrito de compras">
          <ShoppingCart aria-hidden="true" className="h-6 w-6" />
          {cartTotal > 0 && <span>${cartTotal.toLocaleString('es-AR')}</span>}
        </div>
      </main>
      <nav aria-label="Categorías de la tienda" className="hidden h-[48px] w-full items-center justify-center gap-8 sm:flex sm:gap-12">
        {categories.map(([label, href]) => (
          <a
            key={label}
            href={href}
            className="font-scripter text-[20px] text-black/80 transition-colors hover:text-[#F13107]"
          >
            {label}
          </a>
        ))}
      </nav>
      <div className="mt-10 h-[400px] w-full overflow-hidden">
        <img
          src={remeraFrente}
          alt="Remera de Olla Vegana"
          className="h-full w-full object-cover"
        />
      </div>
      <div className="mx-auto flex w-full max-w-[1200px] items-center gap-5 px-6 pb-10 pt-16 text-[#466729] sm:gap-8 sm:px-8">
        <span aria-hidden="true" className="h-px min-w-0 flex-1 bg-[#466729]" />
        <h2 className="shrink-0 font-poppins text-[26px] font-normal leading-none">Productos</h2>
        <span aria-hidden="true" className="h-px min-w-0 flex-1 bg-[#466729]" />
      </div>
      <section id="productos" aria-label="Productos" className="w-full px-6 pb-16 sm:px-8">
        <div className={`mx-auto grid w-full max-w-[960px] grid-cols-1 justify-items-center gap-14 sm:grid-cols-2 ${products.length <= 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4'}`}>
          {products.map((product) => <ProductCard key={product.id} {...product} />)}
        </div>
      </section>
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
      <div className="mb-10 w-full bg-[#AF71DD]/50 px-6 py-8 text-center">
        <p className="mx-auto max-w-[900px] font-poppins text-[16px] italic text-black/80 sm:text-[18px]">
          Todos los productos que se venden en nuestra tienda son 100% a beneficio de Olla Vegana
        </p>
      </div>
      <StoreFooter />
    </div>
  )
}

export default HomeTienda
