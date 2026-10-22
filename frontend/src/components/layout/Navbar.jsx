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
  const [isVisible, setIsVisible] = useState(true)
  const lastScrollY = useRef(0)
  const lastMouseY = useRef(null)

  useEffect(() => {
    lastScrollY.current = window.scrollY

    const handleScroll = () => {
      const currentScrollY = window.scrollY
      if (Math.abs(currentScrollY - lastScrollY.current) > 2) {
        setIsVisible(currentScrollY < lastScrollY.current || currentScrollY < 10)
        lastScrollY.current = currentScrollY
      }
    }

    const handleMouseMove = (event) => {
      if (lastMouseY.current !== null && event.clientY < lastMouseY.current - 3) {
        setIsVisible(true)
      }
      lastMouseY.current = event.clientY
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('mousemove', handleMouseMove)
    }
  }, [])

  const closeMenu = () => setIsMenuOpen(false)

  return (
    <>
    <div aria-hidden="true" className="h-[96px] sm:h-[112px] lg:h-[155px]" />
    <header className={`fixed inset-x-0 top-0 z-50 bg-brand-cream transition-transform duration-300 ease-out ${isVisible || isMenuOpen ? 'translate-y-0' : '-translate-y-full'}`} aria-label="Navegación principal">
      <div className="mx-auto flex h-[96px] min-h-0 max-w-7xl items-center justify-between px-5 py-0 sm:h-[112px] sm:px-6 lg:h-[155px] lg:px-10">
        <a
          href="#inicio"
          className="flex shrink-0 items-center text-brand-ink"
          aria-label="Olla Vegana, ir al inicio"
          onClick={closeMenu}
        >
          <img
            src={logoVaca}
            aria-label="Logo de Olla Vegana"
            className="h-[88px] w-[88px] shrink-0 object-contain sm:h-[104px] sm:w-[104px] lg:h-[179px] lg:w-[179px]"
          />
        </a>

        <nav className="absolute left-1/2 top-[calc(50%-4px)] hidden w-max -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-12 lg:flex" aria-label="Secciones del sitio">
          {navigationLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="font-poppins text-base font-semibold text-brand-ink/75 transition-colors hover:text-brand-orange"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <BtnAction
          href="#dona"
          className="hidden sm:inline-flex lg:mr-6"
        >
          Quiero Ayudar!
        </BtnAction>

        <button
          type="button"
          className="rounded-full p-2 text-brand-ink transition-colors hover:bg-brand-green lg:hidden"
          aria-label={isMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen((isOpen) => !isOpen)}
        >
          {isMenuOpen ? <X size={25} /> : <Menu size={25} />}
        </button>
      </div>

      {isMenuOpen && (
        <nav
          className="absolute inset-x-4 top-[calc(100%-0.5rem)] rounded-2xl bg-brand-ink p-5 shadow-xl lg:hidden"
          aria-label="Menú móvil"
        >
          <div className="flex flex-col gap-1">
            {navigationLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="font-poppins rounded-xl px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                onClick={closeMenu}
              >
                {link.label}
              </a>
            ))}
            <BtnAction
              href="#dona"
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
