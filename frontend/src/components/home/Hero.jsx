import { useEffect, useRef, useState } from 'react'
import garabatoLila from '../../assets/brand/svgMagui/garabato-lila.svg'
import ondasLila from '../../assets/brand/herosvg/ondas-lila.svg'
import circuloNaranja from '../../assets/brand/svgMagui/circulo-naranja.svg'
import BtnAction from '../disenio/btn-action'

function Hero() {
  const sectionOneRef = useRef(null)
  const [sectionOneVisible, setSectionOneVisible] = useState(false)

  useEffect(() => {
    const section = sectionOneRef.current
    if (!section) return

    if (!('IntersectionObserver' in window)) {
      setSectionOneVisible(true)
      return
    }

    const observer = new IntersectionObserver(([entry]) => {
      setSectionOneVisible(entry.isIntersecting)
    }, { threshold: 0.1 })

    observer.observe(section)
    return () => observer.disconnect()
  }, [])

  return (
    <div id="inicio" className="w-full overflow-x-clip bg-[#FFF8E9]">
      <section
        id="hero-section-1"
        ref={sectionOneRef}
        aria-label="Presentación"
        className={`hero-appearance ${sectionOneVisible ? 'is-visible' : ''} relative z-10 flex min-h-[400px] w-full flex-col items-stretch overflow-hidden bg-[#FFF8E9] px-6 py-9 sm:min-h-[440px] sm:px-10 lg:block lg:h-[527px] lg:min-h-0 lg:overflow-visible lg:p-0`}
      >
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 hidden overflow-hidden lg:block">
          <img
            src={circuloNaranja}
            alt=""
            className="absolute left-[500px] top-[350px] h-[683.45px] w-[810.15px] max-w-none rotate-[917.53deg] opacity-40 select-none"
          />
        </div>
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden lg:hidden">
          <img
            src={ondasLila}
            alt=""
            className="hero-lilac-responsive absolute right-[-175px] top-[-80px] h-[300px] w-[360px] max-w-none opacity-80 select-none"
          />
          <img
            src={garabatoLila}
            alt=""
            className="absolute left-[-100px] top-[-40px] h-[282px] w-[250px] max-w-none origin-center rotate-[-90deg] select-none"
          />
          <img
            src={circuloNaranja}
            alt=""
            className="absolute left-[130px] top-[320px] h-[340px] w-[400px] max-w-none rotate-[917.53deg] opacity-40 select-none"
          />
        </div>
        <img
          src={ondasLila}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute right-[-220px] top-[-170px] z-0 hidden h-[662.228px] w-[797.72px] max-w-none select-none lg:block"
        />
        <p className="relative z-10 mx-auto max-w-full text-center text-[15px] font-scripter font-normal leading-normal text-[#F2380F] lg:absolute lg:left-[260.36px] lg:top-[79.1px] lg:mx-0 lg:text-left lg:text-2xl">
          Una respuesta solidaria
        </p>
        <h1 className="relative z-10 mt-3 text-center font-scripter text-[clamp(46px,13vw,108px)] font-normal leading-none text-[#466729] lg:absolute lg:left-[243.01px] lg:top-[148.17px] lg:mt-0 lg:text-left lg:text-[95px]">
          OLLA VEGANA
        </h1>
        <p className="relative z-10 mt-6 w-full self-center font-poppins text-[13px] font-light leading-relaxed text-black/80 sm:max-w-[499px] sm:text-[18px] lg:absolute lg:left-[251.9px] lg:top-[270.93px] lg:mt-0 lg:h-[120px] lg:w-[499.21px] lg:leading-normal">
          Somos una organización sin fines de lucro que<br className="hidden lg:block" />{' '}
          garantiza alimento a casi 700 personas cada semana.<br className="hidden lg:block" />{' '}
          Unimos la asistencia alimentaria con la ética<br className="hidden lg:block" />{' '}
          antiespecista, ofreciendo platos llenos y libres de<br className="hidden lg:block" />{' '}
          crueldad.
        </p>
        <BtnAction
          href="/nosotros"
          responsive
          width="154px"
          height="48px"
          className="relative z-10 mt-6 self-center lg:absolute lg:left-[243px] lg:top-[430.93px] lg:mt-0 lg:self-auto"
        >
          Saber más
        </BtnAction>
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden overflow-hidden lg:block">
          <img
            src={garabatoLila}
            alt=""
            className="absolute left-[-40px] top-[-20px] h-[486px] w-[430px] max-w-none origin-center rotate-[-100deg] select-none"
          />
        </div>
      </section>
    </div>
  )
}

export default Hero
