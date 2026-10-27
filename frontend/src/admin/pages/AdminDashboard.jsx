import { useMemo, useState } from 'react'
import { ArrowDownRight, ArrowRight, ArrowUpRight, BadgeAlert, CircleDollarSign, Clock3, Package, Plus, ShoppingBag, Sparkles, Truck } from 'lucide-react'
import { mockSalesSeries } from '../data/mockAdminData'

const money = (value) => `$${value.toLocaleString('es-AR')}`

function SalesChart() {
  const points = mockSalesSeries.map((value, index) => `${20 + index * 56},${150 - value * 1.25}`).join(' ')
  return (
    <div className="mt-5">
      <div className="flex h-[190px]">
        <div className="flex flex-col justify-between pb-1 pr-3 font-poppins text-[10px] text-black/35"><span>$100k</span><span>$75k</span><span>$50k</span><span>$25k</span><span>$0</span></div>
        <div className="relative min-w-0 flex-1">
          {[0, 1, 2, 3, 4].map((line) => <div key={line} className="absolute inset-x-0 border-t border-dashed border-black/[.08]" style={{ top: `${line * 25}%` }} />)}
          <svg viewBox="0 0 660 160" preserveAspectRatio="none" role="img" aria-label="Gráfico ilustrativo de ventas con tendencia creciente durante el período" className="absolute inset-0 h-full w-full overflow-visible">
            <defs><linearGradient id="sales-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#AF71DD" stopOpacity=".28" /><stop offset="100%" stopColor="#AF71DD" stopOpacity="0" /></linearGradient></defs>
            <polygon points={`20,160 ${points} 636,160`} fill="url(#sales-fill)" />
            <polyline points={points} fill="none" stroke="#8E53B5" strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
            {mockSalesSeries.map((value, index) => <circle key={index} cx={20 + index * 56} cy={150 - value * 1.25} r="3.5" fill="#fff" stroke="#8E53B5" strokeWidth="2" vectorEffect="non-scaling-stroke" />)}
          </svg>
        </div>
      </div>
      <div className="ml-10 mt-2 flex justify-between font-poppins text-[10px] text-black/35"><span>01 oct</span><span>07 oct</span><span>14 oct</span><span>21 oct</span><span>Hoy</span></div>
    </div>
  )
}

