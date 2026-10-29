import BtnAction from '../disenio/btn-action'
import fallbackImage from '../../assets/png/logo_olla_vegana.png'

function ProductCard({ id, name, price, image, alt, agotado, animationIndex = 0 }) {
  return (
    <article id={id} style={{ animationDelay: `${Math.min(animationIndex, 4) * 70}ms` }} className="product-card-enter flex h-full w-[180px] shrink-0 flex-col items-center">
      <a href={`/tienda/${id}`} aria-label={`Ver detalle de ${name}`} className="group block h-[259px] w-full overflow-hidden rounded-[20px] bg-[#FFF8E9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#466729]">
        <img
          src={image || fallbackImage}
          alt={alt || `Imagen de ${name} no disponible`}
          onError={(event) => {
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
        <a href={`/tienda/${id}`} className="transition-colors hover:text-[#F13107]">{name}</a>
      </h3>
      <p className="mt-1 w-full text-left font-poppins text-[16px] font-normal text-black/80">
        ${price.toLocaleString('es-AR')}
      </p>
      <BtnAction
        href={`/tienda/${id}`}
        width="100%"
        height="44px"
        className="mt-4 self-center !gap-2 !rounded-[10px] !font-light !text-[13px]"
      >
        <span>{agotado === true ? 'Ver producto · Agotado' : 'Ver producto'}</span>
      </BtnAction>
      <div aria-hidden="true" className="mt-4 h-6" />
    </article>
  )
}

export default ProductCard
