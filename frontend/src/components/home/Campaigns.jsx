import flores from '../../assets/png/flores.png'
import { useEffect, useRef, useState } from 'react'
import instagramIcon from '../../assets/png/instagram-icon.png'

// Importación de los íconos para cada campaña
import libroIcon from '../../assets/png/libro.png'
import manoIcon from '../../assets/png/mano-icon.png'
import arbolIcon from '../../assets/png/arbol-icon.png'
import regaloIcon from '../../assets/png/regalo-icon.png'
import kitsEscolaresImage from '../../assets/jpg/kits-escolares.jpg'
import campInviernoImage from '../../assets/jpg/camp-invierno.jpg'
import navidadSolidariaImage from '../../assets/jpg/navidad-solidaria.jpg'
import diaNinezImage from '../../assets/jpg/dia-ninez.jpg'

const campaigns = [
  { title: 'KITS ESCOLARES', color: 'bg-[#AF71DD]/80', icon: libroIcon, image: kitsEscolaresImage, href: 'https://www.instagram.com/reel/DWIBQ-TDgyB/' },
  { title: 'CAMPAÑA DE INVIERNO', color: 'bg-[#686868]/80', icon: manoIcon, image: campInviernoImage, href: 'https://www.instagram.com/reel/DXfscmvukm6/' },
  { title: 'NAVIDAD SOLIDARIA', color: 'bg-[#466729]/80', icon: arbolIcon, image: navidadSolidariaImage, href: 'https://www.instagram.com/p/DS0dvQuDslE/?hl=es' },
  { title: 'DÍA DE LA NIÑEZ', color: 'bg-[#F13107]/80', icon: regaloIcon, image: diaNinezImage, href: 'https://www.instagram.com/reel/DayWIK_pXe9/' },
]

function Campaigns() {
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
    }, { threshold: 0.1 })

    observer.observe(section)
    return () => observer.disconnect()
  }, [])

  return (
    <section
      ref={sectionRef}
      id="campanas"
      className={`store-appearance ${isVisible ? 'is-visible' : ''} relative w-full overflow-hidden bg-[#FFF8E9] px-6 py-16 sm:px-10 lg:min-h-[760px] lg:px-0 lg:py-16`}
    >
      {/* ILUSTRACIÓN DE FLORES (Alineada al costado de las tarjetas) */}
      <img
        src={flores}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute right-[-80px] top-[66%] z-0 hidden w-[210px] -translate-y-1/2 -rotate-12 object-contain opacity-50 lg:block lg:right-[-30px] lg:w-[260px] xl:right-[-65px] xl:w-[335px]"
      />

      {/* CONTENIDO PRINCIPAL CENTRADO */}
      <div className="relative z-10 mx-auto flex max-w-[1200px] flex-col items-center text-center">
        {/* Encabezados */}
        <div className="w-full max-w-[760px]">
          <p className="font-scripter text-[28px] leading-[36px] text-[#F13107]">
            Una comunidad que se mueve
          </p>
          <h2 className="mt-[30px] font-scripter text-[52px] leading-[1.05] text-black/80 lg:text-[60px]">
            CONOCÉ NUESTRAS CAMPAÑAS
          </h2>
          <p className="mx-auto mt-[16px] max-w-[592px] font-sans text-[13px] leading-[1.25] text-black/80 lg:text-[16px]">
            Cada campaña es una oportunidad para acompañar, compartir y
            transformar realidades. Conocé las iniciativas que construimos en
            comunidad.
          </p>
        </div>

        <div className="mt-8 grid w-full max-w-[800px] grid-cols-1 gap-6 sm:grid-cols-2 lg:hidden">
          {campaigns.map((campaign) => (
            <article key={campaign.title} className="flex flex-col items-center gap-3">
              <a href={campaign.href} target="_blank" rel="noreferrer" className={`flex h-[36px] w-fit min-w-[130px] items-center justify-center gap-2 rounded-full px-3 font-scripter text-[11px] uppercase tracking-wide text-white ${campaign.color}`}>
                <img src={campaign.icon} alt="" aria-hidden="true" className="h-4 w-4 object-contain brightness-0 invert" />
                {campaign.title}
              </a>
              <a href={campaign.href} target="_blank" rel="noreferrer" aria-label={`Ver campaña ${campaign.title} en Instagram`} className="group relative block h-[260px] w-full overflow-hidden rounded-[24px] bg-[#D9D9D9]">
                <img src={campaign.image} alt={campaign.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                <span aria-hidden="true" className="absolute inset-x-0 bottom-0 flex h-[58px] items-end justify-between bg-[#FFF8E9]/95 px-3 pb-2 font-sans normal-case text-[#AF71DD]">
                  <span className="flex flex-col items-start text-left">
                    <span className="text-[12px] font-semibold">@olla.vegana</span>
                    <span className="text-[10px]">Ver en Instagram</span>
                  </span>
                  <img src={instagramIcon} alt="" className="mb-1 h-5 w-5 object-contain" />
                </span>
              </a>
            </article>
          ))}
        </div>

        {/* Composición desktop: títulos y tarjetas en filas independientes */}
        <div className="mt-8 hidden h-[57px] w-full max-w-[937px] items-center justify-between lg:flex">
          {campaigns.map((campaign) => (
            <a key={campaign.title} href={campaign.href} target="_blank" rel="noreferrer" className={`flex h-[55px] w-[199px] items-center justify-center gap-2 rounded-[20px] px-3 font-scripter text-[16px] leading-none uppercase tracking-wide text-white ${campaign.color}`}>
              <img src={campaign.icon} alt="" aria-hidden="true" className="relative top-[-1px] block h-[21px] w-[21px] shrink-0 object-contain brightness-0 invert" />
              <span className="inline-flex items-center whitespace-nowrap leading-[21px]">{campaign.title}</span>
            </a>
          ))}
        </div>
        <div className="mt-[35px] hidden w-full max-w-[1077px] justify-between lg:flex">
          {campaigns.map((campaign) => (
            <a key={campaign.title} href={campaign.href} target="_blank" rel="noreferrer" aria-label={`Ver campaña ${campaign.title} en Instagram`} className="group relative block h-[314px] w-[240px] overflow-hidden rounded-[20px] bg-[#D9D9D9]">
              <img src={campaign.image} alt={campaign.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
              <span aria-hidden="true" className="absolute inset-x-0 bottom-0 flex h-[58px] items-end justify-between bg-[#FFF8E9]/95 px-3 pb-2 font-sans normal-case text-[#AF71DD]">
                <span className="flex flex-col items-start text-left">
                  <span className="text-[12px] font-semibold">@olla.vegana</span>
                  <span className="text-[10px]">Ver en Instagram</span>
                </span>
                <img src={instagramIcon} alt="" className="mb-1 h-5 w-5 object-contain" />
              </span>
            </a>
          ))}
        </div>

        {/* Botón inferior a Instagram */}
        <a
          href="https://www.instagram.com/olla.vegana/"
          target="_blank"
          rel="noreferrer"
          className="relative z-10 mt-8 inline-flex h-[46px] lg:mt-[82px] w-full max-w-[400px] items-center justify-center gap-[10px] rounded-[30px] bg-[#AF71DD] px-5 font-sans text-[14px] font-semibold text-[#FFF8E9] transition-all duration-300 hover:bg-[#9b58cc]"
        >
          <img src={instagramIcon} alt="" aria-hidden="true" className="h-5 w-5 object-contain" />
          Seguinos en nuestras redes!
        </a>
      </div>
    </section>
  )
}

export default Campaigns





















