import { useEffect, useRef, useState } from 'react'
import garabatoLila from '../../assets/brand/svgMagui/garabato-lila.svg'
import ondasLila from '../../assets/brand/herosvg/ondas-lila.svg'
import circuloNaranja from '../../assets/brand/svgMagui/circulo-naranja.svg'
import cara from '../../assets/brand/svgMagui/cara.png'
import BtnAction from '../disenio/btn-action'
import TimelineMilestone from './TimelineMilestone'

const timelineEvents = [
  {
    date: 'Julio 2019-',
    title: 'Creación',
    description: 'Nos separamos de “Healt\nSave” y nos unimos\ncomo “Olla Vegana” en\nMorón como punto\ninicial',
    desktopPosition: 'left-[-40px] top-[45px]',
  },
  {
    date: 'Octubre 2022-',
    title: 'Ramos Mejía',
    description: 'Se abre un nuevo punto\nen Ramos Mejia,\nsumandose al ya\nexistente en Morón',
    desktopPosition: 'left-[30%] top-[-145px] -translate-x-1/2',
  },
  {
    date: 'Marzo 2024-',
    title: 'Moreno',
    description: 'Se suma a Morón y\nRamos Mejia, un nuevo\npunto en la localidad de\nMoreno',
    desktopPosition: 'left-[55%] top-[55px] -translate-x-1/2',
  },
  {
    date: 'Mayo 2024-',
    title: 'Reestructuración',
    description: 'Se agrando el grupo de\norganizadores,\ndiversificamos voces.\nEsta transformación marcó\nel inicio de una etapa más\nsólida y sostenible.',
    desktopPosition: 'left-[80%] top-[-135px] -translate-x-1/2',
  },
  {
    date: 'Septiembre 2025-',
    title: 'Rebranding',
    description: 'Renovamos nuestra\nimagen para fortalecer\nnuestro mensaje solidario,\nampliar el alcance\ncomunitario y comunicar\ncon más claridad',
    desktopPosition: 'left-full top-[119px] translate-x-[-90px]',
  },
]

