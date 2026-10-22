import flores from '../../assets/brand/svgMagui/flores.png'
import instagramIcon from '../../assets/brand/svgMagui/instagram-icon.png'

const campaigns = [
  { title: 'RÍO A ABASTO', color: 'bg-[#AF71DD]' },
  { title: 'CAMPAÑA DE INVIERNO', color: 'bg-[#466729]' },
  { title: 'MESA SOLIDARIA', color: 'bg-[#78935E]' },
  { title: 'MÁS ALLÁ DEL PLATO', color: 'bg-[#F13107]' },
]

function Campaigns() {
  return (
    <section
      id="campanas"
      className="relative overflow-hidden bg-[#FFF8E9] px-6 py-20 sm:px-10 lg:min-h-[760px] lg:px-0 lg:py-0"
    >
      <div className="relative z-10 mx-auto flex max-w-[1200px] flex-col items-center text-center lg:min-h-[760px]">
        <div className="pt-0 lg:absolute lg:left-1/2 lg:top-[32px] lg:w-[760px] lg:-translate-x-1/2">
          <p className="font-scripter text-[28px] leading-[36px] text-[#F13107]">
            Una comunidad que se mueve
          </p>
          <h2 className="mt-[8px] font-scripter text-[60px] leading-[1.05] text-black/80">
            Conocé nuestras campañas
          </h2>
          <p className="mx-auto mt-[10px] max-w-[592px] font-sans text-base leading-[1.25] text-black/80">
            Cada campaña es una oportunidad para acompañar, compartir y transformar realidades. Conocé las iniciativas que construimos en comunidad.
          </p>
        </div>

        <div className="mt-12 grid w-full max-w-[1077px] grid-cols-2 gap-4 lg:absolute lg:left-1/2 lg:top-[235px] lg:mt-0 lg:-translate-x-1/2 lg:grid-cols-4 lg:gap-[10px]">
          {campaigns.map((campaign) => (
            <article key={campaign.title} className="flex flex-col items-center gap-[10px]">
              <h3 className={`rounded-full px-4 py-2 font-sans text-[10px] font-bold leading-none text-white ${campaign.color}`}>
                {campaign.title}
              </h3>
              <div className="flex h-[220px] w-full items-center justify-center rounded-[20px] bg-[#D9D9D9] px-4 text-center font-sans text-[11px] font-semibold text-[#292621] sm:h-[250px] lg:h-[314px]">
                Publicación de Instagram
              </div>
            </article>
          ))}
        </div>

        <img
          src={flores}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-50% h-50% object-cover -z-10 pointer-events-none" />

        <a
          href="https://www.instagram.com/olla.vegana/"
          target="_blank"
          rel="noreferrer"
          className="mt-10 inline-flex h-[50px] w-full max-w-[430px] items-center justify-center gap-[10px] rounded-[30px] bg-[#AF71DD] px-5 font-sans text-[15px] font-semibold text-[#FFF8E9] transition-colors hover:bg-[#AF71DD]/80 lg:absolute lg:left-1/2 lg:top-[650px] lg:mt-0 lg:-translate-x-1/2"
        >
          <img src={instagramIcon} alt="" aria-hidden="true" className="h-5 w-5 object-contain" />
          Seguinos en nuestras redes!
        </a>
      </div>
    </section>
  )
}

export default Campaigns
