import { useState } from 'react'
import {
  Boxes, ChevronLeft, LayoutDashboard, LogOut, MapPin, Menu, Package,
  PanelsTopLeft, Search, Settings, ShoppingBag, Tags, X,
} from 'lucide-react'
import { adminNavigation } from '../data/mockAdminData'
import logoOllaVegana from '../../assets/png/logo_olla_vegana.png'
import { logoutAdmin } from '../../services/auth'

const iconMap = { LayoutDashboard, ShoppingBag, Package, Tags, Boxes, PanelsTopLeft, MapPin, Settings }

function AdminLayout({ activePage, onNavigate, children }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const navigate = (page) => {
    onNavigate(page)
    setMobileOpen(false)
  }

  const sidebar = (
    <>
      <div className="flex h-[76px] items-center justify-between border-b border-white/10 px-5">
        <a href="/admin" onClick={(event) => { event.preventDefault(); navigate('resumen') }} className="flex items-center gap-3" aria-label="Olla Vegana, resumen del panel">
          <img src={logoOllaVegana} alt="" className="h-10 w-10 rounded-xl bg-white object-contain p-1" />
          <span><strong className="block font-poppins text-sm font-semibold text-white">Olla Vegana</strong><span className="font-poppins text-xs text-white/55">Panel de tienda</span></span>
        </a>
        {mobileOpen && <button type="button" aria-label="Cerrar menú" onClick={() => setMobileOpen(false)} className="rounded-lg p-2 text-white hover:bg-white/10 lg:hidden"><X size={20} /></button>}
      </div>
      <nav aria-label="Navegación de administración" className="flex-1 px-3 py-5">
        <p className="mb-3 px-3 font-poppins text-[10px] font-semibold uppercase tracking-[.16em] text-white/40">Administración</p>
        <ul className="space-y-1">
          {adminNavigation.map(({ id, label, icon }) => {
            const Icon = iconMap[icon]
            return <li key={id}><button type="button" aria-current={activePage === id ? 'page' : undefined} onClick={() => navigate(id)} className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left font-poppins text-[13px] transition-colors ${activePage === id ? 'bg-[#AF71DD] font-medium text-white shadow-sm' : 'text-white/65 hover:bg-white/8 hover:text-white'}`}><Icon size={17} aria-hidden="true" /><span>{label}</span>{activePage === id && <ChevronLeft className="ml-auto rotate-180" size={15} aria-hidden="true" />}</button></li>
          })}
        </ul>
      </nav>
      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E8D4F6] font-poppins text-sm font-semibold text-[#69428A]">OV</span>
          <span className="min-w-0 flex-1"><strong className="block truncate font-poppins text-xs font-medium text-white">Sesión iniciada</strong><span className="font-poppins text-[10px] text-white/45">Administración</span></span>
          <button type="button" aria-label="Cerrar sesión" onClick={() => { logoutAdmin(); window.location.assign('/login') }} className="rounded-lg p-1 text-white/55 transition-colors hover:bg-white/10 hover:text-white"><LogOut size={15} aria-hidden="true" /></button>
        </div>
      </div>
    </>
  )

  return (
    <div className="min-h-screen bg-[#F7F5F2] text-[#292621] lg:flex">
      <aside className="hidden w-[252px] shrink-0 flex-col bg-[#292621] lg:sticky lg:top-0 lg:flex lg:h-screen">{sidebar}</aside>
      {mobileOpen && <div className="fixed inset-0 z-50 lg:hidden"><button type="button" aria-label="Cerrar menú" onClick={() => setMobileOpen(false)} className="absolute inset-0 bg-black/45" /><aside className="relative flex h-full w-[280px] max-w-[85vw] flex-col bg-[#292621] shadow-2xl">{sidebar}</aside></div>}
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-[68px] items-center gap-4 border-b border-black/[.06] bg-white/95 px-4 backdrop-blur sm:px-7">
          <button type="button" aria-label="Abrir menú de administración" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)} className="rounded-xl p-2 text-[#466729] hover:bg-[#466729]/5 lg:hidden"><Menu size={21} /></button>
          <div className="hidden items-center gap-2 text-xs text-black/40 sm:flex"><span>Panel</span><span aria-hidden="true">/</span><span className="font-medium text-[#466729]">{adminNavigation.find(({ id }) => id === activePage)?.label}</span></div>
          <span className="flex-1" />
          <label className="hidden h-9 w-[220px] items-center gap-2 rounded-xl border border-black/10 px-3 text-black/35 md:flex"><Search size={15} aria-hidden="true" /><input aria-label="Buscar en administración" placeholder="Buscar…" className="min-w-0 flex-1 bg-transparent font-poppins text-xs text-[#292621] outline-none placeholder:text-black/35" /></label>
          <span className="rounded-full border border-[#AF71DD]/20 bg-[#AF71DD]/10 px-3 py-1.5 font-poppins text-[10px] font-medium text-[#74439A]">ADMIN</span>
          <a href="/tienda" className="font-poppins text-xs text-[#466729] hover:underline">Ver tienda</a>
        </header>
        <main id="admin-main" className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-7 sm:py-8">{children}</main>
      </div>
    </div>
  )
}

export default AdminLayout
