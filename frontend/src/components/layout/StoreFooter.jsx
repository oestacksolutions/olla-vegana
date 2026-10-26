import logoOllaVegana from '../../assets/png/logo_olla_vegana.png'
import instagramIcon from '../../assets/png/instagram-icon.png'

const productLinks = [
  ['Remeras', '/tienda?categoria=remeras'],
  ['Gorras', '/tienda?categoria=gorras'],
  ['Totes', '/tienda?categoria=totes'],
]

function StoreFooter() {
  return (
    <footer className="relative h-auto min-h-[218px] w-full overflow-hidden bg-[#AF71DD] text-white sm:h-[218px]">
      <div
        aria-hidden="true"
        className="footer-circle absolute z-0 rounded-full bg-[#FEEFEC]"
        style={{ top: '50%', transform: 'translateY(-50%)' }}
      >
        <img
          src={logoOllaVegana}
          alt=""
          className="footer-flowers absolute z-10 h-[265px] w-[205px] object-contain lg:h-[280px] lg:w-[225px]"
        />
      </div>
      <div className="relative z-10 mx-auto grid w-full max-w-[1100px] grid-cols-1 items-center gap-y-6 py-8 pl-[170px] pr-6 sm:h-full sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.25fr)] sm:gap-x-6 sm:gap-y-0 sm:py-0 sm:pl-[190px] sm:pr-10 lg:gap-x-10">
        <nav aria-label="Productos">
          <h2 className="font-scripter text-[24px]">Productos</h2>
          <ul className="mt-3 flex flex-col gap-2 font-poppins text-[14px] font-light">
            {productLinks.map(([label, href]) => (
              <li key={href}>
                <a className="transition-opacity hover:opacity-75" href={href}>{label}</a>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Ayuda">
          <h2 className="font-scripter text-[24px]">Ayuda</h2>
          <ul className="mt-3 flex flex-col gap-2 font-poppins text-[14px] font-light">
            <li><a className="transition-opacity hover:opacity-75" href="/tienda#compra-online">Cómo comprar</a></li>
            <li><a className="transition-opacity hover:opacity-75" href="#terminos-y-condiciones">Términos y Condiciones</a></li>
          </ul>
        </nav>

        <div>
          <h2 className="font-scripter text-[24px]">Olla Vegana</h2>
          <div className="mt-3 flex flex-col items-start gap-4">
            <a href="/nosotros" className="font-poppins text-[14px] font-light text-white transition-opacity hover:opacity-75">
              Nosotros
            </a>
            <a
              href="https://www.instagram.com/olla.vegana/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram de Olla Vegana"
              className="transition-opacity hover:opacity-75"
            >
              <img src={instagramIcon} alt="" aria-hidden="true" className="h-6 w-6 object-contain" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default StoreFooter
