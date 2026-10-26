import { useEffect, useRef, useState } from 'react'
import Navbar from '../components/layout/Navbar'
import Footer from '../components/layout/Footer'
import HeroTimeline from '../components/home/HeroTimeline'
import MissionVision from '../components/home/MissionVision'
import integrantes from '../assets/brand/svgMagui/integrantes.JPG'

const teamRoles = [
  { title: 'Organizadores', detail: '6 VOLUNTARIOS', color: 'bg-[#F13107]' },
  { title: 'Coordinadores', detail: '3 VOLUNTARIOS POR PUNTO\n(ROTACIÓN CADA 4 MESES)', color: 'bg-[#466729]' },
  { title: 'Voluntarios', detail: '80 VOLUNTARIOS EN\nTODOS LOS EQUIPOS', color: 'bg-[#AF71DD]' },
]

const foodSlices = [
  { label: 'CARBOHIDRATOS', value: 160, color: '#AF71DD' },
  { label: 'LEGUMBRES', value: 120, color: '#466729' },
  { label: 'VERDURAS', value: 240, color: '#F13107' },
  { label: 'FRUTAS', value: 140, color: '#FFBDD6' },
]

const proposals = [
  'Entregar viandas de comida nutritivas y Plant Based',
  'Entregar frutas, y bebidas frías/calientes',
  'Entregar ropa y zapatillas acorde al clima del momento',
  'Realizar campañas para fechas específicas (inicio de clases, navidad, etc)',
  'Brindar un espacio de escucha y contención',
]

function getPieSlicePath(startAngle, endAngle) {
  const centerX = 220
  const centerY = 180
  const radius = 130
  const toPoint = (angle) => {
    const radians = (angle * Math.PI) / 180
    return {
      x: centerX + radius * Math.cos(radians),
      y: centerY + radius * Math.sin(radians),
    }
  }
  const start = toPoint(startAngle)
  const end = toPoint(endAngle)
  const largeArc = endAngle - startAngle > 180 ? 1 : 0

  return `M ${centerX} ${centerY} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y} Z`
}

