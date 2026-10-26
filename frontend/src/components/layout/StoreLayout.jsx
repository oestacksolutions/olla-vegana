import { useEffect, useState } from 'react'
import { Menu, Search, ShoppingCart, Trash2, X } from 'lucide-react'
import BtnAction from '../disenio/btn-action'
import StoreFooter from './StoreFooter'
import logoOllaVegana from '../../assets/png/logo_olla_vegana.png'
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
    <button type="button" onClick={openCart} aria-label={`Abrir carrito${cartTotal > 0 ? `, total $${cartTotal.toLocaleString('es-AR')}` : ''}`} aria-expanded={isCartOpen} aria-controls="store-cart-panel" className="relative ml-auto flex min-w-[44px] flex-col items-center pt-6 font-poppins text-[11px] text-[#466729] sm:min-w-[76px] sm:pt-8 sm:text-[14px] sm:ml-0">
      <ShoppingCart aria-hidden="true" className="absolute left-1/2 top-0 h-6 w-6 -translate-x-1/2 sm:h-8 sm:w-8" />
      {cartTotal > 0 && <div className="mt-1 flex min-h-5 items-center justify-center sm:min-h-6">${cartTotal.toLocaleString('es-AR')}</div>}
    </button>
  )

  return (
    <div className="flex min-h-screen w-full max-w-full flex-col overflow-x-clip bg-[#FFF8E9]">
      <header className="relative min-h-[112px] w-full border-b border-[#AF71DD]/20 bg-[#FFF8E9] sm:min-h-0">
        <div className="flex min-h-[76px] w-full items-center justify-between gap-4 px-4 py-2 sm:h-[84px] sm:px-6 sm:py-0 lg:h-[128px] lg:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
            <a href="/tienda" aria-label="Ver todos los productos" className="shrink-0 lg:ml-36">
              <img src={logoOllaVegana} alt="Olla Vegana" className="h-[70px] w-[70px] object-contain sm:h-[82px] sm:w-[82px] lg:h-[118px] lg:w-[118px]" />
            </a>
            <form role="search" onSubmit={(event) => event.preventDefault()} className="hidden h-[42px] min-w-0 w-[220px] max-w-full items-center gap-2 rounded-[20px] border border-[#AF71DD] bg-white px-3 text-[#AF71DD] sm:ml-auto sm:flex sm:h-[46px] sm:w-full sm:max-w-[280px]">
              <Search aria-hidden="true" className="h-5 w-5 shrink-0" />
              <input type="search" name="productos" aria-label="Buscar productos" placeholder="Buscar productos" className="min-w-0 flex-1 bg-transparent font-poppins text-sm text-[#292621] outline-none placeholder:text-[#AF71DD]/70" />
            </form>
            <div className="hidden sm:flex">{cartSummary}</div>
          </div>
          <button type="button" aria-label={isMenuOpen ? 'Cerrar categorías' : 'Abrir categorías'} aria-expanded={isMenuOpen} aria-controls="menu-categorias-tienda" onClick={() => setIsMenuOpen((open) => !open)} className="col-start-2 row-start-1 flex h-10 w-10 items-center justify-center rounded-full text-[#466729] transition-colors hover:bg-[#AF71DD]/15 sm:hidden">
            {isMenuOpen ? <X aria-hidden="true" className="h-6 w-6" /> : <Menu aria-hidden="true" className="h-6 w-6" />}
          </button>
        </div>
        <div className="absolute right-4 top-[60px] sm:hidden">{cartSummary}</div>
        {isMenuOpen && <nav id="menu-categorias-tienda" aria-label="Categorías de la tienda" className="border-t border-[#AF71DD]/20 px-4 py-3 sm:hidden"><ul className="flex flex-col gap-3">{storeCategories.map(([label, href]) => <li key={href}><a href={href} onClick={() => setIsMenuOpen(false)} className="block font-scripter text-[18px] text-black/80 transition-colors hover:text-[#F13107]">{label}</a></li>)}</ul></nav>}
      </header>
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
