import { useEffect, useRef, useState } from 'react'
import BtnAction from '../disenio/btn-action'
import circuloNaranja from '../../assets/brand/svgMagui/circulo-naranja.svg'

function Donaciones() {
  const sectionRef = useRef(null)
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
    }, { threshold: 0.2 })

    observer.observe(section)
    return () => observer.disconnect()
  }, [])

  return (
    <section
      ref={sectionRef}
      id="dona"
      aria-label="Donaciones"
      className="relative isolate min-h-[300px] w-full overflow-hidden bg-[#FFF8E9] px-6 py-8 sm:px-10 lg:min-h-[585px] lg:px-0 lg:py-[10px] xl:h-[585px]"
    >
      <img
        src={circuloNaranja}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute -left-[420px] top-1/2 z-0 mt-10 hidden h-[614.61px] w-[677.78px] max-w-none -translate-y-1/2 rotate-[-55.0deg] opacity-70 select-none lg:block"
      />
      <div aria-hidden="true" className="pointer-events-none absolute left-[1030px] top-[-70px] z-0 hidden h-[513px] w-[518px] rounded-[50%] bg-[#AF71DD]/50 lg:block" />
      <div aria-hidden="true" className="pointer-events-none absolute left-[1112px] top-[310px] z-0 hidden h-[513px] w-[518px] rounded-[50%] bg-[#AF71DD]/50 lg:block" />
      <div className="relative z-10 mx-auto flex w-full max-w-[1120px] flex-col items-center gap-8 text-left xl:min-h-[565px] xl:flex-row xl:items-center xl:justify-center xl:gap-[60px]">
        <div className={`donations-from-left ${isVisible ? 'is-visible' : ''} flex w-full max-w-[460px] flex-col items-start text-left xl:w-[460px] xl:shrink-0 xl:translate-x-4`}>
          <h2 className="font-scripter text-[22px] font-normal leading-tight text-[#F13107] sm:text-[25px] lg:text-[28px]">
            ¿Construimos juntos esta <br></br>
            realidad?
          </h2>
          <h3 className="mt-6 font-scripter text-[48px] font-normal leading-[0.95] text-black/80 sm:text-[54px] lg:text-[60px]">
            seamos el
            <br />
            cambio
          </h3>
          <p className="mt-10 font-scripter text-[20px] font-normal leading-tight text-[#F13107] sm:text-[23px] lg:text-[25px]">
            con poco, nos pueden ayudar mucho.
          </p>
        </div>

        <div className={`donations-from-right ${isVisible ? 'is-visible' : ''} flex w-full max-w-[371px] flex-col items-start`}>
          <div className="h-auto w-full font-poppins text-[16px] font-normal leading-6 text-black/80 sm:h-[264px]">
            <p className="mb-6">
              Pasamos de ser un grupo de vecinos a una<br className="hidden sm:block" /> organización con impacto regional. La<br className="hidden sm:block" /> eficiencia de nuestro equipo y la<br className="hidden sm:block" /> transparencia de nuestra gestión son nuestra<br className="hidden sm:block" /> garantía.
            </p>
            <p>
              No buscamos solo donaciones; buscamos<br className="hidden sm:block" /> aliados que crean en un mundo más justo y<br className="hidden sm:block" /> sin violencia. Ya sea con productos, logística<br className="hidden sm:block" /> o fondos, tu participación es la llave para<br className="hidden sm:block" /> que nuestra olla nunca deje de llenarse.
            </p>
          </div>
          <BtnAction href="/donacion" className="mt-[22px]">
            Quiero Donar
          </BtnAction>
        </div>
      </div>
    </section>
  )
}

export default Donaciones