function Hero() {
  const sectionOneRef = useRef(null)
  const sectionTwoRef = useRef(null)
  const cowHasPlayedRef = useRef(false)
  const cowElapsedRef = useRef(0)
  const cowNextMilestoneRef = useRef(0)
  const vectorContainerRef = useRef(null)
  const vectorPathRef = useRef(null)
  const cowImageRef = useRef(null)
  const [sectionOneVisible, setSectionOneVisible] = useState(false)
  const [sectionTwoVisible, setSectionTwoVisible] = useState(false)
  const [visibleMilestones, setVisibleMilestones] = useState([false, false, false, false, false])
  const [timelineMarkerPositions, setTimelineMarkerPositions] = useState([])
  const [journeyComplete, setJourneyComplete] = useState(false)

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

  useEffect(() => {
    const path = vectorPathRef.current
    if (!path) return

    const pathLength = path.getTotalLength()
    setTimelineMarkerPositions([0, 0.25, 0.5, 0.75].map((progress) => {
      const point = path.getPointAtLength(pathLength * progress)
      return { left: `${(point.x / 1536) * 100}%`, top: `${point.y}px` }
    }))
  }, [])

  useEffect(() => {
    const section = sectionTwoRef.current
    if (!section) return

    if (!('IntersectionObserver' in window)) {
      setSectionTwoVisible(true)
      return
    }

    const mobile = window.matchMedia('(max-width: 1023px)').matches
    const observer = new IntersectionObserver(([entry]) => {
      setSectionTwoVisible(entry.isIntersecting)
    }, { threshold: mobile ? 0.05 : 0.15, rootMargin: mobile ? '0px 0px -15% 0px' : '0px' })

    observer.observe(section)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!sectionTwoVisible || !window.matchMedia('(max-width: 1023px)').matches) return

    const timers = timelineEvents.map((_, index) => window.setTimeout(() => {
      setVisibleMilestones((current) => current.map((visible, itemIndex) => visible || itemIndex === index))
    }, index * 800))

    return () => timers.forEach(window.clearTimeout)
  }, [sectionTwoVisible])

  useEffect(() => {
    const container = vectorContainerRef.current
    const path = vectorPathRef.current
    const image = cowImageRef.current
    if (!sectionTwoVisible || cowHasPlayedRef.current || !container || !path || !image) return
    if (window.matchMedia('(max-width: 1023px)').matches) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      cowHasPlayedRef.current = true
      setVisibleMilestones([true, true, true, true, true])
      return
    }

    const duration = 4000
    const pathLength = path.getTotalLength()
    const scaleX = container.clientWidth / 1536
    const milestones = [0.03, 0.25, 0.5, 0.75, 1]
    let animationFrame
    let startedAt

    const animateCow = (timestamp) => {
      if (startedAt === undefined) startedAt = timestamp
      const progress = Math.min((cowElapsedRef.current + timestamp - startedAt) / duration, 1)
      const point = path.getPointAtLength(pathLength * progress)

      image.style.left = `${point.x * scaleX - 60}px`
      image.style.top = `${point.y - 60}px`

      while (cowNextMilestoneRef.current < milestones.length && progress >= milestones[cowNextMilestoneRef.current]) {
        const milestoneIndex = cowNextMilestoneRef.current
        cowNextMilestoneRef.current += 1
        setVisibleMilestones((current) => current.map((visible, index) => index === milestoneIndex || visible))
      }

      if (progress === 1) {
        cowElapsedRef.current = duration
        cowHasPlayedRef.current = true
        setJourneyComplete(true)
      }

      if (progress < 1) animationFrame = window.requestAnimationFrame(animateCow)
    }

    animationFrame = window.requestAnimationFrame(animateCow)
    return () => {
      window.cancelAnimationFrame(animationFrame)
      if (startedAt !== undefined && !cowHasPlayedRef.current) {
        cowElapsedRef.current = Math.min(duration, cowElapsedRef.current + performance.now() - startedAt)
      }
    }
  }, [sectionTwoVisible])

  return (
    <div id="inicio" className="w-full overflow-x-clip bg-[#FFF8E9] lg:min-h-[1427px]">
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
          Somos una organización sin fines de lucro que<br className="hidden lg:block" />
          garantiza alimento a casi 700 personas cada semana.<br className="hidden lg:block" />
          Unimos la asistencia alimentaria con la ética<br className="hidden lg:block" />
          antiespecista, ofreciendo platos llenos y libres de<br className="hidden lg:block" />
          crueldad.
        </p>
        <BtnAction
          href="#propuesta"
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
      <section
        id="hero-section-2"
        ref={sectionTwoRef}
        aria-label="Contenido destacado"
        className="relative min-h-[1250px] w-full overflow-x-clip overflow-y-visible bg-[#FFF8E9] lg:h-[900px] lg:min-h-0"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[50px] bg-[#FFF8E9] lg:h-[245px]"
        />
        <h2 className={`hero-title-slide-in absolute left-1/2 top-[38px] z-10 -translate-x-1/2 whitespace-nowrap font-scripter text-[28px] font-normal leading-none text-[#F13107] lg:left-[239px] lg:top-[96px] lg:translate-x-0 lg:text-[32px] ${sectionTwoVisible ? 'is-visible' : ''}`}>
          Nuestro camino
        </h2>
        <svg aria-hidden="true" className="pointer-events-none absolute inset-0 hidden h-full w-full lg:block" viewBox="0 0 1440 748" preserveAspectRatio="none">
          <path
            d="M0 155 C60 155 120 175 180 175 C280 175 360 140 460 140 C560 140 640 175 740 175 C840 175 920 140 1020 140 C1120 140 1200 175 1300 175 C1360 175 1400 165 1440 155 L1440 635 C1400 635 1360 650 1300 650 C1200 650 1120 620 1020 620 C920 620 840 650 740 650 C640 650 560 620 460 620 C360 620 280 650 180 650 C120 650 60 635 0 635 Z"
            fill="#617D48"
            fillOpacity="0.5"
          />
          <path d="M0 635 C60 635 120 650 180 650 C280 650 360 620 460 620 C560 620 640 650 740 650 C840 650 920 620 1020 620 C1120 620 1200 650 1300 650 C1360 650 1400 635 1440 635 L1440 748 L0 748 Z" fill="white" />
        </svg>
        <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full lg:hidden" viewBox="0 0 1440 1250" preserveAspectRatio="none">
          <path
            d="M0 92 C120 92 120 104 240 104 C360 104 360 92 480 92 C600 92 600 104 720 104 C840 104 840 92 960 92 C1080 92 1080 104 1200 104 C1320 104 1320 92 1440 92 L1440 1198 C1320 1198 1320 1188 1200 1188 C1080 1188 1080 1198 960 1198 C840 1198 840 1188 720 1188 C600 1188 600 1198 480 1198 C360 1198 360 1188 240 1188 C120 1188 120 1198 0 1198 Z"
            fill="#617D48"
            fillOpacity="0.5"
          />
          <path d="M0 1198 C120 1198 120 1188 240 1188 C360 1188 360 1198 480 1198 C600 1198 600 1188 720 1188 C840 1188 840 1198 960 1198 C1080 1198 1080 1188 1200 1188 C1320 1188 1320 1198 1440 1198 L1440 1250 L0 1250 Z" fill="white" />
        </svg>
        <div
          aria-hidden="true"
          ref={vectorContainerRef}
          className="pointer-events-none absolute left-1/2 top-[calc(50%+18px)] z-[1] hidden h-[90px] min-w-[240px] w-[calc(100%_-_560px)] max-w-[1536px] -translate-x-1/2 -translate-y-1/2 lg:block"
        >
          <svg
            viewBox="0 0 1536 90"
            aria-hidden="true"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
          >
            <path
              ref={vectorPathRef}
              d="M 0 4 C 110 3, 175 45, 290 51 C 430 60, 540 45, 625 25 C 730 2, 830 12, 925 48 C 1015 84, 1090 84, 1205 82 C 1320 82, 1435 78, 1536 77"
              fill="none"
              stroke="#617D48"
              strokeWidth="7"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.9"
            />
          </svg>
          {timelineMarkerPositions.map((position, index) => (
            <span
              key={index}
              style={position}
              className="absolute z-10 h-[15px] w-[15px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-[#617D48] bg-[#617D48]"
            />
          ))}
          <span className={`timeline-arrival absolute left-full top-[77px] h-[15px] w-[15px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-[#617D48] bg-[#617D48] ${journeyComplete ? 'is-complete' : ''}`} />
          <img
            src={cara}
            alt=""
            ref={cowImageRef}
            className="absolute left-[-60px] top-[-56px] z-20 h-[120px] w-[120px] object-contain"
          />
          {timelineEvents.map((event, index) => (
            <TimelineMilestone
              key={event.date}
              {...event}
              visible={visibleMilestones[index]}
              className={`absolute z-10 ${event.desktopPosition}`}
            />
          ))}
        </div>
        <div className="absolute inset-x-0 top-[170px] z-10 lg:hidden">
          <div aria-hidden="true" className="absolute bottom-0 left-[23px] top-0 w-[3px] rounded-full bg-[#617D48]" />
          <div className="relative flex flex-col gap-8">
            {timelineEvents.map((event, index) => (
              <div key={event.date} className="relative pl-[52px]">
                <span aria-hidden="true" className={`absolute left-[17px] h-[15px] w-[15px] -translate-y-1/2 rounded-full border-[3px] border-[#617D48] bg-[#617D48] ${index === 0 ? 'top-0' : 'top-[20.5px]'}`} />
                <TimelineMilestone {...event} responsive visible={visibleMilestones[index]} />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

export default Hero

