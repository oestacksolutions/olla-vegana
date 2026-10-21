import { useState } from 'react'
import { Leaf, Menu, X } from 'lucide-react'
import logoVaca from '../assets/brand/svgMagui/logo_olla_vegana.png'

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
      <div className="mx-auto flex min-h-[7.5rem] max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
        <a
          href="#inicio"
          className="flex items-center gap-2 text-brand-ink"
          aria-label="Olla Vegana, ir al inicio"
          onClick={closeMenu}
        >
          <object
            data={logoVaca}
            aria-label="Logo de Olla Vegana"
            className="h-20 w-24"
          >
            <span className="font-display text-xs font-bold text-brand-ink">
              OLLA VEGANA
            </span>
          </object>
        </a>

        <nav className="hidden items-center gap-10 lg:flex" aria-label="Secciones del sitio">
          {navigationLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-semibold text-brand-ink/75 transition-colors hover:text-brand-orange"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <a
          href="#dona"
          className="hidden rounded-full bg-[#ad63dc] px-7 py-3.5 text-sm font-bold text-white shadow-sm transition-transform hover:-translate-y-0.5 hover:bg-[#9b4ecc] sm:inline-flex"
        >
          Quiero Ayudar!
        </a>

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
            <a
              href="#dona"
              className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl bg-[#ad63dc] px-4 py-3 text-sm font-bold text-white"
              onClick={closeMenu}
            >
              <Leaf size={16} />
              Quiero Ayudar!
            </a>
          </div>
        </nav>
      )}
    </header>
  )
}

export default Navbar
