import { useMemo, useState } from 'react'
import { Download, Search, X } from 'lucide-react'

const orderStatuses = ['Nuevo', 'En preparación', 'Listo para retirar', 'Cancelado']

function Badge({ children, type = 'neutral' }) {
  const styles = type === 'paid' ? 'bg-[#EAF0E4] text-[#466729]' : type === 'waiting' ? 'bg-[#FFF3D9] text-[#966316]' : type === 'danger' ? 'bg-[#FCE9E6] text-[#B34234]' : 'bg-[#F0EDF2] text-[#61596A]'
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 font-poppins text-[10px] font-medium ${styles}`}>{children}</span>
}

function AdminOrdersPage({ orders, onUpdateOrder }) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('Todos los estados')
  const [paymentFilter, setPaymentFilter] = useState('Todos los pagos')
  const [pickupFilter, setPickupFilter] = useState('Todos los puntos')
  const [dateRange, setDateRange] = useState({ from: '', to: '' })
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [confirmPickup, setConfirmPickup] = useState(false)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const filtered = useMemo(() => orders.filter((order) => {
    const search = query.trim().toLowerCase()
    return (!search || `${order.id} ${order.customer} ${order.email}`.toLowerCase().includes(search))
      && (statusFilter === 'Todos los estados' || order.status === statusFilter)
      && (paymentFilter === 'Todos los pagos' || order.payment === paymentFilter)
      && (pickupFilter === 'Todos los puntos' || order.pickup === pickupFilter)
      && (!dateRange.from || order.date.slice(0, 10) >= dateRange.from)
      && (!dateRange.to || order.date.slice(0, 10) <= dateRange.to)
  }), [orders, query, statusFilter, paymentFilter, pickupFilter, dateRange])

  const exportCsv = () => {
    const header = ['Pedido', 'Fecha', 'Comprador', 'Email', 'Productos', 'Cantidad', 'Total', 'Pago', 'Estado', 'Punto de retiro']
    const rows = filtered.map((order) => [order.id, new Date(order.date).toLocaleString('es-AR'), order.customer, order.email, order.products, order.quantity, order.total, order.payment, order.status, order.pickup])
    const csv = [header, ...rows].map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n')
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }))
    link.download = 'olla-vegana-ventas-demo.csv'
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const saveChanges = async (updates) => {
    if (!selectedOrder) return
    if (updates.status && updates.status !== 'Listo para retirar') setConfirmPickup(false)
    setBusy(true)
    setNotice('')
    try {
      const saved = await onUpdateOrder(selectedOrder.id, updates)
      setSelectedOrder(saved)
      setNotice('Cambios guardados en los datos de demostración.')
    } catch (error) {
      setNotice(error.message || 'No pudimos guardar los cambios. Intentá nuevamente.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="font-poppins text-xs font-medium text-[#8E53B5]">Tienda · administración</p><h1 className="mt-1 font-poppins text-2xl font-semibold text-[#292621]">Pedidos y ventas</h1><p className="mt-1 font-poppins text-sm text-black/50">Los pagos son simulados y de solo lectura en esta demo.</p></div><button type="button" onClick={exportCsv} className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-xl border border-[#466729]/20 bg-white px-4 font-poppins text-xs font-medium text-[#466729] hover:bg-[#466729]/5"><Download size={15} aria-hidden="true" />Exportar CSV</button></div>
      <section aria-label="Filtros de pedidos" className="grid gap-3 rounded-2xl border border-black/[.06] bg-white p-4 sm:grid-cols-2 xl:grid-cols-4">
        <label className="relative"><span className="sr-only">Buscar por número de pedido o comprador</span><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/35" aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pedido, nombre o email" className="h-10 w-full rounded-lg border border-black/10 pl-9 pr-3 font-poppins text-xs" /></label>
        {[['Estado del pedido', statusFilter, setStatusFilter, ['Todos los estados', ...orderStatuses]], ['Estado del pago', paymentFilter, setPaymentFilter, ['Todos los pagos', 'Pendiente', 'Aprobado', 'Rechazado', 'Reembolsado']], ['Punto de retiro', pickupFilter, setPickupFilter, ['Todos los puntos', ...new Set(orders.map(({ pickup }) => pickup))]]].map(([label, value, setter, options]) => <label key={label} className="font-poppins text-[10px] text-black/45"><span className="sr-only">{label}</span><select value={value} onChange={(event) => setter(event.target.value)} className="h-10 w-full rounded-lg border border-black/10 bg-white px-3 font-poppins text-xs text-[#292621]">{options.map((option) => <option key={option}>{option}</option>)}</select></label>)}
      </section>
      <section aria-label="Filtrar por fecha" className="flex flex-wrap items-end gap-3 rounded-2xl border border-black/[.06] bg-white p-4"><label className="font-poppins text-[10px] text-black/45">Desde<input type="date" value={dateRange.from} onChange={(event) => setDateRange((range) => ({ ...range, from: event.target.value }))} className="mt-1 block h-9 rounded-lg border border-black/10 px-2 font-poppins text-xs text-[#292621]" /></label><label className="font-poppins text-[10px] text-black/45">Hasta<input type="date" value={dateRange.to} onChange={(event) => setDateRange((range) => ({ ...range, to: event.target.value }))} className="mt-1 block h-9 rounded-lg border border-black/10 px-2 font-poppins text-xs text-[#292621]" /></label><span className="pb-2 font-poppins text-[10px] text-black/40">Filtrado local · datos de muestra</span></section>
      <section className="overflow-hidden rounded-2xl border border-black/[.06] bg-white">
        <div className="flex justify-between border-b border-black/[.06] px-5 py-4"><div><h2 className="font-poppins text-sm font-semibold">Todos los pedidos</h2><p className="mt-1 font-poppins text-[10px] text-black/40">{filtered.length} resultados · datos de muestra</p></div></div>
        {filtered.length ? <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left"><thead><tr className="bg-[#FBFAF8] font-poppins text-[10px] uppercase tracking-wider text-black/40">{['Pedido / fecha', 'Comprador', 'Productos', 'Total', 'Pago', 'Pedido', 'Retiro', ''].map((heading) => <th key={heading} className="px-4 py-3 font-medium first:pl-5">{heading}</th>)}</tr></thead><tbody>{filtered.map((order) => <tr key={order.id} className="border-t border-black/[.045] font-poppins text-xs"><td className="px-4 py-3.5 pl-5"><strong className="block font-medium text-[#466729]">{order.id}</strong><span className="mt-1 block text-[10px] text-black/40">{new Date(order.date).toLocaleString('es-AR')}</span></td><td className="px-4 py-3.5"><span className="block text-black/75">{order.customer}</span><span className="mt-1 block text-[10px] text-black/40">{order.email}</span></td><td className="max-w-[220px] px-4 py-3.5 text-black/60">{order.products} <span className="block text-[10px] text-black/40">Cantidad: {order.quantity}</span></td><td className="px-4 py-3.5 font-medium">${order.total.toLocaleString('es-AR')}</td><td className="px-4 py-3.5"><Badge type={order.payment === 'Aprobado' ? 'paid' : order.payment === 'Rechazado' ? 'danger' : 'waiting'}>{order.payment}</Badge></td><td className="px-4 py-3.5"><Badge>{order.status}</Badge></td><td className="px-4 py-3.5 text-black/60">{order.pickup}</td><td className="px-4 py-3.5"><button type="button" onClick={() => { setSelectedOrder(order); setNotice(''); setConfirmPickup(false) }} className="rounded-lg border border-[#AF71DD]/30 px-3 py-2 font-poppins text-[10px] font-medium text-[#74439A] hover:bg-[#F8F2FB]">Ver detalle</button></td></tr>)}</tbody></table></div> : <div className="p-12 text-center"><p className="font-poppins text-sm font-medium text-[#292621]">No encontramos pedidos</p><p className="mt-1 font-poppins text-xs text-black/45">Probá cambiar los filtros o la búsqueda.</p></div>}
      </section>

      {selectedOrder && <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedOrder(null) }}><section role="dialog" aria-modal="true" aria-labelledby="order-detail-title" className="max-h-[92dvh] w-full max-w-[760px] overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-7">
        <div className="flex items-start justify-between gap-4"><div><p className="font-poppins text-[10px] font-semibold uppercase tracking-wider text-[#8E53B5]">Detalle del pedido</p><h2 id="order-detail-title" className="mt-1 font-poppins text-xl font-semibold text-[#292621]">{selectedOrder.id}</h2></div><button type="button" aria-label="Cerrar detalle" onClick={() => setSelectedOrder(null)} className="rounded-lg p-2 text-black/45 hover:bg-black/5"><X size={18} /></button></div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2"><div className="rounded-xl bg-[#F8F7F5] p-4"><h3 className="font-poppins text-xs font-semibold text-[#466729]">Comprador</h3><p className="mt-2 font-poppins text-sm">{selectedOrder.customer}</p><p className="mt-1 font-poppins text-xs text-black/50">{selectedOrder.email}</p><p className="mt-3 font-poppins text-xs text-black/55">Compra: {new Date(selectedOrder.date).toLocaleString('es-AR')}</p></div><div className="rounded-xl bg-[#F8F7F5] p-4"><h3 className="font-poppins text-xs font-semibold text-[#466729]">Compra y retiro</h3><p className="mt-2 font-poppins text-xs leading-5 text-black/65">{selectedOrder.products}</p><p className="mt-2 font-poppins text-sm font-semibold">Total: ${selectedOrder.total.toLocaleString('es-AR')}</p><p className="mt-1 font-poppins text-xs text-black/55">Punto: {selectedOrder.pickup}</p></div></div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2"><div className="rounded-xl border border-black/[.07] p-4"><h3 className="font-poppins text-xs font-semibold">Estado del pago</h3><div className="mt-2"><Badge type={selectedOrder.payment === 'Aprobado' ? 'paid' : 'waiting'}>{selectedOrder.payment}</Badge></div><p className="mt-3 font-poppins text-[10px] leading-4 text-black/45">Solo lectura. El pago se actualizará con confirmación verificada del proveedor a través del backend.</p></div><div className="rounded-xl border border-black/[.07] p-4"><label htmlFor="admin-order-status" className="font-poppins text-xs font-semibold">Estado del pedido (demo)</label>{selectedOrder.status === 'Retirado' ? <p className="mt-2 rounded-lg bg-[#EAF0E4] p-3 font-poppins text-xs text-[#466729]">Retirado</p> : <select id="admin-order-status" value={selectedOrder.status} disabled={busy} onChange={(event) => saveChanges({ status: event.target.value })} className="mt-2 h-10 w-full rounded-lg border border-black/10 bg-white px-3 font-poppins text-xs">{orderStatuses.map((status) => <option key={status}>{status}</option>)}</select>}<p className="mt-2 font-poppins text-[10px] leading-4 text-black/45">El estado del pago no cambia al actualizar la preparación. En producción, el backend validará las transiciones.</p>{selectedOrder.pickedUpAt && <p className="mt-2 font-poppins text-[10px] text-black/50">Retirado: {new Date(selectedOrder.pickedUpAt).toLocaleString('es-AR')} · {selectedOrder.pickedUpBy}</p>}</div></div>
        <label htmlFor="order-internal-note" className="mt-4 block font-poppins text-xs font-semibold">Observaciones internas</label><textarea id="order-internal-note" rows="3" defaultValue={selectedOrder.notes} key={selectedOrder.id} className="mt-2 w-full resize-y rounded-xl border border-black/10 p-3 font-poppins text-xs" placeholder="Notas visibles solo para el equipo" onBlur={(event) => { if (event.target.value !== (selectedOrder.notes || '')) saveChanges({ notes: event.target.value }) }} />
        <section className="mt-4 rounded-xl bg-[#F8F7F5] p-4"><h3 className="font-poppins text-xs font-semibold">Historial</h3><ol className="mt-3 space-y-2">{(selectedOrder.history || []).map((item, index) => <li key={`${item}-${index}`} className="flex gap-2 font-poppins text-[10px] text-black/55"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#AF71DD]" />{item}</li>)}</ol></section>
        {selectedOrder.status === 'Listo para retirar' && <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-[#466729]/20 bg-[#F5F8F2] p-4"><input type="checkbox" checked={confirmPickup} onChange={(event) => setConfirmPickup(event.target.checked)} className="mt-0.5 accent-[#466729]" /><span className="font-poppins text-xs leading-5 text-black/70">Confirmo que el pedido se entregó al comprador. Esta acción quedará registrada en el historial.</span></label>}
        {confirmPickup && selectedOrder.status === 'Listo para retirar' && <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-[#FFF5DD] p-3"><p className="flex-1 font-poppins text-[10px] text-[#85550E]">Al confirmar, el estado cambiará a “Retirado”.</p><button type="button" disabled={busy} onClick={() => { setConfirmPickup(false); saveChanges({ status: 'Retirado' }) }} className="rounded-lg bg-[#466729] px-3 py-2 font-poppins text-[10px] font-medium text-white disabled:opacity-50">Confirmar retiro</button></div>}
        {notice && <p role="status" aria-live="polite" className="mt-3 font-poppins text-xs text-[#466729]">{notice}</p>}
        <div className="mt-5 flex justify-end"><button type="button" onClick={() => setSelectedOrder(null)} className="rounded-full border border-black/10 px-5 py-2.5 font-poppins text-xs text-black/60 hover:bg-black/5">Cerrar</button></div>
      </section></div>}
    </div>
  )
}

export default AdminOrdersPage
