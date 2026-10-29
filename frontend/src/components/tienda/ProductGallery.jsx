import { useRef } from 'react'
import fallbackImage from '../../assets/png/logo_olla_vegana.png'
import { orderedImages, primaryImage } from '../../utils/catalogUi'

function ProductGallery({ images = [], localFallbackImages = [], selectedImageId, onSelect, productName }) {
  const thumbnails = orderedImages(images)
  const thumbnailRefs = useRef([])
  const selected = thumbnails.find((image) => String(image.id) === String(selectedImageId))
    || primaryImage(thumbnails)
  const mainImage = selected?.url || fallbackImage
  const mainAlt = selected?.textoAlternativo || (selected ? productName : `Imagen de ${productName} no disponible`)
  const localPrimary = primaryImage(localFallbackImages)?.url

  const recoverImage = (event, localUrl, localAlt) => {
    const image = event.currentTarget
    if (!image.dataset.localFallbackAttempted && localUrl && image.getAttribute('src') !== localUrl) {
      image.dataset.localFallbackAttempted = 'true'
      image.src = localUrl
      if (localAlt) image.alt = localAlt
      return
    }
    if (image.dataset.logoFallbackAttempted) {
      image.hidden = true
      return
    }
    image.dataset.logoFallbackAttempted = 'true'
    image.src = fallbackImage
    image.alt = `Logo de Olla Vegana; imagen de ${productName} no disponible`
  }

  const handleThumbnailKeyDown = (event, index) => {
    let nextIndex
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (index + 1) % thumbnails.length
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (index - 1 + thumbnails.length) % thumbnails.length
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = thumbnails.length - 1
    if (nextIndex === undefined) return
    event.preventDefault()
    thumbnailRefs.current[nextIndex]?.focus()
    onSelect(thumbnails[nextIndex].id)
  }

  return (
    <section aria-label={`Fotografías de ${productName}`} className="w-full">
      <div className="mx-auto h-[380px] w-full max-w-[360px] overflow-hidden rounded-[20px] bg-[#FFF8E9] sm:sticky sm:top-8 sm:h-[480px] sm:max-w-none">
        <img src={mainImage} alt={mainAlt} onError={(event) => recoverImage(event, localPrimary, primaryImage(localFallbackImages)?.textoAlternativo)} className="h-full w-full object-cover" />
      </div>
      {thumbnails.length > 1 && <div role="group" aria-label="Elegir fotografía" className="mx-auto mt-4 flex max-w-full gap-3 overflow-x-auto pb-2 sm:justify-start">
        {thumbnails.map((image, index) => (
          <button
            key={image.id}
            ref={(node) => { thumbnailRefs.current[index] = node }}
            type="button"
            aria-label={image.textoAlternativo || `Fotografía ${index + 1} de ${thumbnails.length}`}
            aria-pressed={String(image.id) === String(selected?.id)}
            onClick={() => onSelect(image.id)}
            onKeyDown={(event) => handleThumbnailKeyDown(event, index)}
            className={`h-20 w-16 shrink-0 overflow-hidden rounded-lg border-2 bg-[#FFF8E9] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#466729] ${String(image.id) === String(selected?.id) ? 'border-[#466729]' : 'border-[#AF71DD]/30 hover:border-[#AF71DD]'}`}
          >
            <img src={image.url || fallbackImage} alt="" aria-hidden="true" onError={(event) => recoverImage(event, localFallbackImages[index]?.url || localPrimary, localFallbackImages[index]?.textoAlternativo)} className="h-full w-full object-cover" />
          </button>
        ))}
      </div>}
    </section>
  )
}

export default ProductGallery
