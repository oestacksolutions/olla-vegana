import ProductCard from '../../components/tienda/ProductCard'
import StoreLayout from '../../components/layout/StoreLayout'
import { useEffect, useState } from 'react'
import { fetchStoreProducts } from '../../services/catalog'

function AllProductsPage() {
  const [products, setProducts] = useState([])
  const [error, setError] = useState('')
  useEffect(() => {
    fetchStoreProducts()
      .then(setProducts)
      .catch(() => setError('No pudimos cargar los productos. Intentá nuevamente.'))
  }, [])

  return (
    <StoreLayout>
      <main className="mx-auto w-full max-w-[1100px] flex-1 px-6 py-12 sm:px-10 sm:py-16">
        <div className="mx-auto flex w-full max-w-[1200px] items-center gap-5 pb-12 text-[#466729] sm:gap-8">
          <span aria-hidden="true" className="h-px min-w-0 flex-1 bg-[#466729]" />
          <h1 className="shrink-0 font-poppins text-[24px] font-normal leading-none sm:text-[30px]">Todos los productos</h1>
          <span aria-hidden="true" className="h-px min-w-0 flex-1 bg-[#466729]" />
        </div>
        <div className="mx-auto grid w-full max-w-[960px] justify-center gap-14" style={{ gridTemplateColumns: 'repeat(auto-fit, 180px)' }}>
          {error && <p role="alert" className="col-span-full text-center font-poppins text-sm text-red-800">{error}</p>}
          {!error && products.length === 0 && <p role="status" className="col-span-full text-center font-poppins text-sm text-black/55">Cargando productos…</p>}
          {products.map((product, index) => <ProductCard key={product.id} animationIndex={index} {...product} />)}
        </div>
      </main>
    </StoreLayout>
  )
}

export default AllProductsPage
