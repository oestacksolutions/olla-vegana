import { useState } from 'react'
import { ShoppingCart } from 'lucide-react'
import BtnAction from '../disenio/btn-action'

function ProductCard({ id, name, price, image, alt, imageFit = 'cover', colorVariants = [] }) {
  const [selectedVariant, setSelectedVariant] = useState(colorVariants[0])
  const displayedImage = selectedVariant?.image || image

  return (
    <article id={id} className="flex h-full w-[180px] shrink-0 flex-col items-center">
      <div className="h-[259px] w-full overflow-hidden rounded-[20px] bg-[#FFF8E9]">
        <img
          src={displayedImage}
          alt={selectedVariant ? `${alt}, color ${selectedVariant.label.toLowerCase()}` : alt}
          className={`h-full w-full ${imageFit === 'contain' ? 'object-contain' : 'object-cover'}`}
        />
      </div>
      <h3 className="mt-3 h-[48px] w-full text-left font-poppins text-[16px] font-normal leading-6 text-black/80">{name}</h3>
      <p className="mt-1 w-full text-left font-poppins text-[16px] font-normal text-black/80">
        ${price.toLocaleString('es-AR')}
      </p>
      <BtnAction
        href="#carrito"
        width="100%"
        height="44px"
        className="mt-4 self-center !gap-2 !rounded-[10px] !font-light !text-[13px]"
      >
        <span>Agregar al carrito</span>
        <ShoppingCart aria-hidden="true" className="h-4 w-4 shrink-0" />
      </BtnAction>
      {colorVariants.length > 0 ? (
        <div className="mt-4 flex items-center gap-2" aria-label="Colores disponibles">
          {colorVariants.map((variant) => (
            <button
              key={variant.label}
              type="button"
              aria-label={`Elegir color ${variant.label}`}
              aria-pressed={selectedVariant?.label === variant.label}
              onClick={() => setSelectedVariant(variant)}
              className={`h-5 w-5 rounded-[10px] border-2 transition-transform ${selectedVariant?.label === variant.label ? 'scale-110 border-[#466729]' : 'border-black/20'}`}
              style={{ backgroundColor: variant.color }}
            />
          ))}
        </div>
      ) : <div aria-hidden="true" className="mt-4 h-6" />}
    </article>
  )
}

export default ProductCard
