function CardTiendaSection({ image, title, emphasized = false, imageFit = 'cover', className = '' }) {
  return (
    <article className={`flex w-[180px] shrink-0 cursor-pointer flex-col items-center ${className}`}>
      <div className={`w-full origin-top ${emphasized ? 'store-card-zoom' : 'scale-[0.99]'}`}>
        <div className="h-[259px] w-full overflow-hidden rounded-[20px] bg-[#FFF8E9]">
          <img src={image} alt={title} className={`h-full w-full ${imageFit === 'contain' ? 'object-contain' : 'object-cover'}`} />
        </div>
        <h3 className="mt-3 text-center font-scripter text-[24px] font-normal leading-tight text-black/80 sm:text-[26px]">
          {title}
        </h3>
      </div>
    </article>
  )
}

export default CardTiendaSection
