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
    icon: misionIcon,
  },
  {
    title: 'VISIÓN',
    description:
      'Expandir nuestra presencia a lo largo del territorio argentino con una comunidad consciente como una red de voluntariado para brindar apoyo alimentario, basada en la empatía, la educación y el respeto hacia todos.',
    color: 'bg-[#466729]/70',
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
  return (
    <section
      id="propuesta"
      className="bg-white px-6 py-16 sm:px-10 lg:px-12 lg:py-[72px]"
    >
      <div className="mx-auto max-w-[936px]">
        <div className="grid items-start gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-[72px]">
          <div className="max-w-[279px]">
            <p className="font-scripter text-[32px] leading-[1.05] text-[#466729]">
              QUIENES SOMOS
            </p>
            <h2 className="mt-3 font-scripter text-[60px] leading-[0.99] tracking-[-0.02em] text-black/80">
              HACIA
              <br />
              DÓNDE
              <br />
              VAMOS
            </h2>
          </div>

          <div className="flex max-w-[488px] flex-col items-start pt-7 lg:pt-[116px]">
            <p className="font-sans text-base leading-[1.25] text-black">
              Somos una red de voluntarios impulsada por la empatía y la convicción de que en un mundo más justo es posible. Nos unimos para brindar asistencia a quienes más lo necesitan, acercando platos nutritivos libres de crueldad y promoviendo el paso a paso una comunidad basada en el respeto y la solidaridad sustentable.
            </p>
            <BtnAction
              href="#historia"
              width="164px"
              height="53px"
              className="mt-4 text-base font-semibold"
            >
              Conócenos
            </BtnAction>
          </div>
        </div>

        <div className="mt-16 grid justify-items-center gap-8 sm:grid-cols-2 lg:mt-[73px] lg:grid-cols-[repeat(3,276px)] lg:justify-between lg:gap-0">
          {cards.map(({ title, description, values, color, icon }) => (
            <article
              key={title}
              className={`flex h-[433px] w-full max-w-[276px] flex-col items-center rounded-b-[999px] px-8 pt-[29px] text-center text-white ${color}`}
            >
              <img src={icon} alt="" aria-hidden="true" className="h-16 w-16" />
              <h3 className="mt-2 font-scripter text-[36px] leading-[47px]">
                {title}
              </h3>
              {values ? (
                <ul className="mt-8 space-y-1 font-sans text-[11px] leading-[1.2]">
                  {values.map((value) => (
                    <li key={value}>{value}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-8 font-sans text-[0.8125rem] leading-[1.25]">
                  {description}
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
