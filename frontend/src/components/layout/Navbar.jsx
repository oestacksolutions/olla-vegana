import { useEffect, useRef, useState } from 'react'
import logoVaca from '../../assets/brand/svgMagui/logo_olla_vegana.png'
import BtnAction from '../disenio/btn-action'

const navigationLinks = [
  { label: 'Inicio', href: '/#inicio' },
  { label: 'Dónde Estamos', href: '/#puntos' },
  { label: 'Tienda', href: '/tienda', target: '_blank' },
  { label: '¿Quiénes Somos?', href: '/#propuesta' },
]

function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const [isNavVisible, setIsNavVisible] = useState(true)
  const [burgerStage, setBurgerStage] = useState('closed')
  const previousScrollY = useRef(0)

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

  // Deshabilitar scroll del cuerpo al abrir el menú
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isMenuOpen])

  const toggleMenu = () => {
    if (!isMenuOpen) {
      setIsMenuOpen(true)
      setBurgerStage('collapsing')
      setTimeout(() => setBurgerStage('rotating-1'), 70)
      setTimeout(() => setBurgerStage('rotated'), 120)
    } else {
      setBurgerStage('rotating-1')
      setTimeout(() => setBurgerStage('collapsing'), 50)
      setTimeout(() => {
        setBurgerStage('closed')
        setIsMenuOpen(false)
      }, 70)
    }
  }

  const closeMenu = () => {
    if (isMenuOpen) toggleMenu()
  }

  return (
    <>
      <div aria-hidden="true" className="h-[76px] sm:h-[88px] lg:h-[104px] xl:h-[155px]" />
      <header
        className={`fixed inset-x-0 top-0 z-50 translate-y-0 transition-all duration-300 ${
          isNavVisible ? 'xl:translate-y-0' : 'xl:-translate-y-full'
        } ${
          isScrolled
            ? 'border-b border-white/20 bg-transparent backdrop-blur-md shadow-sm'
            : 'bg-[#FFF8E9]'
        }`}
        aria-label="Navegación principal"
      >
        <div className="mx-auto flex h-[76px] min-h-0 max-w-7xl items-center justify-between px-4 sm:h-[88px] sm:px-6 lg:h-[104px] lg:px-8 xl:h-[155px] xl:px-10">
          <a
            href="/#inicio"
            className="flex shrink-0 items-center text-brand-ink z-50"
            aria-label="Olla Vegana, ir al inicio"
            onClick={closeMenu}
          >
            <img
              src={logoVaca}
              alt="Logo de Olla Vegana"
              className="h-[62px] w-[62px] shrink-0 object-contain sm:h-[78px] sm:w-[78px] lg:h-[92px] lg:w-[92px] xl:h-[179px] xl:w-[179px]"
            />
          </a>

          {/* Menú Desktop */}
          <nav
            className="absolute left-1/2 top-1/2 hidden w-max -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-10 xl:flex 2xl:gap-[72px]"
            aria-label="Secciones del sitio"
          >
            {navigationLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target={link.target}
                rel={link.target === '_blank' ? 'noopener noreferrer' : undefined}
                className="whitespace-nowrap font-poppins text-base font-semibold text-brand-ink/75 transition-colors hover:text-[#466729] 2xl:text-lg"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <BtnAction href="/donacion" className="hidden xl:inline-flex xl:mr-6">
            ¡Quiero donar!
          </BtnAction>

          {/* Botón Hamburguesa Animado (Mobile) */}
          <button
            type="button"
            className="relative z-50 h-8 w-9 xl:hidden focus:outline-none"
            aria-label={isMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
            onClick={toggleMenu}
          >
            <span
              className={`absolute left-0 right-0 h-[3px] rounded-full transition-all duration-200 ${
                isMenuOpen ? 'bg-[#FFF8E9]' : 'bg-[#292621]'
              } ${
                burgerStage === 'closed' ? 'top-1' : ''
              } ${
                burgerStage === 'collapsing' ? 'top-3.5' : ''
              } ${
                burgerStage === 'rotating-1' ? 'top-3.5 rotate-[30deg]' : ''
              } ${
                burgerStage === 'rotated' ? 'top-3.5 rotate-[45deg]' : ''
              }`}
            />
            <span
              className={`absolute left-0 right-0 top-3.5 h-[3px] rounded-full transition-all duration-200 ${
                isMenuOpen ? 'bg-[#FFF8E9]' : 'bg-[#292621]'
              } ${
                burgerStage !== 'closed' ? 'hidden' : 'block'
              }`}
            />
            <span
              className={`absolute left-0 right-0 h-[3px] rounded-full transition-all duration-200 ${
                isMenuOpen ? 'bg-[#FFF8E9]' : 'bg-[#292621]'
              } ${
                burgerStage === 'closed' ? 'top-6' : ''
              } ${
                burgerStage === 'collapsing' ? 'top-3.5' : ''
              } ${
                burgerStage === 'rotating-1' ? 'top-3.5 rotate-[150deg]' : ''
              } ${
                burgerStage === 'rotated' ? 'top-3.5 rotate-[135deg]' : ''
              }`}
            />
          </button>
        </div>

        {/* Círculo expansivo animado (Se agrandó el radio de expansión a 2000px) */}
        <div
          className={`fixed rounded-full bg-[#292621] z-40 transition-all duration-500 cubic-bezier(0,0.995,0.99,1) xl:hidden pointer-events-none ${
            isMenuOpen
              ? 'w-[2000px] h-[2000px] -top-[800px] -right-[800px] opacity-100'
              : 'w-0 h-0 top-8 right-8 opacity-0'
          }`}
        />

        {/* Contenido del Menú Desplegable Centrado en Pantalla */}
        <nav
          className={`fixed inset-0 z-40 flex flex-col items-center justify-center h-screen w-screen px-6 xl:hidden transition-all duration-300 ${
            isMenuOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
          }`}
        >
          <ul className="flex flex-col items-center justify-center space-y-5 sm:space-y-6 font-poppins text-center w-full max-w-xs my-auto">
            {navigationLinks.map((link, index) => (
              <li
                key={link.href}
                className={`w-full transition-all duration-300 transform ${
                  isMenuOpen
                    ? 'translate-y-0 opacity-100'
                    : 'translate-y-6 opacity-0'
                }`}
                style={{ transitionDelay: `${isMenuOpen ? index * 60 : 0}ms` }}
              >
                <a
                  href={link.href}
                  target={link.target}
                  rel={link.target === '_blank' ? 'noopener noreferrer' : undefined}
                  className="block text-lg sm:text-xl font-semibold uppercase tracking-widest text-[#FFF8E9] hover:text-[#AF71DD] active:scale-95 transition-all"
                  onClick={closeMenu}
                >
                  {link.label}
                </a>
              </li>
            ))}
            <li
              className={`pt-2 w-full flex justify-center transition-all duration-300 transform ${
                isMenuOpen
                  ? 'translate-y-0 opacity-100'
                  : 'translate-y-6 opacity-0'
              }`}
              style={{ transitionDelay: `${isMenuOpen ? 260 : 0}ms` }}
            >
              <BtnAction href="/donacion" onClick={closeMenu}>
                ¡Quiero donar!
              </BtnAction>
            </li>
          </ul>
        </nav>
      </header>
    </>
  )
}

export default Navbar
