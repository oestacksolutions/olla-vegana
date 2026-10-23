import { useEffect, useRef, useState } from 'react'
import { Menu, X } from 'lucide-react'
import logoVaca from '../../assets/brand/svgMagui/logo_olla_vegana.png'
import BtnAction from '../disenio/btn-action'

const navigationLinks = [
  { label: 'Inicio', href: '#inicio' },
  { label: '¿Quiénes Somos?', href: '#propuesta' },
  { label: 'Donde Estamos', href: '#puntos' },
  { label: 'Tienda', href: '#tienda' },
]

function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const [isNavVisible, setIsNavVisible] = useState(true)
  const previousScrollY = useRef(0)
  const isDonationPage = window.location.pathname === '/donacion'

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      const scrollDifference = currentScrollY - previousScrollY.current

      setIsScrolled(currentScrollY > 10)

      if (currentScrollY <= 10) {
        setIsNavVisible(true)
      } else if (Math.abs(scrollDifference) > 3) {
        setIsNavVisible(scrollDifference < 0)
      }

      previousScrollY.current = currentScrollY
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  const closeMenu = () => setIsMenuOpen(false)

  return (
    <>
    <div aria-hidden="true" className="h-[76px] sm:h-[88px] lg:h-[104px] xl:h-[155px]" />
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${isNavVisible ? 'translate-y-0' : '-translate-y-full'} ${
        isScrolled
          ? 'border-b border-white/20 bg-transparent backdrop-blur-md'
          : 'bg-brand-cream'
      }`}
      aria-label="Navegación principal"
    >
      <div className="mx-auto flex h-[76px] min-h-0 max-w-7xl items-center justify-between px-4 sm:h-[88px] sm:px-6 lg:h-[104px] lg:px-8 xl:h-[155px] xl:px-10">
        <a
          href="#inicio"
          className="flex shrink-0 items-center text-brand-ink"
          aria-label="Olla Vegana, ir al inicio"
          onClick={closeMenu}
        >
          <img
            src={logoVaca}
            aria-label="Logo de Olla Vegana"
            className="h-[68px] w-[68px] shrink-0 object-contain sm:h-[78px] sm:w-[78px] lg:h-[92px] lg:w-[92px] xl:h-[179px] xl:w-[179px]"
          />
        </a>

        <nav className="absolute left-1/2 top-1/2 hidden w-max -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-10 xl:flex 2xl:gap-[72px]" aria-label="Secciones del sitio">
          {navigationLinks.map((link) => (
            <a
              key={link.href}
              href={isDonationPage ? `/${link.href}` : link.href}
              className="whitespace-nowrap font-poppins text-base font-semibold text-brand-ink/75 transition-colors hover:text-brand-orange 2xl:text-lg"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <BtnAction
          href={isDonationPage ? '#donacion' : '#dona'}
          className="hidden xl:inline-flex xl:mr-6"
        >
          Quiero Ayudar!
        </BtnAction>

        <button
          type="button"
          className="rounded-full p-2 text-brand-ink transition-colors hover:bg-brand-green xl:hidden"
          aria-label={isMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen((isOpen) => !isOpen)}
        >
          {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {isMenuOpen && (
        <nav
          className="absolute inset-x-3 top-[calc(100%-0.5rem)] rounded-2xl bg-brand-ink p-3 shadow-xl sm:inset-x-4 sm:p-5 xl:hidden"
          aria-label="Menú móvil"
        >
          <div className="flex flex-col gap-2">
            {navigationLinks.map((link) => (
              <a
                key={link.href}
                href={isDonationPage ? `/${link.href}` : link.href}
                className="font-poppins rounded-xl px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-white/10"
                onClick={closeMenu}
              >
                {link.label}
              </a>
            ))}
            <BtnAction
              href={isDonationPage ? '#donacion' : '#dona'}
              className="mt-3 self-center"
              onClick={closeMenu}
            >
              Quiero Ayudar!
            </BtnAction>
          </div>
        </nav>
      )}
    </header>
    </>
  )
}

export default Navbar



