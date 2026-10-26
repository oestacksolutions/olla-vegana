import ProductCard from '../../components/tienda/ProductCard'
import StoreLayout from '../../components/layout/StoreLayout'
import { storeProducts } from '../../data/storeProducts'

function AllProductsPage() {
  return (
    <StoreLayout>
      <main className="mx-auto w-full max-w-[1100px] flex-1 px-6 py-12 sm:px-10 sm:py-16">
        <div className="mx-auto flex w-full max-w-[1200px] items-center gap-5 pb-12 text-[#466729] sm:gap-8">
          <span aria-hidden="true" className="h-px min-w-0 flex-1 bg-[#466729]" />
          <h1 className="shrink-0 font-poppins text-[24px] font-normal leading-none sm:text-[30px]">Todos los productos</h1>
          <span aria-hidden="true" className="h-px min-w-0 flex-1 bg-[#466729]" />
        </div>
        <div className="mx-auto grid w-full max-w-[960px] justify-center gap-14" style={{ gridTemplateColumns: 'repeat(auto-fit, 180px)' }}>
          {storeProducts.map((product, index) => <ProductCard key={product.id} animationIndex={index} {...product} />)}
        </div>
      </main>
    </StoreLayout>
  )
}

export default AllProductsPage
