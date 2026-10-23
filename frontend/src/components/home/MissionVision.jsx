import { useEffect, useRef, useState } from 'react'
import BtnAction from '../disenio/btn-action'
import misionIcon from '../../assets/brand/herosvg/mision.svg'
import valoresIcon from '../../assets/brand/herosvg/valores.svg'
import visionIcon from '../../assets/brand/herosvg/vision.svg'

const cards = [
  {
    title: 'MISIÓN',
    description:
      'Acompañamos a personas en situación de vulnerabilidad ofreciendo comida nutritiva a base de plantas, promoviendo el bienestar emocional a través de recorridos y trabajo comunitario, con el compromiso de una ciudad hacia ningún ser.',
    color: 'bg-[#AF71DD]/70',
    displayDescription: 'Acompa\u00f1amos a personas en\nsituaci\u00f3n de vulnerabilidad\nofreciendo comida nutritiva a\nbase de plantas, ropa y\ncontenci\u00f3n\nemocional, a trav\u00e9s de\nrecorridas y trabajo voluntario,\ncon el\ncompromiso de una vida sin\ncrueldad hacia ning\u00fan ser.',
    icon: misionIcon,
  },
  {
    title: 'VISIÓN',
    description:
      'Expandir nuestra presencia a lo largo del territorio argentino con una comunidad consciente como una red de voluntariado para brindar apoyo alimentario, basada en la empatía, la educación y el respeto hacia todos.',
    color: 'bg-[#466729]/70',
    displayDescription: 'Expandir nuestra presencia a lo\nlargo de toda la l\u00ednea del tren\nSarmiento, alcanzando cada una\nde sus localidades para brindar\nayuda integral, basada en la\nempat\u00eda, la alimentaci\u00f3n sin\ncrueldad\ny el compromiso humano,\nestableciendo un modelo\nreplicable de\nsolidaridad sustentable.',
    icon: visionIcon,
  },
  {
    title: 'VALORES',
    values: ['Solidaridad', 'Compromiso', 'Respeto', 'Inclusión', 'Soberanía alimentaria'],
    color: 'bg-[#F13107]/70',
    icon: valoresIcon,
  },
]

function MissionVision() {
  const sectionRef = useRef(null)
  const [cardsVisible, setCardsVisible] = useState(false)

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return

    const observer = new IntersectionObserver(
      ([entry]) => setCardsVisible(entry.isIntersecting),
      { threshold: 0.2 },
    )

    observer.observe(section)
    return () => observer.disconnect()
  }, [])

  return (
    <section
      ref={sectionRef}
      id="propuesta"
      className="bg-[#FFF8E9] px-6 py-16 sm:px-10 lg:px-12 lg:py-[72px]"
    >
      <div className="mx-auto max-w-[936px]">
        <div className="grid justify-items-center gap-10 text-center lg:grid-cols-[1fr_1.1fr] lg:justify-items-start lg:gap-[72px] lg:text-left">
          <div className="w-[279px] max-w-[279px] lg:ml-[60px]">
            <p className="font-scripter text-[32px] leading-[1.05] text-[#466729]">
              QUIENES SOMOS
            </p>
            <h2 className="mt-3 font-scripter text-[60px] leading-[1.2] tracking-[-0.02em] text-black/80">
              HACIA
              <br />
              DÓNDE
              <br />
              VAMOS
            </h2>
          </div>

          <div className="flex max-w-[388px] flex-col items-center pt-7 lg:items-start lg:pt-[20px]">
            <p className="font-sans text-base leading-[1.25] text-black">
              Somos una red de voluntarios impulsada por la empatía y la convicción de que en un mundo más justo es posible. Nos unimos para brindar asistencia a quienes más lo necesitan, acercando platos nutritivos libres de crueldad y promoviendo el paso a paso una comunidad basada en el respeto y la solidaridad sustentable.
            </p>
            <BtnAction
              href="/donacion"
              width="164px"
              height="53px"
              className="mt-4 text-base font-semibold"
            >
              Conócenos
            </BtnAction>
          </div>
        </div>

        <div className="mt-16 grid justify-items-center gap-8 sm:grid-cols-2 lg:mt-[73px] lg:grid-cols-[repeat(3,276px)] lg:justify-between lg:gap-0">
          {cards.map(({ title, description, displayDescription, values, color, icon }, index) => (
            <article
              key={title}
              className={`flex h-[433px] w-full max-w-[276px] flex-col items-center rounded-b-[999px] px-8 pt-[29px] text-center text-white transition-[opacity,transform] duration-1000 ease-out motion-reduce:transition-none ${color} ${cardsVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0 motion-reduce:opacity-100'}`}
              style={{ transitionDelay: cardsVisible ? `${index * 280}ms` : '0ms' }}
            >
              <img src={icon} alt="" aria-hidden="true" className="h-16 w-16" />
              <h3 className="mt-2 font-scripter text-[36px] leading-[47px]">
                {title}
              </h3>
              {values ? (
                <ul className="mt-8 space-y-1 font-sans text-[12px] leading-[1.2]">
                  {values.map((value) => (
                    <li key={value}>{value}</li>
                  ))}
                </ul>
              ) : (
                <p className={`mt-8 ${index === 0 ? 'h-[210px] w-[203px] whitespace-pre-line font-poppins text-[13px] font-normal leading-normal' : 'font-sans text-[0.8125rem] leading-[1.25]'} ${index === 1 ? 'whitespace-pre-line font-light' : ''}`}>
                  {displayDescription || description}
                </p>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

export default MissionVision
