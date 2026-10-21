import { useState } from 'react'
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

  const closeMenu = () => setIsMenuOpen(false)

  return (
    <header className="relative z-50 bg-brand-cream" aria-label="Navegación principal">
      <div className="mx-auto flex min-h-[8.5rem] max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
        <a
          href="#inicio"
          className="flex shrink-0 items-center text-brand-ink"
          aria-label="Olla Vegana, ir al inicio"
          onClick={closeMenu}
        >
          <img
            src={logoVaca}
            aria-label="Logo de Olla Vegana"
            className="h-[179px] w-[179px] shrink-0 object-contain"
          />
        </a>

        <nav className="absolute left-1/2 hidden w-max -translate-x-1/2 items-center justify-center gap-12 lg:flex" aria-label="Secciones del sitio">
          {navigationLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-base font-semibold text-brand-ink/75 transition-colors hover:text-brand-orange"
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
                className="rounded-xl px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
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
  )
}

export default Navbar