function AdminDashboard({ snapshot, onNavigate }) {
  const [period, setPeriod] = useState('30 días')
  const [customRange, setCustomRange] = useState({ from: '', to: '' })
  const { orders, products } = snapshot
  const periodOrders = useMemo(() => {
    const sampleDate = new Date(Math.max(...orders.map((order) => new Date(order.date).getTime())))
    const start = new Date(sampleDate)
    if (period === 'Hoy') start.setHours(0, 0, 0, 0)
    else if (period === '7 días') start.setDate(start.getDate() - 6)
    else if (period === '30 días') start.setDate(start.getDate() - 29)
    return orders.filter((order) => {
      const orderDate = new Date(order.date)
      if (period === 'Personalizado') return (!customRange.from || order.date.slice(0, 10) >= customRange.from) && (!customRange.to || order.date.slice(0, 10) <= customRange.to)
      return orderDate >= start && orderDate <= sampleDate
    })
  }, [orders, period, customRange])
  const metrics = useMemo(() => {
    const paid = periodOrders.filter((order) => order.payment === 'Aprobado')
    return [
      { label: 'Ventas del período', value: periodOrders.length.toString(), helper: 'pedidos registrados · mock', icon: ShoppingBag, trend: '+12%', color: 'bg-[#EAF0E4] text-[#466729]' },
      { label: 'Recaudación del mes', value: money(paid.reduce((sum, order) => sum + order.total, 0)), helper: 'pagos aprobados · mock', icon: CircleDollarSign, trend: '+8%', color: 'bg-[#F2E8F8] text-[#8E53B5]' },
      { label: 'Pedidos nuevos', value: periodOrders.filter((order) => order.status === 'Nuevo').length.toString(), helper: 'requieren atención', icon: Sparkles, color: 'bg-[#FFF0E9] text-[#C75C32]' },
      { label: 'Pendientes de pago', value: periodOrders.filter((order) => order.payment === 'Pendiente').length.toString(), helper: 'esperando confirmación', icon: Clock3, color: 'bg-[#FFF5DD] text-[#A06A13]' },
      { label: 'Para preparar', value: periodOrders.filter((order) => order.payment === 'Aprobado' && ['Nuevo', 'En preparación'].includes(order.status)).length.toString(), helper: 'pagados · no retirados', icon: Package, color: 'bg-[#EAF0E4] text-[#466729]' },
      { label: 'Listos para retirar', value: periodOrders.filter((order) => order.status === 'Listo para retirar').length.toString(), helper: 'esperan en el punto', icon: Truck, color: 'bg-[#F2E8F8] text-[#8E53B5]' },
      { label: 'Retirados', value: periodOrders.filter((order) => order.status === 'Retirado').length.toString(), helper: 'entregas completadas', icon: ArrowUpRight, color: 'bg-[#EEF0F2] text-[#53616C]' },
      { label: 'Poco stock', value: products.filter((product) => product.stock > 0 && product.stock <= 5).length.toString(), helper: '5 unidades o menos', icon: BadgeAlert, color: 'bg-[#FFF5DD] text-[#A06A13]' },
      { label: 'Agotados', value: products.filter((product) => product.stock === 0).length.toString(), helper: 'sin unidades disponibles', icon: ArrowDownRight, color: 'bg-[#FCE9E6] text-[#B34234]' },
    ]
  }, [periodOrders, products])

  const latestOrders = [...periodOrders].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 4)
  const lowStock = products.filter((product) => product.stock <= 3)

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="font-poppins text-xs font-medium text-[#8E53B5]">Martes, 27 de octubre de 2026</p><h1 className="mt-1 font-poppins text-2xl font-semibold tracking-[-.03em] text-[#292621] sm:text-[28px]">Resumen general</h1><p className="mt-1 font-poppins text-sm text-black/50">Un vistazo a la actividad de tu tienda.</p></div>
        <div className="flex flex-wrap items-center gap-2" aria-label="Filtrar por período">
          {['Hoy', '7 días', '30 días', 'Personalizado'].map((item) => <button key={item} type="button" aria-pressed={period === item} onClick={() => setPeriod(item)} className={`rounded-lg px-3 py-2 font-poppins text-xs transition-colors ${period === item ? 'bg-[#466729] text-white' : 'border border-black/10 bg-white text-black/55 hover:border-[#466729]/40 hover:text-[#466729]'}`}>{item}</button>)}
        </div>
      </div>
      {period === 'Personalizado' && <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-black/[.06] bg-white p-4"><label className="font-poppins text-xs text-black/55">Desde<input type="date" value={customRange.from} onChange={(event) => setCustomRange((range) => ({ ...range, from: event.target.value }))} className="mt-1 block rounded-lg border border-black/10 px-3 py-2 text-sm text-[#292621]" /></label><label className="font-poppins text-xs text-black/55">Hasta<input type="date" value={customRange.to} onChange={(event) => setCustomRange((range) => ({ ...range, to: event.target.value }))} className="mt-1 block rounded-lg border border-black/10 px-3 py-2 text-sm text-[#292621]" /></label><p className="font-poppins text-[10px] text-black/40">Datos demostrativos; el rango se conectará al servicio de ventas.</p></div>}

      <section aria-label="Indicadores de tienda" className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-3">
        {metrics.map(({ label, value, helper, icon: Icon, trend, color }) => <article key={label} className="rounded-2xl border border-black/[.055] bg-white p-4 shadow-[0_2px_10px_rgba(24,20,16,.025)] sm:p-5"><div className="flex items-start justify-between gap-3"><div><p className="font-poppins text-xs text-black/50">{label}</p><p className="mt-2 font-poppins text-[25px] font-semibold leading-none tracking-[-.04em] text-[#292621]">{value}</p></div><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${color}`}><Icon size={17} aria-hidden="true" /></span></div><div className="mt-4 flex items-center justify-between gap-2"><span className="font-poppins text-[10px] text-black/40">{helper}</span>{trend && <span className="font-poppins text-[10px] font-medium text-[#466729]">{trend}</span>}</div></article>)}
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,.8fr)]">
        <section className="rounded-2xl border border-black/[.055] bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-poppins text-sm font-semibold text-[#292621]">Ventas por período</h2><p className="mt-1 font-poppins text-[11px] text-black/40">Tendencia ilustrativa · datos simulados</p></div><span className="rounded-lg bg-[#F2E8F8] px-2.5 py-1.5 font-poppins text-[10px] font-medium text-[#74439A]">{period}</span></div>
          <SalesChart />
        </section>
        <section className="rounded-2xl border border-black/[.055] bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between"><div><h2 className="font-poppins text-sm font-semibold text-[#292621]">Alertas importantes</h2><p className="mt-1 font-poppins text-[11px] text-black/40">Revisá estos temas</p></div><BadgeAlert size={18} className="text-[#C78322]" aria-hidden="true" /></div>
          <ul className="mt-4 space-y-3">
            {periodOrders.some((order) => order.payment === 'Pendiente') && <li className="flex gap-3 rounded-xl bg-[#FFF7E7] p-3"><span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-[#C78322]" /><p className="font-poppins text-xs leading-5 text-black/65"><strong className="font-semibold text-[#85550E]">Pago pendiente</strong><br />Hay pedidos esperando confirmación del proveedor.</p></li>}
            {lowStock.length > 0 ? lowStock.map((product) => <li key={product.id} className="flex gap-3 rounded-xl bg-[#FCEFED] p-3"><span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-[#C45747]" /><p className="font-poppins text-xs leading-5 text-black/65"><strong className="font-semibold text-[#9E4034]">Stock bajo · {product.name}</strong><br />Quedan {product.stock} unidades.</p></li>) : <li className="rounded-xl bg-[#EEF3EA] p-3 font-poppins text-xs text-[#466729]">No hay alertas de stock bajo.</li>}
            <li className="rounded-xl border border-[#AF71DD]/20 bg-[#F8F2FB] p-3 font-poppins text-[10px] leading-5 text-[#69428A]">Los pagos son solo demostrativos. No se confirma ningún pago desde este panel.</li>
          </ul>
        </section>
      </div>

      <section className="overflow-hidden rounded-2xl border border-black/[.055] bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-black/[.06] px-5 py-4 sm:px-6"><div><h2 className="font-poppins text-sm font-semibold text-[#292621]">Últimos pedidos</h2><p className="mt-1 font-poppins text-[11px] text-black/40">Actividad reciente · datos simulados</p></div><button type="button" onClick={() => onNavigate('pedidos')} className="inline-flex items-center gap-1 font-poppins text-xs font-medium text-[#74439A] hover:underline">Ver todos <ArrowRight size={14} aria-hidden="true" /></button></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left"><thead><tr className="bg-[#FBFAF8] font-poppins text-[10px] uppercase tracking-wider text-black/40"><th className="px-5 py-3 font-medium sm:px-6">Pedido</th><th className="px-4 py-3 font-medium">Comprador</th><th className="px-4 py-3 font-medium">Total</th><th className="px-4 py-3 font-medium">Pago</th><th className="px-4 py-3 font-medium">Estado</th></tr></thead><tbody>{latestOrders.map((order) => <tr key={order.id} className="border-t border-black/[.045] font-poppins text-xs"><td className="px-5 py-3.5 font-medium text-[#466729] sm:px-6">{order.id}</td><td className="px-4 py-3.5 text-black/70">{order.customer}</td><td className="px-4 py-3.5 text-black/70">{money(order.total)}</td><td className="px-4 py-3.5"><span className={`rounded-full px-2 py-1 text-[10px] ${order.payment === 'Aprobado' ? 'bg-[#EAF0E4] text-[#466729]' : 'bg-[#FFF3D9] text-[#966316]'}`}>{order.payment}</span></td><td className="px-4 py-3.5 text-black/60">{order.status}</td></tr>)}</tbody></table>{latestOrders.length === 0 && <p className="p-8 text-center font-poppins text-xs text-black/45">No hay pedidos en este rango de fechas.</p>}</div>
      </section>

      <section aria-label="Accesos rápidos" className="grid gap-3 sm:grid-cols-3">
        {[['Agregar producto', 'productos', 'Crear una ficha nueva'], ['Consultar pedidos', 'pedidos', 'Ver y preparar compras'], ['Modificar banners', 'banners', 'Actualizar la portada']].map(([label, page, helper]) => <button key={page} type="button" onClick={() => onNavigate(page)} className="group flex items-center gap-4 rounded-2xl border border-black/[.055] bg-white p-4 text-left transition-all hover:-translate-y-0.5 hover:border-[#AF71DD]/40 hover:shadow-md"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F2E8F8] text-[#8E53B5]"><Plus size={18} /></span><span className="flex-1"><strong className="block font-poppins text-xs font-semibold text-[#292621]">{label}</strong><small className="mt-1 block font-poppins text-[10px] text-black/45">{helper}</small></span><ArrowRight size={15} className="text-black/25 transition-transform group-hover:translate-x-1 group-hover:text-[#8E53B5]" /></button>)}
      </section>
      <p className="text-center font-poppins text-[10px] text-black/35">Panel de demostración · La información no representa datos reales ni confirma pagos.</p>
    </div>
  )
}

export default AdminDashboard
