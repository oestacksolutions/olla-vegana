import { useEffect, useRef, useState } from 'react'
import BtnAction from '../disenio/btn-action'
import CardTiendaSection from '../disenio/Card-tienda-section'
import gorra from '../../assets/brand/svgMagui/gorra.JPG'
import remeras from '../../assets/brand/svgMagui/remeras.jpg'
import tote from '../../assets/brand/svgMagui/tote.JPG'

const storeItems = [
  { title: 'Gorras', image: gorra, imageFit: 'contain' },
  { title: 'Remeras', image: remeras },
  { title: 'Totes', image: tote, imageFit: 'contain' },
]

function Store() {
  const sectionRef = useRef(null)
  const [centerIndex, setCenterIndex] = useState(1)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return

    if (!('IntersectionObserver' in window)) {
      setIsVisible(true)
      return
    }

    const observer = new IntersectionObserver(([entry]) => {
      setIsVisible(entry.isIntersecting)
    }, { threshold: 0.1 })

    observer.observe(section)
    return () => observer.disconnect()
  }, [])

  const moveCarousel = (direction) => {
    setCenterIndex((current) => (current + direction + storeItems.length) % storeItems.length)
  }

  const visibleItems = [
    { item: storeItems[(centerIndex + storeItems.length - 1) % storeItems.length], position: 'left' },
    { item: storeItems[centerIndex], position: 'center' },
    { item: storeItems[(centerIndex + 1) % storeItems.length], position: 'right' },
  ]

  return (
    <section
      ref={sectionRef}
      id="tienda"
      aria-label="Tienda online"
      className={`store-appearance ${isVisible ? 'is-visible' : ''} relative min-h-[806px] w-full overflow-hidden bg-[#FFF8E9] px-6 pt-[90px] sm:px-10`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-[-125px] top-[-50px] z-0 h-[582px] w-[593px] rounded-br-[3000px] rounded-tr-[300px] bg-[#617D48]/50"
      />
      <div className="relative z-10 mx-auto flex w-full max-w-[1100px] flex-col items-center text-center">
        <p className="font-scripter text-[24px] font-normal leading-tight text-[#F13107] sm:text-[28px]">
          Llevá el mensaje con vos
        </p>
        <h2 className="mt-7 font-scripter text-[42px] font-normal leading-[1.05] text-black/80 sm:text-[52px] lg:text-[60px]">
          Visitá nuestra tienda online
        </h2>
        <p className="mt-7 max-w-[620px] font-poppins text-[18px] font-normal leading-relaxed text-black/80">
          Comprando en nuestra tienda no solo te llevás algo increíble, sino que también nos ayudás a que Olla Vegana siga creciendo.
        </p>
        <div className="mt-7">
          <BtnAction href="/tienda">
            Ir a la tienda
          </BtnAction>
        </div>
        <div className="relative mt-12 h-[310px] w-full max-w-[1000px] overflow-hidden sm:mt-14 sm:h-[340px]" aria-label="Productos de la tienda">
          {visibleItems.map(({ item, position }) => {
            const placement = position === 'left'
              ? 'left-1/2 -translate-x-[150%] sm:-translate-x-[165%] lg:-translate-x-[190%]'
              : position === 'right'
                ? 'left-1/2 translate-x-[50%] sm:translate-x-[65%] lg:translate-x-[90%]'
                : 'left-1/2 -translate-x-1/2'

            return (
              <CardTiendaSection
                key={item.title}
                image={item.image}
                title={item.title}
                imageFit={item.imageFit}
                emphasized={position === 'center'}
                className={`absolute top-0 ${placement} ${position === 'center' ? 'z-10' : 'z-0'}`}
              />
            )
          })}
          <button
            type="button"
            aria-label="Producto anterior"
            onClick={() => moveCarousel(-1)}
            className="absolute left-0 top-[88px] z-20 flex h-10 w-10 items-center justify-center rounded-full bg-[#466729] text-white transition-colors hover:bg-[#466729]/80 sm:left-0 sm:top-[100px] sm:h-10 sm:w-10 lg:left-8"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none">
              <path d="m15 18-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Producto siguiente"
            onClick={() => moveCarousel(1)}
            className="absolute right-0 top-[88px] z-20 flex h-10 w-10 items-center justify-center rounded-full bg-[#466729] text-white transition-colors hover:bg-[#466729]/80 sm:right-0 sm:top-[100px] sm:h-10 sm:w-10 lg:right-8"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none">
              <path d="m9 18 6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  )
}

export default Store
