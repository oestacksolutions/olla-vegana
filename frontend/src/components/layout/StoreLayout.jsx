import { useEffect, useState } from 'react'
import { Menu, Search, ShoppingCart, Trash2, X } from 'lucide-react'
import BtnAction from '../disenio/btn-action'
import StoreFooter from './StoreFooter'
import logoOllaVegana from '../../assets/brand/svgMagui/logo_olla_vegana.png'
import { storeCategories, storeProducts } from '../../data/storeProducts'
import { CART_UPDATED_EVENT, getStoreCart, removeStoreCartItem } from '../../data/storeCart'

function StoreLayout({ children }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [cartItems, setCartItems] = useState(() => getStoreCart())
  const [isCartOpen, setIsCartOpen] = useState(false)
  const cartTotal = cartItems.reduce((total, item) => total + item.price * item.quantity, 0)
  const selectedCategory = new URLSearchParams(window.location.search).get('categoria')
  const activeCategory = window.location.pathname.replace(/\/$/, '') === '/tienda'
    ? selectedCategory
    : null

  useEffect(() => {
    const updateCart = () => setCartItems(getStoreCart())
    window.addEventListener(CART_UPDATED_EVENT, updateCart)
    window.addEventListener('storage', updateCart)
    return () => {
      window.removeEventListener(CART_UPDATED_EVENT, updateCart)
      window.removeEventListener('storage', updateCart)
    }
  }, [])

  useEffect(() => {
    if (!isCartOpen) return undefined
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setIsCartOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [isCartOpen])

  const openCart = () => {
    setIsCartOpen(true)
  }

  const cartSummary = (
    <button type="button" onClick={openCart} aria-label={`Abrir carrito${cartTotal > 0 ? `, total $${cartTotal.toLocaleString('es-AR')}` : ''}`} aria-expanded={isCartOpen} aria-controls="store-cart-panel" className="relative flex min-w-[76px] flex-col items-center pt-8 font-poppins text-[14px] text-[#466729]">
      <ShoppingCart aria-hidden="true" className="absolute left-1/2 top-0 h-8 w-8 -translate-x-1/2" />
      {cartTotal > 0 && <div className="mt-1 flex min-h-6 items-center justify-center">${cartTotal.toLocaleString('es-AR')}</div>}
    </button>
  )

  return (
    <div className="flex min-h-screen flex-col bg-[#FFF8E9]">
      <header className="min-h-[76px] w-full border-b border-[#AF71DD]/20 bg-[#FFF8E9] sm:h-[84px]">
        <div className="grid min-h-[76px] w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 px-4 py-3 sm:flex sm:h-full sm:flex-nowrap sm:justify-between sm:px-6 sm:py-0 lg:px-8">
          <div className="col-start-1 row-start-1 flex min-w-0 flex-col items-start gap-2 sm:flex-none sm:flex-row sm:items-center sm:gap-4">
            <form role="search" onSubmit={(event) => event.preventDefault()} className="hidden h-[42px] min-w-0 w-[220px] max-w-full items-center gap-2 rounded-[20px] border border-[#AF71DD] bg-white px-3 text-[#AF71DD] sm:flex sm:h-[46px] sm:w-full sm:max-w-[280px]">
              <Search aria-hidden="true" className="h-5 w-5 shrink-0" />
              <input type="search" name="productos" aria-label="Buscar productos" placeholder="Buscar productos" className="min-w-0 flex-1 bg-transparent font-poppins text-sm text-[#292621] outline-none placeholder:text-[#AF71DD]/70" />
            </form>
          </div>
          <nav aria-label="Cuenta" className="col-start-1 row-start-1 ml-0 flex shrink-0 flex-row items-center gap-2 font-scripter text-[12px] text-[#466729] sm:ml-auto sm:gap-4 sm:text-[16px]">
            <a className="transition-colors hover:text-[#F13107]" href="#iniciar-sesion">Iniciar Sesion</a>
            <span aria-hidden="true" className="h-5 w-px bg-[#466729]/60" />
            <a className="transition-colors hover:text-[#F13107]" href="#registrarme">Registrarme</a>
          </nav>
          <button type="button" aria-label={isMenuOpen ? 'Cerrar categorías' : 'Abrir categorías'} aria-expanded={isMenuOpen} aria-controls="menu-categorias-tienda" onClick={() => setIsMenuOpen((open) => !open)} className="col-start-2 row-start-1 flex h-10 w-10 items-center justify-center rounded-full text-[#466729] transition-colors hover:bg-[#AF71DD]/15 sm:hidden">
            {isMenuOpen ? <X aria-hidden="true" className="h-6 w-6" /> : <Menu aria-hidden="true" className="h-6 w-6" />}
          </button>
        </div>
        {isMenuOpen && <nav id="menu-categorias-tienda" aria-label="Categorías de la tienda" className="border-t border-[#AF71DD]/20 px-4 py-3 sm:hidden"><ul className="flex flex-col gap-3">{storeCategories.map(([label, href]) => <li key={href}><a href={href} onClick={() => setIsMenuOpen(false)} className="block font-scripter text-[18px] text-black/80 transition-colors hover:text-[#F13107]">{label}</a></li>)}</ul></nav>}
      </header>
      <div className="relative flex h-[120px] w-full flex-none items-center justify-between px-6 py-4 sm:h-[250px] sm:justify-center sm:py-8" aria-label="Tienda online">
        <div className="flex flex-1 items-center justify-start sm:justify-center"><a href="/tienda" aria-label="Ver todos los productos" className="flex"><img src={logoOllaVegana} alt="Olla Vegana" className="h-[96px] w-[96px] object-contain sm:h-[300px] sm:w-[300px]" /></a></div>
        <div className="absolute right-4 top-2 sm:hidden">{cartSummary}</div>
        <div className="absolute right-8 top-4 hidden sm:block">{cartSummary}</div>
      </div>
      <div className="sticky top-0 z-30 mt-8 hidden h-[48px] w-full bg-[#FFF8E9] shadow-sm sm:block">
        <nav aria-label="Categorías de la tienda" className="flex h-full w-full items-center justify-center gap-8 border-b border-[#AF71DD]/15 sm:gap-12">
          {storeCategories.map(([label, href, category]) => <a key={label} href={href} aria-current={activeCategory === category ? 'page' : undefined} className={`inline-flex h-full items-center px-2 font-scripter text-[20px] transition-colors hover:text-[#F13107] ${activeCategory === category ? 'text-[#F13107]' : 'text-black/80'}`}>{label}</a>)}
        </nav>
      </div>
      {isCartOpen && (
        <>
          <button type="button" aria-label="Cerrar carrito" onClick={() => setIsCartOpen(false)} className="fixed inset-0 z-40 cursor-default bg-black/30" />
          <aside id="store-cart-panel" role="dialog" aria-modal="true" aria-labelledby="store-cart-title" className="fixed inset-y-0 right-0 z-50 flex h-dvh w-full max-w-[390px] flex-col bg-[#FFF8E9] p-6 shadow-2xl sm:p-8">
            <div className="flex items-center justify-between border-b border-[#AF71DD]/30 pb-5">
              <h2 id="store-cart-title" className="font-poppins text-xl font-medium text-[#466729]">Tu carrito</h2>
              <button type="button" aria-label="Cerrar carrito" onClick={() => setIsCartOpen(false)} className="rounded-full p-2 text-[#466729] transition-colors hover:bg-[#AF71DD]/15"><X aria-hidden="true" className="h-5 w-5" /></button>
            </div>

            {cartItems.length === 0 ? (
              <p className="flex flex-1 items-center justify-center font-poppins text-sm text-black/65">Tu carrito está vacío.</p>
            ) : (
              <div className="flex-1 overflow-y-auto py-5">
                <ul className="flex flex-col gap-5">
                  {cartItems.map((item) => {
                    const product = storeProducts.find(({ id }) => id === item.productId)
                    const option = product?.colorVariants?.find(({ label }) => label === item.variant)
                      || product?.models?.find(({ label }) => label === item.variant)
                    const image = option?.image || product?.image
                    return (
                      <li key={`${item.productId}-${item.size || ''}-${item.variant || ''}`} className="flex gap-4 border-b border-[#466729]/15 pb-5">
                        {image && <img src={image} alt="" className="h-[82px] w-[64px] rounded-[10px] bg-white object-contain" />}
                        <div className="min-w-0 flex-1 font-poppins text-sm text-black/75">
                          <p className="font-medium text-black/80">{item.name}</p>
                          {(item.size || item.variant) && <p className="mt-1 text-xs text-black/60">{[item.size && `Talle ${item.size}`, item.variant].filter(Boolean).join(' · ')}</p>}
                          <p className="mt-2">{item.quantity} × ${item.price.toLocaleString('es-AR')}</p>
                          <p className="mt-1 font-medium text-[#466729]">${(item.quantity * item.price).toLocaleString('es-AR')}</p>
                        </div>
                        <button type="button" aria-label={`Quitar ${item.name} del carrito`} onClick={() => removeStoreCartItem(item.productId, item.size, item.variant)} className="self-start rounded-full p-2 text-[#466729] transition-colors hover:bg-[#AF71DD]/15 hover:text-[#F13107]"><Trash2 aria-hidden="true" className="h-4 w-4" /></button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

            <div className="border-t border-[#AF71DD]/30 pt-5">
              <div className="mb-5 flex items-center justify-between font-poppins text-base text-black/80"><span>Total</span><strong className="font-medium">${cartTotal.toLocaleString('es-AR')}</strong></div>
              {cartItems.length > 0 && <BtnAction href="/tienda/checkout" onClick={() => setIsCartOpen(false)} width="100%" height="48px" className="!w-full !rounded-[10px] !font-light !text-[14px]">Finalizar compra</BtnAction>}
              <button type="button" onClick={() => setIsCartOpen(false)} className={`flex h-12 w-full items-center justify-center rounded-[10px] border border-[#AF71DD] bg-[#FFF8E9] font-poppins text-sm text-[#7A42A7] transition-colors hover:bg-[#AF71DD]/10 ${cartItems.length > 0 ? 'mt-3' : ''}`}>Seguir comprando</button>
            </div>
          </aside>
        </>
      )}
      {children}
      <StoreFooter />
    </div>
  )
}

export default StoreLayout
