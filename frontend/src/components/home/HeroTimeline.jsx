import { useEffect, useRef, useState } from 'react'
import cara from '../../assets/brand/svgMagui/cara.png'
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
    desktopPosition: 'left-[30%] top-[-115px] -translate-x-1/2',
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
    desktopPosition: 'left-[80%] top-[-115px] -translate-x-1/2',
  },
  {
    date: 'Septiembre 2025-',
    title: 'Rebranding',
    description: 'Renovamos nuestra\nimagen para fortalecer\nnuestro mensaje solidario,\nampliar el alcance\ncomunitario y comunicar\ncon más claridad',
    desktopPosition: 'left-full top-[109px] translate-x-[-90px]',
  },
]

function HeroTimeline() {
  const sectionRef = useRef(null)
  const cowHasPlayedRef = useRef(false)
  const cowElapsedRef = useRef(0)
  const cowNextMilestoneRef = useRef(0)
  const vectorContainerRef = useRef(null)
  const vectorPathRef = useRef(null)
  const cowImageRef = useRef(null)
  const mobileTimelineRef = useRef(null)
  const mobileFirstMarkerRef = useRef(null)
  const mobileLastMarkerRef = useRef(null)
  const [sectionVisible, setSectionVisible] = useState(false)
  const [visibleMilestones, setVisibleMilestones] = useState([false, false, false, false, false])
  const [timelineMarkerPositions, setTimelineMarkerPositions] = useState([])
  const [journeyComplete, setJourneyComplete] = useState(false)
  const [mobileLineBounds, setMobileLineBounds] = useState({ top: 13, height: 0 })

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return

    if (!('IntersectionObserver' in window)) {
      setSectionVisible(true)
      return
    }

    const mobile = window.matchMedia('(max-width: 1023px)').matches
    const observer = new IntersectionObserver(([entry]) => {
      setSectionVisible(entry.isIntersecting)
    }, { threshold: mobile ? 0.05 : 0.15, rootMargin: mobile ? '0px 0px -15% 0px' : '0px' })

    observer.observe(section)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const path = vectorPathRef.current
    if (!path) return

    const pathLength = path.getTotalLength()
    setTimelineMarkerPositions([0, 0.25, 0.5, 0.75].map((progress) => {
      const point = path.getPointAtLength(pathLength * progress)
      return { cx: point.x, cy: point.y }
    }))
  }, [])

  useEffect(() => {
    const timeline = mobileTimelineRef.current
    if (!timeline) return

    const updateLineBounds = () => {
      const firstMarker = mobileFirstMarkerRef.current
      const lastMarker = mobileLastMarkerRef.current
      if (!firstMarker || !lastMarker) return

      const timelineTop = timeline.getBoundingClientRect().top
      const firstBounds = firstMarker.getBoundingClientRect()
      const lastBounds = lastMarker.getBoundingClientRect()
      if (!firstBounds.height || !lastBounds.height) return

      const top = firstBounds.top + firstBounds.height / 2 - timelineTop
      const bottom = lastBounds.top + lastBounds.height / 2 - timelineTop
      setMobileLineBounds({ top, height: Math.max(0, bottom - top) })
    }

    updateLineBounds()
    const observer = 'ResizeObserver' in window ? new ResizeObserver(updateLineBounds) : null
    observer?.observe(timeline)
    window.addEventListener('resize', updateLineBounds)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', updateLineBounds)
    }
  }, [])

  useEffect(() => {
    if (!sectionVisible || !window.matchMedia('(max-width: 1023px)').matches) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisibleMilestones([true, true, true, true, true])
      return
    }

    const timers = timelineEvents.map((_, index) => window.setTimeout(() => {
      setVisibleMilestones((current) => current.map((visible, itemIndex) => visible || itemIndex === index))
    }, index * 800))

    return () => timers.forEach(window.clearTimeout)
  }, [sectionVisible])

  useEffect(() => {
    const container = vectorContainerRef.current
    const path = vectorPathRef.current
    const image = cowImageRef.current
    if (!sectionVisible || cowHasPlayedRef.current || !container || !path || !image) return
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

      image.style.left = `${point.x * scaleX - 36}px`
      image.style.top = `${point.y * (container.clientHeight / 90) - 36}px`

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
  }, [sectionVisible])

  return (
    <>
      <div className="relative z-20 w-full bg-[#FFF8E9] px-6 pb-6 pt-8 lg:px-8 lg:pb-8 lg:pt-8">
        <h2 id="journey-title" style={{ top: '20px' }} className="hero-title-slide-in is-visible relative mx-auto text-center font-scripter text-[24px] font-normal leading-none text-[#F13107] lg:ml-[max(12%,180px)] lg:mr-0 lg:text-left lg:text-[32px]">
          Nuestro camino
        </h2>
      </div>
      <section
        ref={sectionRef}
        aria-labelledby="journey-title"
        className="relative isolate w-full overflow-hidden bg-[#617D48]/50 px-6 pb-8 pt-20 lg:h-[500px] lg:px-8 lg:pb-0 lg:pt-0"
      >
      <svg aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[70px] w-full lg:h-[100px]" viewBox="0 0 1440 100" preserveAspectRatio="none">
        <path d="M0 0 H1440 V48 C1380 48 1320 62 1260 62 C1160 62 1080 43 980 43 C880 43 800 63 700 63 C600 63 520 43 420 43 C320 43 240 62 160 62 C100 62 50 50 0 48 Z" fill="white" />
      </svg>
      <div ref={mobileTimelineRef} className="relative z-10 mx-auto max-w-[420px] lg:hidden">
        <svg aria-hidden="true" className="pointer-events-none absolute left-[5px] w-[24px] overflow-visible" style={{ top: mobileLineBounds.top, height: mobileLineBounds.height }} viewBox="0 0 24 1000" preserveAspectRatio="none">
          <path d="M12 0 V1000" fill="none" stroke="#617D48" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        <div className="relative flex flex-col gap-4">
          {timelineEvents.map((event, index) => (
            <div key={event.date} className="relative pl-[42px]">
              <span
                aria-hidden="true"
                ref={index === 0 ? mobileFirstMarkerRef : index === timelineEvents.length - 1 ? mobileLastMarkerRef : undefined}
                className="absolute left-[11px] top-[13px] h-[12px] w-[12px] -translate-y-1/2 rounded-full border-[2px] border-[#617D48] bg-[#617D48]"
              />
              <TimelineMilestone {...event} responsive visible={visibleMilestones[index]} />
            </div>
          ))}
        </div>
      </div>
      <div
        ref={vectorContainerRef}
        className="pointer-events-none absolute left-1/2 top-[calc(52%-11px)] z-[1] hidden h-[70px] min-w-[240px] w-[calc(90%_-_560px)] max-w-[1280px] -translate-x-1/2 -translate-y-1/2 lg:block"
      >
        <svg viewBox="0 0 1536 90" aria-hidden="true" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
          <path
            ref={vectorPathRef}
            d="M 0 4 C 110 3, 175 45, 290 51 C 430 60, 540 45, 625 25 C 730 2, 830 12, 925 48 C 1015 84, 1090 84, 1205 82 C 1320 82, 1435 78, 1536 77"
            fill="none"
            stroke="#617D48"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.9"
          />
        </svg>
        {timelineMarkerPositions.map(({ cx, cy }, index) => (
          <span
            key={index}
            style={{ left: `${(cx / 1536) * 100}%`, top: `${(cy * 70) / 90}px` }}
            className="absolute z-10 h-[13px] w-[13px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[2px] border-[#617D48] bg-[#FFF8E9]"
          />
        ))}
        <span className={`timeline-arrival absolute left-full top-[60px] h-[13px] w-[13px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[2px] border-[#617D48] bg-[#FFF8E9] ${journeyComplete ? 'is-complete' : ''}`} />
        <img src={cara} alt="" ref={cowImageRef} className="absolute left-[-36px] top-[-33px] z-20 h-[72px] w-[72px] object-contain" />
        {timelineEvents.map((event, index) => (
          <TimelineMilestone
            key={event.date}
            {...event}
            visible={visibleMilestones[index]}
            className={`absolute z-10 ${event.desktopPosition}`}
          />
        ))}
      </div>
      </section>
    </>
  )
}

export default HeroTimeline
