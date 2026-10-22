import flores from '../../assets/brand/svgMagui/flores.png'
import instagramIcon from '../../assets/brand/svgMagui/instagram-icon.png'

// Importación de los íconos para cada campaña
import libroIcon from '../../assets/brand/svgMagui/libro.png'
import manoIcon from '../../assets/brand/svgMagui/mano-icon.png'
import arbolIcon from '../../assets/brand/svgMagui/arbol-icon.png'
import regaloIcon from '../../assets/brand/svgMagui/regalo-icon.png'

const campaigns = [
  { title: 'VUELTA A CLASE', color: 'bg-[#AF71DD]/80', icon: libroIcon },
  { title: 'CAMPAÑA DE INVIERNO', color: 'bg-[#78935E]/80', icon: manoIcon },
  { title: 'NAVIDAD SOLIDARIA', color: 'bg-[#466729]/80', icon: arbolIcon },
  { title: 'MÁS ALLÁ DEL PLATO', color: 'bg-[#F13107]/80', icon: regaloIcon },
]

function Campaigns() {
  return (
    <section
      id="campanas"
      className="relative w-full overflow-hidden bg-[#FFF8E9] px-6 py-12 sm:px-10 lg:min-h-[760px] lg:px-0 lg:py-10"
    >
      {/* ILUSTRACIÓN DE FLORES (Alineada al costado de las tarjetas) */}
      <img
        src={flores}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute right-[-10px] top-[58%] z-0 hidden w-[210px] -translate-y-1/2 object-contain opacity-50 sm:block lg:right-[10px] lg:w-[260px] xl:right-[40px] xl:w-[290px]"
      />

      {/* CONTENIDO PRINCIPAL CENTRADO */}
      <div className="relative z-10 mx-auto flex max-w-[1200px] flex-col items-center text-center">
        {/* Encabezados */}
        <div className="w-full max-w-[760px]">
          <p className="font-scripter text-[28px] leading-[36px] text-[#F13107]">
            Una comunidad que se mueve
          </p>
          <h2 className="mt-[4px] font-scripter text-[52px] leading-[1.05] text-black/80">
            CONOCÉ NUESTRAS CAMPAÑAS
          </h2>
          <p className="mx-auto mt-[12px] max-w-[592px] font-sans text-[13px] leading-[1.25] text-black/80 lg:text-[14px]">
            Cada campaña es una oportunidad para acompañar, compartir y transformar realidades. Conocé las iniciativas que construimos en comunidad.
          </p>
        </div>

        <div className="mt-8 grid w-full max-w-[800px] grid-cols-1 gap-6 sm:grid-cols-2 lg:hidden">
          {campaigns.map((campaign) => (
            <article key={campaign.title} className="flex flex-col items-center gap-3">
              <h3 className={`flex h-[36px] w-fit min-w-[130px] items-center justify-center gap-2 rounded-full px-3 font-scripter text-[11px] uppercase tracking-wide text-white ${campaign.color}`}>
                <img src={campaign.icon} alt="" aria-hidden="true" className="h-4 w-4 object-contain brightness-0 invert" />
                {campaign.title}
              </h3>
              <div className="flex h-[260px] w-full items-center justify-center rounded-[24px] bg-[#D9D9D9] px-4 text-center font-sans text-[11px] font-semibold uppercase text-[#555555]">
                PUBLICACIÓN DE IG
              </div>
            </article>
          ))}
        </div>

        {/* Composición desktop: títulos y tarjetas en filas independientes */}
        <div className="mt-8 hidden w-full max-w-[1077px] grid-cols-4 gap-[10px] lg:grid">
          {campaigns.map((campaign) => (
            <h3 key={campaign.title} className={`flex h-[36px] items-center justify-center gap-2 rounded-full px-3 font-scripter text-[11px] uppercase tracking-wide text-white ${campaign.color}`}>
              <img src={campaign.icon} alt="" aria-hidden="true" className="h-4 w-4 object-contain brightness-0 invert" />
              {campaign.title}
            </h3>
          ))}
        </div>
        <div className="mt-3 hidden w-full max-w-[1077px] grid-cols-4 gap-[10px] lg:grid">
          {campaigns.map((campaign) => (
            <div key={campaign.title} className="flex h-[314px] items-center justify-center rounded-[24px] bg-[#D9D9D9] px-4 text-center font-sans text-[11px] font-semibold uppercase text-[#555555]">
              PUBLICACIÓN DE IG
            </div>
          ))}
        </div>

        {/* Botón inferior a Instagram */}
        <a
          href="https://www.instagram.com/olla.vegana/"
          target="_blank"
          rel="noreferrer"
          className="relative z-10 mt-8 inline-flex h-[46px] w-full max-w-[400px] items-center justify-center gap-[10px] rounded-[30px] bg-[#AF71DD] px-5 font-sans text-[14px] font-semibold text-[#FFF8E9] transition-all duration-300 hover:bg-[#9b58cc]"
        >
          <img src={instagramIcon} alt="" aria-hidden="true" className="h-5 w-5 object-contain" />
          Seguinos en nuestras redes!
        </a>
      </div>
    </section>
  )
}

export default Campaigns