import { Search } from 'lucide-react'
import Footer from '../../components/layout/Footer'
import logoOllaVegana from '../../assets/brand/svgMagui/logo_olla_vegana.png'

function HomeTienda() {
  return (
    <div className="flex min-h-screen flex-col bg-[#FFF8E9]">
      <header className="h-[76px] w-full border-b border-[#AF71DD]/20 bg-[#FFF8E9] sm:h-[84px]">
        <div className="mx-auto flex h-full w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <form
            role="search"
            onSubmit={(event) => event.preventDefault()}
            className="flex h-[42px] w-full max-w-[320px] items-center gap-2 rounded-[20px] border border-[#AF71DD] bg-white px-3 text-[#AF71DD] sm:h-[46px]"
          >
            <Search aria-hidden="true" className="h-5 w-5 shrink-0" />
            <input
              type="search"
              name="productos"
              aria-label="Buscar productos"
              placeholder="Buscar productos"
              className="min-w-0 flex-1 bg-transparent font-poppins text-sm text-[#292621] outline-none placeholder:text-[#AF71DD]/70"
            />
          </form>
          <nav aria-label="Cuenta" className="flex shrink-0 items-center gap-3 font-scripter text-[14px] text-[#466729] sm:gap-4 sm:text-[16px]">
            <a className="transition-colors hover:text-[#F13107]" href="#iniciar-sesion">
              Iniciar Sesion
            </a>
            <span aria-hidden="true" className="h-5 w-px bg-[#466729]/60" />
            <a className="transition-colors hover:text-[#F13107]" href="#registrarme">
              Registrarme
            </a>
          </nav>
        </div>
      </header>
      <main className="flex h-[250px] w-full flex-none px-6 py-8" aria-label="Tienda online">
        <div className="flex flex-1 items-center justify-center">
          <img
            src={logoOllaVegana}
            alt="Olla Vegana"
            className="h-[300px] w-[300px] object-contain"
          />
        </div>
      </main>
      <p className="pb-8 text-center font-scripter text-[32px] font-normal text-[#466729]">
        Tienda en proceso
      </p>
      <Footer />
    </div>
  )
}

export default HomeTienda
