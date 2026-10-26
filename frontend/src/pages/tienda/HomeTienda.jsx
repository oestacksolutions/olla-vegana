import { ArrowLeft } from 'lucide-react'
import StoreLayout from '../../components/layout/StoreLayout'
import ProductCard from '../../components/tienda/ProductCard'
import remeraFrente from '../../assets/brand/svgMagui/remera-frente.jpg'
import { storeProducts as products } from '../../data/storeProducts'

function HomeTienda() {
  const selectedCategory = new URLSearchParams(window.location.search).get('categoria')
  const filteredProducts = selectedCategory
    ? products.filter((product) => product.category === selectedCategory)
    : products

  return (
    <StoreLayout>
      {!selectedCategory && (
        <div className="mt-10 h-[400px] w-full overflow-hidden">
          <img
            src={remeraFrente}
            alt="Remera de Olla Vegana"
            className="h-full w-full object-cover"
          />
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
        {selectedCategory && (
          <a href="/tienda/productos" className="mx-auto mb-8 flex w-full max-w-[960px] items-center gap-2 font-poppins text-sm text-[#466729] transition-colors hover:text-[#F13107]">
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            Volver a todos los productos
          </a>
        )}
        <div className="mx-auto grid w-full max-w-[960px] justify-center gap-14" style={{ gridTemplateColumns: 'repeat(auto-fit, 180px)' }}>
          {filteredProducts.map((product, index) => <ProductCard key={product.id} animationIndex={index} {...product} />)}
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
    </StoreLayout>
  )
}

export default HomeTienda
