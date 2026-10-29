import { useState } from 'react'
import { ShoppingCart } from 'lucide-react'
import fallbackImage from '../../assets/png/logo_olla_vegana.png'
import { addStoreCartItem } from '../../data/storeCart'
import { directCardVariant } from '../../utils/catalogUi'

function ProductCard({ id, slug, name, price, image, localImage, localAlt, alt, agotado, varianteDirecta, animationIndex = 0 }) {
  const [added, setAdded] = useState(false)
  const [addFailed, setAddFailed] = useState(false)
  const href = `/tienda/${encodeURIComponent(slug || id)}`
  const directVariant = directCardVariant({ varianteDirecta, price })
  const outOfStock = agotado === true || (varianteDirecta && varianteDirecta.agotada === true)

  const addSingleVariant = () => {
    if (!directVariant || !id || !slug || outOfStock) return
    const result = addStoreCartItem({
      productId: id,
      productSlug: slug,
      variantId: directVariant.id,
      name,
      price: directVariant.price,
      quantity: 1,
      variant: 'Única',
      attributes: [],
      stockDisponible: directVariant.stockDisponible,
      image: image || fallbackImage,
    })
    if (!result.ok) {
      setAddFailed(true)
      window.setTimeout(() => setAddFailed(false), 2600)
      return
    }
    setAddFailed(false)
    setAdded(true)
    window.setTimeout(() => setAdded(false), 2200)
  }

  return (
    <article id={id} style={{ animationDelay: `${Math.min(animationIndex, 4) * 70}ms` }} className="product-card-enter flex h-full w-[180px] shrink-0 flex-col items-center">
      <a href={href} aria-label={`Ver detalle de ${name}`} className="group block h-[259px] w-full overflow-hidden rounded-[20px] bg-[#FFF8E9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#466729]">
        <img
          src={image || fallbackImage}
          alt={alt || `Imagen de ${name} no disponible`}
          onError={(event) => {
            if (!event.currentTarget.dataset.localFallbackAttempted && localImage && event.currentTarget.getAttribute('src') !== localImage) {
              event.currentTarget.dataset.localFallbackAttempted = 'true'
              event.currentTarget.src = localImage
              event.currentTarget.alt = localAlt || `Imagen de ${name}`
              return
            }
            if (event.currentTarget.dataset.fallbackAttempted) {
              event.currentTarget.hidden = true
              return
            }
            event.currentTarget.dataset.fallbackAttempted = 'true'
            event.currentTarget.src = fallbackImage
          }}
          className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.035] motion-reduce:transition-none"
        />
      </a>
      <h3 className="mt-3 h-[48px] w-full text-left font-poppins text-[16px] font-normal leading-6 text-black/80">
        <a href={href} className="transition-colors hover:text-[#F13107]">{name}</a>
      </h3>
      <p className="mt-1 w-full text-left font-poppins text-[16px] font-normal text-black/80">
        ${price.toLocaleString('es-AR')}
      </p>
      {outOfStock ? (
        <button type="button" disabled className="mt-4 inline-flex h-[44px] w-full cursor-not-allowed items-center justify-center rounded-[10px] bg-[#AF71DD]/40 px-4 font-poppins text-[13px] font-medium text-black/50" aria-label={`${name}: Sin stock`}>
          Sin stock
        </button>
      ) : directVariant ? (
        <button type="button" onClick={addSingleVariant} className="mt-4 inline-flex h-[44px] w-full items-center justify-center gap-2 rounded-[10px] bg-[#AF71DD] px-3 font-poppins text-[13px] font-light text-[#FFF8E9] transition-colors hover:bg-[#AF71DD]/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#466729]">
          <ShoppingCart aria-hidden="true" className="h-4 w-4 shrink-0" /><span>{added ? 'Añadido al carrito' : addFailed ? 'No se pudo agregar' : 'Añadir al carrito'}</span>
        </button>
      ) : (
        <a href={href} className="mt-4 inline-flex h-[44px] w-full items-center justify-center gap-2 rounded-[10px] bg-[#AF71DD] px-3 font-poppins text-[13px] font-light text-[#FFF8E9] transition-colors hover:bg-[#AF71DD]/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#466729]">
          <ShoppingCart aria-hidden="true" className="h-4 w-4 shrink-0" /><span>Añadir al carrito</span>
        </a>
      )}
      {(added || addFailed) && <span role="status" className="sr-only">{added ? `${name} agregado al carrito` : `No se pudo agregar ${name} al carrito`}</span>}
      <div aria-hidden="true" className="mt-4 h-6" />
    </article>
  )
}

export default ProductCard
