import flores from '../../assets/brand/svgMagui/flores.png'
import instagramIcon from '../../assets/brand/svgMagui/instagram-icon.png'

// Importación de los íconos para cada campaña
import libroIcon from '../../assets/brand/svgMagui/libro.png'
import manoIcon from '../../assets/brand/svgMagui/mano-icon.png'
import arbolIcon from '../../assets/brand/svgMagui/arbol-icon.png'
import regaloIcon from '../../assets/brand/svgMagui/regalo-icon.png'

const campaigns = [
  { title: 'VUELTA A CLASES', color: 'bg-[#AF71DD]/80', icon: libroIcon, href: 'https://www.instagram.com/p/DWIBQ-TDgyB/?hl=es' },
  { title: 'CAMPAÑA DE INVIERNO', color: 'bg-[#686868]/80', icon: manoIcon, href: 'https://www.instagram.com/p/Da6Rx5WAjC8/?img_index=1' },
  { title: 'NAVIDAD SOLIDARIA', color: 'bg-[#466729]/80', icon: arbolIcon },
  { title: 'DÍA DE LA NIÑEZ', color: 'bg-[#F13107]/80', icon: regaloIcon },
]

function Campaigns() {
  return (
    <section
      id="campanas"
      className="relative w-full overflow-hidden bg-[#FFF8E9] px-6 py-16 sm:px-10 lg:min-h-[760px] lg:px-0 lg:py-16"
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
              <h3 className={`flex h-[36px] w-fit min-w-[130px] items-center justify-center gap-2 rounded-full px-3 font-scripter text-[11px] uppercase tracking-wide text-white ${campaign.color}`}>
                <img src={campaign.icon} alt="" aria-hidden="true" className="h-4 w-4 object-contain brightness-0 invert" />
                {campaign.title}
              </h3>
              <div className="group relative h-[260px] w-full overflow-hidden rounded-[24px] bg-[#D9D9D9] text-center font-sans text-[11px] font-semibold uppercase text-[#555555]">
                {campaign.href ? (
                  <iframe
                    title={`Publicación de Instagram: ${campaign.title}`}
                    src={`${campaign.href.split('?')[0]}embed/`}
                    className="-translate-y-[70px] h-[720px] w-full border-0"
                    scrolling="no"
                    allowFullScreen
                    loading="lazy"
                  />
                ) : (
                  <span className="flex h-full items-center justify-center px-4">PUBLICACIÓN DE IG</span>
                )}
                {campaign.href && (
                  <a
                    href={campaign.href}
                    target="_blank"
                    rel="noreferrer"
                    className="absolute inset-x-0 bottom-0 z-10 flex h-[58px] items-end justify-between bg-[#FFF8E9]/95 px-3 pb-2 font-sans normal-case text-[#AF71DD]"
                  >
                    <span className="flex flex-col items-start text-left">
                      <span className="text-[12px] font-semibold">@olla.vegana</span>
                      <span className="text-[10px]">Ver en Instagram</span>
                    </span>
                    <img src={instagramIcon} alt="Instagram" className="mb-1 h-5 w-5 object-contain" />
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>

        {/* Composición desktop: títulos y tarjetas en filas independientes */}
        <div className="mt-8 hidden h-[57px] w-full max-w-[937px] items-center justify-between lg:flex">
          {campaigns.map((campaign) => (
            <h3 key={campaign.title} className={`flex h-[55px] w-[199px] items-center justify-center gap-2 rounded-[20px] px-3 font-scripter text-[16px] leading-none uppercase tracking-wide text-white ${campaign.color}`}>
              <img src={campaign.icon} alt="" aria-hidden="true" className="relative top-[-1px] block h-[21px] w-[21px] shrink-0 object-contain brightness-0 invert" />
              <span className="inline-flex items-center whitespace-nowrap leading-[21px]">{campaign.title}</span>
            </h3>
          ))}
        </div>
        <div className="mt-[35px] hidden w-full max-w-[1077px] justify-between lg:flex">
          {campaigns.map((campaign) => (
            <div key={campaign.title} className="group relative h-[314px] w-[240px] overflow-hidden rounded-[20px] bg-[#D9D9D9] text-center font-sans text-[11px] font-semibold uppercase text-[#555555]">
              {campaign.href ? (
                <iframe
                  title={`Publicación de Instagram: ${campaign.title}`}
                  src={`${campaign.href.split('?')[0]}embed/`}
                  className="-translate-y-[70px] h-[720px] w-full border-0"
                  scrolling="no"
                  allowFullScreen
                  loading="lazy"
                />
              ) : (
                <span className="flex h-full items-center justify-center px-4">PUBLICACIÓN DE IG</span>
              )}
              {campaign.href && (
                <a
                  href={campaign.href}
                  target="_blank"
                  rel="noreferrer"
                  className="absolute inset-x-0 bottom-0 z-10 flex h-[58px] items-end justify-between bg-[#FFF8E9]/95 px-3 pb-2 font-sans normal-case text-[#AF71DD]"
                >
                  <span className="flex flex-col items-start text-left">
                    <span className="text-[12px] font-semibold">@olla.vegana</span>
                    <span className="text-[10px]">Ver en Instagram</span>
                  </span>
                  <img src={instagramIcon} alt="Instagram" className="mb-1 h-5 w-5 object-contain" />
                </a>
              )}
            </div>
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





















