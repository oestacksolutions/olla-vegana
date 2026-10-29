import { useEffect, useState } from 'react'
import { ArrowLeft, ShoppingCart } from 'lucide-react'
import BtnAction from '../../components/disenio/btn-action'
import StoreLayout from '../../components/layout/StoreLayout'
import { getProduct } from '../../services/api'
import { addStoreCartItem } from '../../data/storeCart'
import fallbackImage from '../../assets/png/logo_olla_vegana.png'

const instagramUrl = 'https://www.instagram.com/olla.vegana/'

function ProductDetailPage({ productId }) {
  const [product, setProduct] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  useEffect(() => {
    let active = true
    setIsLoading(true)
    getProduct(productId)
      .then((data) => {
        if (!active) return
        const primaryImage = data.imagenes?.find((image) => image.esPrincipal) || data.imagenes?.[0]
        setProduct({
          id: data.slug,
          name: data.nombre,
          price: Number(data.precioBase || data.variantes?.[0]?.precio || 0),
          image: primaryImage?.url || fallbackImage,
          alt: primaryImage?.textoAlternativo || data.nombre,
          description: data.descripcion ? [data.descripcion] : [],
          variants: data.variantes,
          colorVariants: data.variantes?.map((variant) => ({
            label: variant.valores?.map(({ valor }) => valor).join(' · ') || 'Variante',
            image: data.imagenes?.find(({ varianteId }) => varianteId === variant.id)?.url || data.imagenes?.[0]?.url,
            stock: variant.stockDisponible,
          })) || [],
        })
      })
      .catch(() => { if (active) setLoadError('No pudimos cargar ese producto.') })
      .finally(() => { if (active) setIsLoading(false) })
    return () => { active = false }
  }, [productId])
  const options = product?.colorVariants || product?.models || []
  const [selectedVariant, setSelectedVariant] = useState(options[0])
  const [selectedSize, setSelectedSize] = useState(product?.sizes?.find((size) => !product.outOfStockSizes?.includes(size)))
  const [cartConfirmation, setCartConfirmation] = useState(false)

  if (isLoading) {
    return <StoreLayout><section className="mx-auto flex w-full max-w-[1000px] flex-1 items-center justify-center px-6 py-20"><p className="font-poppins text-sm text-black/55">Cargando producto…</p></section></StoreLayout>
  }

  if (!product || loadError) {
    return (
      <StoreLayout>
        <section className="mx-auto flex w-full max-w-[1000px] flex-1 flex-col items-center justify-center px-6 py-20 text-center">
          <h1 className="font-poppins text-3xl text-[#466729]">No encontramos ese producto</h1>
          <a href="/tienda/productos" className="mt-6 font-poppins text-[#466729] underline">Volver a productos</a>
        </section>
      </StoreLayout>
    )
  }

  const image = selectedVariant?.image || product.image
  const imageFit = selectedVariant?.imageFit || product.imageFit
  const alt = selectedVariant ? `${product.alt}, ${selectedVariant.label}` : product.alt
  const measurement = product.sizeMeasurements?.[selectedSize]
  const handleAddToCart = (event) => {
    event.preventDefault()
    addStoreCartItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      size: selectedSize,
      variant: selectedVariant?.label,
    })
    setCartConfirmation(true)
    window.setTimeout(() => setCartConfirmation(false), 2200)
  }

  return (
    <StoreLayout>
      <main className="mx-auto w-full max-w-[1100px] flex-1 px-6 py-10 sm:px-10 sm:py-16">
        <a href="/tienda/productos" className="inline-flex items-center gap-2 font-poppins text-sm text-[#466729] transition-colors hover:text-[#F13107]">
          <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Volver a productos
        </a>
        <section className="mx-auto mt-8 grid w-full max-w-[900px] grid-cols-1 items-start gap-8 sm:grid-cols-2 sm:gap-14">
          <div className="mx-auto h-[380px] w-full max-w-[360px] overflow-hidden rounded-[20px] bg-[#FFF8E9] sm:sticky sm:top-8 sm:h-[480px] sm:max-w-none">
            <img src={image || fallbackImage} alt={alt} onError={(event) => {
              if (event.currentTarget.dataset.fallbackAttempted) {
                event.currentTarget.hidden = true
                return
              }
              event.currentTarget.dataset.fallbackAttempted = 'true'
              event.currentTarget.src = fallbackImage
            }} className={`h-full w-full ${imageFit === 'contain' ? 'object-contain' : 'object-cover'}`} />
          </div>
          <div className="flex flex-col items-start">
            <h1 className="font-poppins text-[28px] font-medium text-black/80 sm:text-[36px]">{product.name}</h1>
            <p className="mt-4 font-poppins text-[22px] text-black/80">${product.price.toLocaleString('es-AR')}</p>
            <div className="mt-6 w-full">
              <h2 className="font-poppins text-lg font-medium text-[#466729]">{'Descripci\u00f3n'}</h2>
              <div className="mt-3 flex flex-col gap-3 font-poppins text-sm leading-6 text-black/75">
                {product.description?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
            </div>

            {product.sizes?.length > 0 && (
              <div className="mt-7 w-full">
                <label className="mb-3 block font-poppins text-sm text-black/70" htmlFor="product-size">Talle</label>
                <select id="product-size" value={selectedSize} onChange={(event) => setSelectedSize(event.target.value)} className="h-11 w-full max-w-[220px] rounded-[8px] border border-[#466729]/50 bg-transparent px-3 font-poppins text-sm text-black/80 outline-none focus:border-[#466729]">
                  {product.sizes.map((size) => <option key={size} value={size} disabled={product.outOfStockSizes?.includes(size)}>{product.outOfStockSizes?.includes(size) ? `${size} — Sin stock` : size}</option>)}
                </select>
                <p className="mt-3 font-poppins text-sm text-black/70">Medidas{measurement ? `: ${measurement}.` : ` para el talle ${selectedSize}: consultanos por Instagram.`}</p>
                <p className="mt-2 font-poppins text-xs leading-5 text-black/60">Si necesitas otro talle, <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className="underline transition-colors hover:text-[#F13107]">escribinos por Instagram</a>.</p>
              </div>
            )}

            {(product.colorVariants?.length > 0 || product.models?.length > 0) && (
              <div className="mt-7 w-full">
                <p className="mb-3 font-poppins text-sm text-black/70">{product.models ? 'Modelo' : 'Color'}: {selectedVariant?.label}</p>
                <div className="flex flex-wrap items-center gap-2">
                  {options.map((option) => (
                    <button key={option.label} type="button" aria-pressed={selectedVariant?.label === option.label} onClick={() => setSelectedVariant(option)} className={`rounded-[8px] border px-3 py-2 font-poppins text-sm transition-colors ${selectedVariant?.label === option.label ? 'border-[#466729] bg-[#466729] text-white' : 'border-[#466729]/40 text-black/75 hover:border-[#466729]'}`}>
                      {option.color && <span aria-hidden="true" className="mr-2 inline-block h-3 w-3 rounded-sm align-[-1px]" style={{ backgroundColor: option.color }} />}
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <BtnAction href="#carrito" onClick={handleAddToCart} width="230px" height="48px" className="mt-8 !gap-3 !rounded-[10px] !font-light !text-[14px]">
              <span>Agregar al carrito</span><ShoppingCart aria-hidden="true" className="h-4 w-4" />
            </BtnAction>
            {cartConfirmation && <p role="status" className="mt-3 font-poppins text-sm text-[#466729]">Producto agregado al carrito.</p>}
          </div>
        </section>
      </main>
    </StoreLayout>
  )
}

export default ProductDetailPage