function Nosotros() {
  const teamSectionRef = useRef(null)
  const growthChartRef = useRef(null)
  const foodChartRef = useRef(null)
  const proposalCardsRef = useRef(null)
  const [teamVisible, setTeamVisible] = useState(false)
  const [growthChartVisible, setGrowthChartVisible] = useState(false)
  const [foodChartVisible, setFoodChartVisible] = useState(false)
  const [proposalVisible, setProposalVisible] = useState(false)

  useEffect(() => {
    const section = teamSectionRef.current
    if (!section) return

    const observer = new IntersectionObserver(([entry]) => {
      setTeamVisible(entry.isIntersecting)
    }, { threshold: 0.15 })

    observer.observe(section)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const chart = growthChartRef.current
    if (!chart) return

    const observer = new IntersectionObserver(([entry]) => {
      setGrowthChartVisible(entry.isIntersecting)
    }, { threshold: 0.2 })

    observer.observe(chart)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const chart = foodChartRef.current
    if (!chart) return

    const observer = new IntersectionObserver(([entry]) => {
      setFoodChartVisible(entry.isIntersecting)
    }, { threshold: 0.2 })

    observer.observe(chart)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const cards = proposalCardsRef.current
    if (!cards) return

    const observer = new IntersectionObserver(([entry]) => {
      setProposalVisible(entry.isIntersecting)
    }, { threshold: 0.15 })

    observer.observe(cards)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="flex min-h-screen flex-col bg-[#FFF8E9]">
      <Navbar />
      <main className="w-full shrink-0 bg-[#FFF8E9]" aria-label="Nosotros">
        <div className="relative h-[240px] w-full overflow-hidden sm:h-[280px] lg:h-[340px]">
          <img
            src={integrantes}
            alt="Integrantes de Olla Vegana"
            className="absolute inset-0 h-full w-full object-cover object-[center_35%] opacity-50"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[180px] bg-gradient-to-t from-[#FFF8E9]/45 via-[#FFF8E9]/25 to-transparent"
          />
        </div>
        <HeroTimeline />
        <MissionVision cardsOnly />
        <section
          aria-label="Contenido de Nosotros"
          className="relative isolate h-auto w-full overflow-hidden bg-[#FFF8E9] px-6 pb-8 sm:px-8"
        >
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 hidden overflow-hidden lg:block">
            <span
              className={`absolute left-[-230px] top-1/2 h-[620px] w-[620px] -translate-y-1/2 rounded-full bg-[#466729]/50 transition-[transform,opacity] duration-1000 ease-out lg:h-[700px] lg:w-[700px] ${teamVisible ? '-translate-x-1/2 opacity-100' : '-translate-x-[70%] opacity-0'}`}
              style={{ transitionDelay: teamVisible ? '100ms' : '0ms' }}
            />
            <span
              className={`absolute right-[-230px] top-1/2 h-[620px] w-[620px] -translate-y-1/2 rounded-full bg-[#466729]/50 transition-[transform,opacity] duration-1000 ease-out lg:h-[700px] lg:w-[700px] ${teamVisible ? 'translate-x-1/2 opacity-100' : 'translate-x-[70%] opacity-0'}`}
              style={{ transitionDelay: teamVisible ? '300ms' : '0ms' }}
            />
          </div>
          <h1 className="relative z-10 pt-[70px] text-center font-scripter text-[42px] font-normal leading-tight text-[#466729] lg:text-[60px]">
            Nuestro equipo
          </h1>
          <div ref={teamSectionRef} className="relative z-10 mt-8 grid grid-cols-1 items-center gap-8 md:grid-cols-2 md:gap-x-[100px] lg:mt-[70px]">
            <div className="flex flex-col items-center gap-5 md:items-end">
              {teamRoles.map(({ title, detail, color }, index) => (
                <div
                  key={title}
                  className={`flex w-[220px] max-w-full flex-col items-center text-center transition-all duration-700 ease-out md:items-start md:text-left ${teamVisible ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0'}`}
                  style={{ transitionDelay: teamVisible ? `${index * 260}ms` : '0ms' }}
                >
                  <h2 className={`flex min-h-[34px] w-fit items-center justify-center rounded-full px-4 py-2 font-scripter text-[14px] font-normal leading-none text-[#F8F3FC] lg:min-h-[38px] lg:px-5 lg:text-[15px] ${color}`}>
                    {title}
                  </h2>
                  <p className="mt-2 whitespace-pre-line text-center font-poppins text-[14px] font-normal leading-snug text-black/80 md:text-left">
                    {detail}
                  </p>
                </div>
              ))}
            </div>
            <p
              className={`whitespace-pre-line text-center font-poppins text-[16px] font-normal leading-[1.45] text-black/80 transition-all duration-1000 ease-out md:text-left ${teamVisible ? 'translate-x-0 opacity-100' : 'translate-x-12 opacity-0'}`}
              style={{ transitionDelay: teamVisible ? '350ms' : '0ms' }}
            >
              {'Contamos con un equipo de +80\nvoluntarixs activos, coordinados\nmediante roles claros y\nrotativos que garantizan la\ntransparencia, el orden logístico\ny la ejecución impecable de cada\njornada.'}
            </p>
          </div>
        </section>
        <section
          aria-labelledby="growth-title"
          className="mt-[20px] w-full bg-[#FFF8E9] px-6 pb-12 pt-8 sm:px-8"
        >
          <h2 id="growth-title" className="text-center font-scripter text-[42px] font-normal leading-tight text-[#466729] lg:text-[60px]">
            Nuestro crecimiento
          </h2>
          <p className="mt-6 whitespace-pre-line text-center font-poppins text-[16px] font-normal leading-relaxed text-black/80">
            {'A lo largo de los años, crecimos con cada necesidad que apareció,\nacompañando nuevas demandas con empatía, compromiso y\nacción colectiva.'}
          </p>
          <div className="mx-auto mt-8 flex w-full max-w-[1080px] flex-col items-center justify-center gap-8 lg:flex-row lg:items-start">
            <div
              ref={growthChartRef}
              className="w-full max-w-[500px] flex-1 rounded-[22px] bg-[#FFFDF8] p-3 sm:p-4"
            >
            <h3 className="text-center font-poppins text-[16px] font-semibold leading-tight text-black/80 sm:text-[18px]">
              Escalabilidad del Impacto:<br />
              Viandas entregadas por<br className="sm:hidden" /> semana
            </h3>
            <svg
              role="img"
              aria-label="Viandas entregadas por semana: 150 en 2022, 350 en 2023, 450 en 2024 y 600 en 2025"
              viewBox="0 0 400 310"
              className="mt-3 h-auto w-full overflow-visible"
            >
              {[50, 88, 127, 165, 203].map((y, index) => (
                <g key={y}>
                  <line x1="58" x2="366" y1={y} y2={y} stroke="#D1D1D1" strokeWidth="1" />
                  <text x="48" y={y + 4} textAnchor="end" className="fill-black/80 font-poppins text-[12px] font-semibold">
                    {(6 - index) * 100}
                  </text>
                </g>
              ))}
              <path
                d="M 92 222 L 174 145 L 256 107 L 338 50"
                fill="none"
                stroke="#466729"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength="1"
                className="transition-[stroke-dashoffset] duration-[1800ms] ease-out motion-reduce:transition-none"
                style={{ strokeDasharray: 1, strokeDashoffset: growthChartVisible ? 0 : 1 }}
              />
              {[
                { year: '2022', value: '150', x: 92, y: 222 },
                { year: '2023', value: '350', x: 174, y: 145 },
                { year: '2024', value: '450', x: 256, y: 107 },
                { year: '2025', value: '600', x: 338, y: 50 },
              ].map(({ year, value, x, y }, index) => (
                <g
                  key={year}
                  className={`transition-opacity duration-500 ease-out motion-reduce:transition-none ${growthChartVisible ? 'opacity-100' : 'opacity-0'}`}
                  style={{ transitionDelay: growthChartVisible ? `${700 + index * 260}ms` : '0ms' }}
                >
                  <circle cx={x} cy={y} r="4" fill="#466729" />
                  <rect x={x - 25} y={y - 35} width="50" height="25" rx="7" fill="#AF71DD" />
                  <text x={x} y={y - 18} textAnchor="middle" className="fill-[#FFF8E9] font-poppins text-[14px] font-semibold">
                    {value}
                  </text>
                  <text x={x} y="248" textAnchor="middle" className="fill-black/80 font-poppins text-[12px] font-semibold">
                    {year}
                  </text>
                </g>
              ))}
            </svg>
            </div>
            <div
              ref={foodChartRef}
              className="w-full max-w-[500px] flex-1 rounded-[22px] bg-[#FFFDF8] p-3 sm:p-4"
            >
              <h3 className="text-center font-poppins text-[16px] font-semibold leading-tight text-black/80 sm:text-[18px]">
                Cantidad de comida cocinada al mes
              </h3>
              <svg
                role="img"
                aria-label="Cantidad de comida cocinada al mes: 160 kilos de carbohidratos, 120 de legumbres, 240 de verduras y 140 de frutas"
                viewBox="0 0 440 360"
                className="mt-3 h-auto w-full"
              >
                {(() => {
                  let startAngle = -90
                  return foodSlices.map((slice, index) => {
                    const endAngle = startAngle + (slice.value / 660) * 360
                    const path = getPieSlicePath(startAngle, endAngle)
                    startAngle = endAngle
                    return (
                      <path
                        key={slice.label}
                        d={path}
                        fill={slice.color}
                        fillOpacity={foodChartVisible ? 0.8 : 0}
                        className="transition-[fill-opacity] duration-1000 ease-in-out motion-reduce:transition-none"
                        style={{ transitionDelay: foodChartVisible ? `${index * 420}ms` : '0ms' }}
                      />
                    )
                  })
                })()}
                {[
                  { label: 'CARBOHIDRATOS', value: '160', x: 365, y: 74 },
                  { label: 'LEGUMBRES', value: '120', x: 370, y: 296 },
                  { label: 'VERDURAS', value: '240', x: 70, y: 323 },
                  { label: 'FRUTAS', value: '140', x: 72, y: 74 },
                ].map(({ label, value, x, y }, index) => (
                  <g
                    key={label}
                    className={`transition-opacity duration-700 ease-in-out motion-reduce:transition-none ${foodChartVisible ? 'opacity-100' : 'opacity-0'}`}
                    style={{ transitionDelay: foodChartVisible ? `${600 + index * 420}ms` : '0ms' }}
                  >
                    <text x={x} y={y} textAnchor="middle" className="fill-black/80 font-poppins text-[11px] font-semibold">
                      {label}
                    </text>
                    <text x={x} y={y + 15} textAnchor="middle" className="fill-black/80 font-poppins text-[11px] font-semibold">
                      {value}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          </div>
        </section>
        <section
          aria-labelledby="proposal-title"
          className="relative isolate mt-8 min-h-[520px] w-full overflow-hidden bg-[#FFF8E9] px-6 py-12 sm:px-8"
        >
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 hidden overflow-hidden lg:block">
            <span
              className={`absolute left-[-230px] top-1/2 h-[620px] w-[620px] -translate-y-1/2 rounded-full bg-[#466729]/50 transition-[transform,opacity] duration-1000 ease-out lg:h-[700px] lg:w-[700px] ${proposalVisible ? '-translate-x-1/2 opacity-100' : '-translate-x-[70%] opacity-0'}`}
              style={{ transitionDelay: proposalVisible ? '100ms' : '0ms' }}
            />
            <span
              className={`absolute right-[-230px] top-1/2 h-[620px] w-[620px] -translate-y-1/2 rounded-full bg-[#466729]/50 transition-[transform,opacity] duration-1000 ease-out lg:h-[700px] lg:w-[700px] ${proposalVisible ? 'translate-x-1/2 opacity-100' : 'translate-x-[70%] opacity-0'}`}
              style={{ transitionDelay: proposalVisible ? '300ms' : '0ms' }}
            />
          </div>
          <div className="relative z-10 mx-auto grid w-full max-w-[1160px] grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.2fr)] lg:gap-12">
            <div className="text-center lg:pt-8 lg:text-right">
              <h2 id="proposal-title" className="font-scripter text-[42px] font-normal leading-tight text-[#466729] lg:text-[60px]">
                Nuestra<br />propuesta
              </h2>
              <p className="mt-4 font-scripter text-[18px] font-normal text-black/80 lg:text-[26px]">
                100% A VOLUNTAD
              </p>
            </div>
            <div ref={proposalCardsRef} className="grid grid-cols-1 justify-items-start gap-4">
              {proposals.map((proposal, index) => (
                <article
                  key={proposal}
                  className={`flex min-h-[58px] w-fit max-w-full items-center justify-center rounded-[20px] bg-[#AF71DD]/50 px-5 py-3 text-center transition-all duration-700 ease-out motion-reduce:transition-none ${proposalVisible ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0'}`}
                  style={{ transitionDelay: proposalVisible ? `${index * 260}ms` : '0ms' }}
                >
                  <p className="font-scripter text-[16px] leading-snug text-black/80">
                    {proposal}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section className="w-full bg-[#FFF8E9] px-6 pb-24 pt-16 text-center sm:px-8" aria-label="Invitación a colaborar">
          <p
            className="whitespace-pre-line font-poppins text-[16px] font-normal italic leading-relaxed text-black/80 sm:text-[18px] lg:text-[22px]"
            style={{ fontFamily: "'Poppins', sans-serif", fontStyle: 'italic' }}
          >
            {'No buscamos solo donaciones, buscamos aliadxs\nque crean en un mundo más justo y sin violencia.'}
          </p>
          <p className="mt-6 font-scripter text-[20px] font-normal leading-tight text-[#F13107] sm:text-[24px] lg:text-[32px]">
            ¿Construimos juntxs esta realidad?
          </p>
        </section>
      </main>
      <Footer />
    </div>
  )
}

export default Nosotros
