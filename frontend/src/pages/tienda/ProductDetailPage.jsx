import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Minus, Plus, ShoppingCart } from 'lucide-react'
import StoreLayout from '../../components/layout/StoreLayout'
import ProductGallery from '../../components/tienda/ProductGallery'
import { getProduct } from '../../services/api'
import { addStoreCartItem } from '../../data/storeCart'
import { getLocalProductImages } from '../../data/localProductImages'
import {
  attributeGroups,
  canPurchaseVariant,
  findVariantForSelection,
  formatARS,
  imageForVariant,
  initialVariant,
  selectVariantOption,
  primaryImage,
  priceForVariant,
  variantLabel,
  variantStock,
} from '../../utils/catalogUi'

const instagramUrl = 'https://www.instagram.com/olla.vegana/'

function ProductDetailPage({ productId }) {
  const [product, setProduct] = useState(null)
  const [loadState, setLoadState] = useState('loading')
  const [retryCount, setRetryCount] = useState(0)
  const [attributes, setAttributes] = useState({})
  const [selectedImageId, setSelectedImageId] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [cartConfirmation, setCartConfirmation] = useState('')

  useEffect(() => {
    let active = true
    setLoadState('loading')
    setProduct(null)
    setAttributes({})
    setSelectedImageId(null)
    setQuantity(1)
    getProduct(productId)
      .then((data) => {
        if (!active) return
        const variants = Array.isArray(data.variantes) ? data.variantes : []
        const initial = initialVariant(variants)
        const apiImages = Array.isArray(data.imagenes) ? data.imagenes.filter((image) => image?.url) : []
        const images = apiImages.length ? apiImages : getLocalProductImages(data.slug)
        setProduct({ ...data, variantes: variants, imagenes: images })
        setAttributes(initial.selection)
        const initialImage = imageForVariant(images, initial.variant) || primaryImage(images)
        setSelectedImageId(initialImage?.id || null)
        setLoadState('loaded')
      })
      .catch((error) => {
        if (!active) return
        setLoadState(error.status === 404 ? 'not-found' : 'error')
      })
    return () => { active = false }
  }, [productId, retryCount])

  const groups = useMemo(() => attributeGroups(product?.variantes), [product?.variantes])
  const selectedVariant = useMemo(
    () => findVariantForSelection(product?.variantes, attributes),
    [product?.variantes, attributes]
  )
  const selectedStock = variantStock(selectedVariant)
  const price = priceForVariant(selectedVariant, product?.precioBase)
  const primary = primaryImage(product?.imagenes)
  const specificImage = imageForVariant(product?.imagenes, selectedVariant)
  const visibleImageId = selectedImageId || specificImage?.id || primary?.id || null
  const canAddToCart = loadState === 'loaded' && canPurchaseVariant(selectedVariant, quantity, price)

  useEffect(() => {
    if (!selectedVariant) return
    const preferred = imageForVariant(product?.imagenes, selectedVariant) || primaryImage(product?.imagenes)
    setSelectedImageId(preferred?.id || null)
    setQuantity(1)
  }, [product, selectedVariant?.id])

  const chooseAttribute = (attribute, value) => {
    setAttributes((current) => selectVariantOption(product?.variantes || [], current, attribute, value).selection)
    setQuantity(1)
  }

  const handleQuantity = (rawValue) => {
    if (rawValue === '') {
      setQuantity('')
      return
    }
    const next = Number(rawValue)
    if (!Number.isSafeInteger(next) || next < 1 || selectedStock === null) return
    setQuantity(Math.min(next, selectedStock))
  }

  const handleAddToCart = () => {
    if (!canAddToCart || !product || !selectedVariant) return
    const cartImage = specificImage?.url
      || product.imagenes.find((image) => String(image.id) === String(visibleImageId))?.url
      || primary?.url
    const result = addStoreCartItem({
      productId: product.id,
      productSlug: product.slug,
      variantId: selectedVariant.id,
      name: product.nombre,
      price,
      variant: variantLabel(selectedVariant),
      attributes: (selectedVariant.valores || []).map(({ atributo, valor }) => ({ atributo, valor })),
      quantity,
      stockDisponible: selectedStock,
      image: cartImage,
    })
    if (!result.ok) {
      setCartConfirmation(result.reason === 'insufficient-stock'
        ? 'No hay unidades suficientes para agregar esa cantidad.'
        : 'No pudimos agregarlo. Volvé a verificar la disponibilidad e intentá nuevamente.')
      return
    }
    setCartConfirmation(`${quantity} ${quantity === 1 ? 'unidad agregada' : 'unidades agregadas'} al carrito.`)
    window.setTimeout(() => setCartConfirmation(''), 2200)
  }

  if (loadState === 'loading') {
    return <StoreLayout><section className="mx-auto flex w-full max-w-[1000px] flex-1 items-center justify-center px-6 py-20"><p role="status" className="font-poppins text-sm text-black/55">Cargando producto…</p></section></StoreLayout>
  }

  if (loadState === 'not-found') {
    return <StoreLayout><section className="mx-auto flex w-full max-w-[1000px] flex-1 flex-col items-center justify-center px-6 py-20 text-center"><h1 className="font-poppins text-3xl text-[#466729]">No encontramos ese producto</h1><a href="/tienda/productos" className="mt-6 font-poppins text-[#466729] underline">Volver a productos</a></section></StoreLayout>
  }

  if (loadState === 'error' || !product) {
    return <StoreLayout><section className="mx-auto flex w-full max-w-[1000px] flex-1 flex-col items-center justify-center px-6 py-20 text-center"><p role="alert" className="font-poppins text-sm text-red-800">No pudimos cargar el producto. Revisá tu conexión e intentá nuevamente.</p><button type="button" onClick={() => setRetryCount((count) => count + 1)} className="mt-5 rounded-full border border-[#466729] px-5 py-2 font-poppins text-sm text-[#466729]">Reintentar</button><a href="/tienda/productos" className="mt-4 font-poppins text-sm text-[#466729] underline">Volver a productos</a></section></StoreLayout>
  }

  return (
    <StoreLayout>
      <main className="mx-auto w-full max-w-[1100px] flex-1 px-6 py-10 sm:px-10 sm:py-16">
        <a href={product.categoria?.slug ? `/tienda/productos?categoria=${encodeURIComponent(product.categoria.slug)}` : '/tienda/productos'} className="inline-flex items-center gap-2 font-poppins text-sm text-[#466729] transition-colors hover:text-[#F13107]">
          <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Volver a productos
        </a>
        <section className="mx-auto mt-8 grid w-full max-w-[1000px] grid-cols-1 items-start gap-8 sm:grid-cols-2 sm:gap-14">
          <ProductGallery images={product.imagenes} localFallbackImages={getLocalProductImages(product.slug)} selectedImageId={visibleImageId} onSelect={setSelectedImageId} productName={product.nombre} />

          <div className="flex flex-col items-start">
            {product.categoria?.slug && <a href={`/tienda/productos?categoria=${encodeURIComponent(product.categoria.slug)}`} className="font-poppins text-xs font-medium text-[#7A42A7] underline">{product.categoria.nombre}</a>}
            <h1 className="mt-2 font-poppins text-[28px] font-medium text-black/80 sm:text-[36px]">{product.nombre}</h1>
            <p aria-live="polite" className="mt-4 min-h-8 font-poppins text-[22px] text-black/80">{price === null ? 'Precio no disponible' : formatARS(price)}</p>
            <div className="mt-5 w-full">
              <h2 className="font-poppins text-lg font-medium text-[#466729]">Descripción</h2>
              <p className="mt-3 whitespace-pre-line font-poppins text-sm leading-6 text-black/75">{product.descripcion}</p>
            </div>

            {groups.length > 0 ? <div className="mt-7 flex w-full flex-col gap-5">
              {groups.map(({ nombre, valores }) => (
                <fieldset key={nombre} className="min-w-0">
                  <legend className="mb-3 font-poppins text-sm font-medium text-black/75">{nombre}{attributes[nombre] ? `: ${attributes[nombre]}` : ''}</legend>
                  <div className="flex flex-wrap gap-2">
                    {valores.map((value) => {
                      const isSelected = attributes[nombre] === value
                      const candidates = product.variantes.filter((variant) => (variant.valores || []).some((entry) => entry.atributo === nombre && entry.valor === value))
                      const allUnavailable = candidates.length > 0 && candidates.every((variant) => variantStock(variant) === 0)
                      return <button key={value} type="button" aria-pressed={isSelected} disabled={!candidates.length} onClick={() => chooseAttribute(nombre, value)} className={`min-h-10 rounded-[9px] border px-4 py-2 font-poppins text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#466729] disabled:cursor-not-allowed disabled:opacity-40 ${isSelected ? 'border-[#466729] bg-[#466729] text-white' : 'border-[#466729]/35 bg-white text-black/75 hover:border-[#466729]'}`}>
                        {value}{allUnavailable ? ' · Sin stock' : ''}
                      </button>
                    })}
                  </div>
                </fieldset>
              ))}
            </div> : <p className="mt-7 font-poppins text-sm text-black/65">Este producto no tiene opciones de variante.</p>}

            {groups.length > 0 && !selectedVariant && <p role="status" className="mt-4 rounded-lg bg-[#AF71DD]/10 p-3 font-poppins text-sm text-[#69428A]">Esa combinación no está disponible. Elegí otra opción.</p>}
            {selectedVariant && <div aria-live="polite" className="mt-5 w-full rounded-xl bg-white px-4 py-3">
              {selectedStock === null ? <p className="font-poppins text-sm text-[#9A6500]">No podemos confirmar la disponibilidad de esta variante.</p>
                : selectedStock === 0 || selectedVariant.agotada ? <p className="font-poppins text-sm font-medium text-[#B42318]">Sin stock</p>
                  : <p className="font-poppins text-sm text-[#466729]">Disponible: {selectedStock}</p>}
            </div>}

            {groups.some(({ nombre }) => nombre.toLocaleLowerCase('es').includes('talle')) && <p className="mt-3 font-poppins text-xs leading-5 text-black/60">Para consultar medidas, <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className="underline transition-colors hover:text-[#F13107]">escribinos por Instagram</a>.</p>}

            <div className="mt-6 w-full max-w-[240px]">
              <label htmlFor="product-quantity" className="mb-2 block font-poppins text-sm text-black/70">Cantidad</label>
              <div className="flex h-11 items-center rounded-[9px] border border-[#466729]/35 bg-white">
                <button type="button" aria-label="Restar una unidad" disabled={!selectedVariant || quantity <= 1} onClick={() => setQuantity((current) => Math.max(1, Number(current) - 1))} className="flex h-full w-11 items-center justify-center text-[#466729] disabled:opacity-35"><Minus aria-hidden="true" size={16} /></button>
                <input id="product-quantity" type="number" inputMode="numeric" min="1" max={selectedStock ?? undefined} step="1" value={quantity} onChange={(event) => handleQuantity(event.target.value)} onBlur={() => { if (!Number.isSafeInteger(quantity) || quantity < 1) setQuantity(1) }} disabled={!selectedVariant || selectedStock === null || selectedStock === 0} aria-describedby="quantity-help" className="h-full min-w-0 flex-1 bg-transparent text-center font-poppins text-sm text-[#292621] outline-none disabled:opacity-50" />
                <button type="button" aria-label="Sumar una unidad" disabled={selectedStock === null || !Number.isSafeInteger(quantity) || quantity >= selectedStock} onClick={() => setQuantity((current) => Math.min(selectedStock, Number(current) + 1))} className="flex h-full w-11 items-center justify-center text-[#466729] disabled:opacity-35"><Plus aria-hidden="true" size={16} /></button>
              </div>
              <p id="quantity-help" className="mt-2 font-poppins text-xs text-black/50">Máximo según disponibilidad actual.</p>
            </div>

            <button type="button" onClick={handleAddToCart} disabled={!canAddToCart} className="mt-7 inline-flex min-h-12 w-full max-w-[280px] items-center justify-center gap-3 rounded-[10px] bg-[#AF71DD] px-5 font-poppins text-sm font-medium text-[#FFF8E9] transition-colors hover:bg-[#9b58cc] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#466729] disabled:cursor-not-allowed disabled:bg-[#AF71DD]/40 disabled:text-black/45">
              <span>{selectedStock === 0 ? 'Sin stock' : 'Agregar al carrito'}</span><ShoppingCart aria-hidden="true" className="h-4 w-4" />
            </button>
            {cartConfirmation && <p role="status" className="mt-3 font-poppins text-sm text-[#466729]">{cartConfirmation}</p>}
          </div>
        </section>
      </main>
    </StoreLayout>
  )
}

export default ProductDetailPage
