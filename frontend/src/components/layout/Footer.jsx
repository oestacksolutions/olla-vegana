import ollaflor from '../../assets/brand/svgMagui/olla-flor-titulo.png'
import instagramIcon from '../../assets/brand/svgMagui/instagram-icon.png'
import mailIcon from '../../assets/brand/svgMagui/mail-icon.png'
import wspIcon from '../../assets/brand/svgMagui/wsp-icon.png'


const footerLinks = [
  { label: 'Donaciones', href: '/#dona' },
  { label: 'Tienda', href: '/#tienda' },
  { label: 'Quienes somos', href: '/#propuesta' },
  { label: 'Donde estamos', href: '/#puntos' },
]

function Footer() {
  return (
    <footer className="relative h-auto min-h-[218px] w-full overflow-hidden bg-[#AF71DD] sm:h-[218px]">
      <div
        className="footer-circle absolute z-0 rounded-full bg-[#FEEFEC]"
        style={{ top: '50%', transform: 'translateY(-50%)' }}
      >
        <img
          src={ollaflor}
          alt=""
          aria-hidden="true"
          className="footer-flowers absolute z-10 h-[265px] w-[205px] object-contain lg:h-[280px] lg:w-[225px]"
        />
      </div>
      <div className="relative z-10 mx-auto grid w-full max-w-[1100px] grid-cols-1 items-center gap-y-6 py-8 pl-[170px] pr-6 sm:h-full sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.25fr)] sm:gap-x-6 sm:gap-y-0 sm:py-0 sm:pl-[190px] sm:pr-10 lg:gap-x-10">
        <div className="min-w-0 text-left text-white">
          <h2 className="font-scripter text-[26px] font-normal leading-tight">Olla Vegana</h2>
          <p className="mt-2 whitespace-pre-line font-poppins text-[16px] font-light leading-6 text-white">
            {'Cada acción suma\nCada persona transforma'}
          </p>
        </div>

        <nav aria-label="Explora" className="min-w-0 text-left text-white">
          <h2 className="font-scripter text-[26px] font-normal leading-tight">Explora</h2>
          <ul className="mt-2 flex flex-col items-start gap-1 font-poppins text-[15px] font-light leading-5">
            {footerLinks.map(({ label, href }) => (
              <li key={href}>
                <a className="footer-hover-link" href={href}>
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 text-left text-white">
          <h2 className="font-scripter text-[26px] font-normal leading-tight">Contacto</h2>
          <ul className="mt-3 flex flex-col gap-2 font-poppins font-light text-white">
            <li>
              <a className="footer-hover-link flex items-center gap-2" href="https://www.instagram.com/olla.vegana/" target="_blank" rel="noreferrer">
                <img src={instagramIcon} alt="" aria-hidden="true" className="shrink-0 object-contain" style={{ width: '14px', height: '14px', minWidth: '14px', minHeight: '14px' }} />
                <span className="text-[16px]">Olla Vegana</span>
              </a>
            </li>
            <li>
              <a className="footer-hover-link flex items-center gap-2 break-all" href="mailto:organizadoresollavegana@gmail.com">
                <img src={mailIcon} alt="" aria-hidden="true" className="shrink-0 object-contain" style={{ width: '14px', height: '14px', minWidth: '14px', minHeight: '14px' }} />
                <span className="text-[14px]">organizadoresollavegana@gmail.com</span>
              </a>
            </li>
            <li>
              <a className="footer-hover-link flex items-center gap-2" href="https://wa.me/5491140279218" target="_blank" rel="noreferrer">
                <img src={wspIcon} alt="" aria-hidden="true" className="shrink-0 object-contain" style={{ width: '14px', height: '14px', minWidth: '14px', minHeight: '14px' }} />
                <span className="text-[15px]">+549 11 40279218</span>
              </a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  )
}

export default Footer








