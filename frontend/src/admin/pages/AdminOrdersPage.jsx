import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, X, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react'
import { confirmAdminTransfer, getAdminOrder, getAdminOrders, updateAdminOrderStatus } from '../../services/api'

const PAGE_SIZE = 20
const orderStates = { NUEVO: 'Nuevo', EN_PREPARACION: 'En preparación', LISTO_PARA_RETIRAR: 'Listo para retirar', RETIRADO: 'Retirado', CANCELADO: 'Cancelado' }
const paymentStates = { PENDIENTE: 'Pendiente', APROBADO: 'Aprobado', RECHAZADO: 'Rechazado', REEMBOLSADO: 'Reembolsado' }
const paymentMethods = { MERCADO_PAGO: 'Mercado Pago', TRANSFERENCIA: 'Transferencia bancaria' }

function formatMoney(value) {
  if (typeof value !== 'string' || !/^\d+(?:\.\d{1,2})?$/.test(value)) return 'Importe no disponible'
  const [whole, fraction = ''] = value.split('.')
  const grouped = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(BigInt(whole))
  return `$ ${grouped},${(fraction + '00').slice(0, 2)}`
}

function dateLabel(value) {
  return value ? new Date(value).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }) : '—'
}

function newIdempotencyKey() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID()
  const bytes = new Uint8Array(16)
  window.crypto.getRandomValues(bytes)
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function Badge({ children, tone = 'neutral' }) {
  const style = tone === 'good' ? 'bg-[#EAF0E4] text-[#466729]' : tone === 'bad' ? 'bg-[#FCE9E6] text-[#B34234]' : tone === 'pending' ? 'bg-[#FFF3D9] text-[#966316]' : 'bg-[#F0EDF2] text-[#61596A]'
  return <span className={`inline-flex rounded-full px-2.5 py-1 font-poppins text-[10px] font-medium ${style}`}>{children}</span>
}

function AdminOrdersPage() {
  const [filters, setFilters] = useState({ q: '', estado: '', estadoPago: '', metodoPago: '', retiro: '', desde: '', hasta: '' })
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState([])
  const [pages, setPages] = useState(0)
  const [total, setTotal] = useState(0)
  const [operationalChangesEnabled, setOperationalChangesEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [transferReference, setTransferReference] = useState('')
  const [transferAcknowledged, setTransferAcknowledged] = useState(false)
  const transferAttempt = useRef(null)
  const requestNumber = useRef(0)
  const serializedFilters = useMemo(() => JSON.stringify(filters), [filters])

  async function loadOrders(targetPage = page) {
    const request = ++requestNumber.current
    setLoading(true); setError('')
    try {
      const response = await getAdminOrders({ ...filters, page: targetPage, limit: PAGE_SIZE })
      if (request !== requestNumber.current) return
      setRows(response.pedidos || [])
      setPages(response.paginacion?.paginas || 0)
      setTotal(response.paginacion?.total || 0)
      setOperationalChangesEnabled(Boolean(response.acciones?.cambiosOperativosHabilitados))
      setPage(response.paginacion?.pagina || targetPage)
    } catch (requestError) {
      if (request === requestNumber.current) setError(requestError.message || 'No pudimos cargar los pedidos.')
    } finally { if (request === requestNumber.current) setLoading(false) }
  }

  useEffect(() => { setPage(1); loadOrders(1) }, [serializedFilters])
  useEffect(() => { if (page > 1) loadOrders(page) }, [page])

  useEffect(() => {
    if (!selectedId) { setDetail(null); return undefined }
    let active = true
    setDetailLoading(true); setDetailError(''); setNotice('')
    getAdminOrder(selectedId).then((response) => { if (active) setDetail(response) })
      .catch((requestError) => { if (active) setDetailError(requestError.message || 'No pudimos cargar el detalle.') })
      .finally(() => { if (active) setDetailLoading(false) })
    return () => { active = false }
  }, [selectedId])

  function setFilter(key, value) { setFilters((current) => ({ ...current, [key]: value })); setPage(1) }
  function clearFilters() { setFilters({ q: '', estado: '', estadoPago: '', metodoPago: '', retiro: '', desde: '', hasta: '' }); setPage(1) }

  async function changeState(nextState) {
    if (!detail || saving || !operationalChangesEnabled) return
    const label = orderStates[nextState]
    const confirmation = nextState === 'RETIRADO'
      ? '¿Confirmás que este pedido fue entregado al comprador?'
      : `¿Confirmás cambiar el pedido ${detail.numeroPublico} a “${label}”?`
    if (!window.confirm(confirmation)) return
    setSaving(true); setNotice('')
    try {
      const updated = await updateAdminOrderStatus(detail.id, { estado: nextState })
      setDetail(updated); setNotice('Estado operativo actualizado.')
      await loadOrders(page)
    } catch (requestError) {
      setNotice(requestError.status === 503
        ? 'El cambio de estado sigue bloqueado hasta validar transacciones en MongoDB aislado.'
        : (requestError.message || 'No pudimos actualizar el estado. El pedido pudo cambiar en otra sesión; actualizá el detalle.'))
    } finally { setSaving(false) }
  }

  async function confirmTransfer() {
    if (!detail?.puedeConfirmarTransferencia || !detail?.acciones?.confirmacionTransferenciaHabilitada || !transferAcknowledged || saving) return
    if (!transferReference.trim()) { setNotice('Ingresá la referencia de la transferencia observada.'); return }
    if (!window.confirm(`¿Confirmás que recibiste ${formatMoney(detail.total)} para el pedido ${detail.numeroPublico}?`)) return
    const fingerprint = `${detail.id}|${transferReference.trim()}|${detail.total}`
    if (transferAttempt.current?.fingerprint !== fingerprint) transferAttempt.current = { fingerprint, key: newIdempotencyKey() }
    setSaving(true); setNotice('')
    try {
      const result = await confirmAdminTransfer(detail.id, { referencia: transferReference.trim(), importeAcreditado: detail.total }, transferAttempt.current.key)
      transferAttempt.current = null
      setNotice(result.tardia
        ? 'La confirmación se registró como tardía y requiere conciliación; el pedido no se marcó como pagado.'
        : 'Transferencia confirmada y registrada en la auditoría.')
      setTransferAcknowledged(false)
      const updated = await getAdminOrder(detail.id)
      setDetail(updated); await loadOrders(page)
    } catch (requestError) {
      setNotice(requestError.status === 503
        ? 'La confirmación está bloqueada hasta verificar los índices requeridos.'
        : (requestError.message || 'No pudimos confirmar la transferencia. Si reintentás la misma operación, se conservará su clave.'))
    } finally { setSaving(false) }
  }

  const hasRefundBlockingDelivery = Boolean(detail && (
    (detail.estadoReintegro && detail.estadoReintegro !== 'SIN_REINTEGRO')
    || detail.reintegros?.some((refund) => refund.estado !== 'FALLIDO')
  ))
  const nextOperationalState = detail?.estado === 'NUEVO' ? 'EN_PREPARACION'
    : detail?.estado === 'EN_PREPARACION' ? 'LISTO_PARA_RETIRAR'
      : detail?.estado === 'LISTO_PARA_RETIRAR' && detail?.estadoPago === 'APROBADO' && !hasRefundBlockingDelivery ? 'RETIRADO' : null

  return <div className="space-y-5">
    <header><p className="font-poppins text-xs font-medium text-[#8E53B5]">Tienda · administración</p><h1 className="mt-1 font-poppins text-2xl font-semibold text-[#292621]">Pedidos y ventas</h1><p className="mt-1 font-poppins text-sm text-black/50">Pedidos reales, snapshots históricos y estados financieros informados por el backend.</p></header>
    <section aria-label="Filtros de pedidos" className="grid gap-3 rounded-2xl border border-black/[.06] bg-white p-4 sm:grid-cols-2 xl:grid-cols-4">
      <label className="relative"><span className="sr-only">Buscar número, nombre o correo</span><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/35" aria-hidden="true" /><input value={filters.q} onChange={(event) => setFilter('q', event.target.value)} placeholder="Pedido, nombre o email" className="h-10 w-full rounded-lg border border-black/10 pl-9 pr-3 font-poppins text-xs" /></label>
      <label className="font-poppins text-[10px] text-black/45">Estado del pedido<select value={filters.estado} onChange={(event) => setFilter('estado', event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-black/10 bg-white px-3 font-poppins text-xs"><option value="">Todos</option>{Object.entries(orderStates).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>
      <label className="font-poppins text-[10px] text-black/45">Estado del pago<select value={filters.estadoPago} onChange={(event) => setFilter('estadoPago', event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-black/10 bg-white px-3 font-poppins text-xs"><option value="">Todos</option>{Object.entries(paymentStates).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>
      <label className="font-poppins text-[10px] text-black/45">Medio de pago<select value={filters.metodoPago} onChange={(event) => setFilter('metodoPago', event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-black/10 bg-white px-3 font-poppins text-xs"><option value="">Todos</option>{Object.entries(paymentMethods).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>
      <label className="font-poppins text-[10px] text-black/45">Punto o lugar de retiro<input value={filters.retiro} onChange={(event) => setFilter('retiro', event.target.value)} placeholder="Buscar lugar" className="mt-1 h-10 w-full rounded-lg border border-black/10 px-3 font-poppins text-xs" /></label>
      <label className="font-poppins text-[10px] text-black/45">Desde<input type="date" value={filters.desde} onChange={(event) => setFilter('desde', event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-black/10 px-3 font-poppins text-xs" /></label>
      <label className="font-poppins text-[10px] text-black/45">Hasta<input type="date" value={filters.hasta} onChange={(event) => setFilter('hasta', event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-black/10 px-3 font-poppins text-xs" /></label>
      <button type="button" onClick={clearFilters} className="h-10 self-end rounded-lg border border-black/10 px-3 font-poppins text-xs text-black/55 hover:bg-black/[.03]">Limpiar filtros</button>
    </section>

    {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 font-poppins text-sm text-red-800">{error}<button type="button" onClick={() => loadOrders(page)} className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2"><RefreshCw size={14} />Reintentar</button></div>}
    <section className="overflow-hidden rounded-2xl border border-black/[.06] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/[.06] px-5 py-4"><div><h2 className="font-poppins text-sm font-semibold">Pedidos</h2><p className="mt-1 font-poppins text-[10px] text-black/40">{loading ? 'Consultando…' : `${total} resultados`}</p></div></div>
      {loading ? <p role="status" className="p-10 text-center font-poppins text-sm text-black/45">Cargando pedidos…</p>
        : error ? null : rows.length === 0 ? <div className="p-12 text-center"><p className="font-poppins text-sm font-medium text-[#292621]">No hay pedidos con estos filtros</p><p className="mt-1 font-poppins text-xs text-black/45">Probá cambiar la búsqueda o el período.</p></div>
          : <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-left"><thead><tr className="bg-[#FBFAF8] font-poppins text-[10px] uppercase tracking-wider text-black/40">{['Pedido / fecha', 'Comprador', 'Total', 'Pago', 'Estado operativo', 'Retiro', ''].map((title) => <th key={title} className="px-4 py-3 font-medium first:pl-5">{title}</th>)}</tr></thead><tbody>{rows.map((order) => <tr key={order.id} className="border-t border-black/[.045] font-poppins text-xs"><td className="px-4 py-3.5 pl-5"><strong className="block font-medium text-[#466729]">{order.numeroPublico}</strong><span className="mt-1 block text-[10px] text-black/40">{dateLabel(order.creadoEn)}</span></td><td className="px-4 py-3.5"><span className="block text-black/75">{order.comprador.nombre} {order.comprador.apellido}</span><span className="mt-1 block text-[10px] text-black/40">{order.comprador.correo}</span></td><td className="px-4 py-3.5 font-medium">{formatMoney(order.total)}</td><td className="px-4 py-3.5"><span className="mb-1 block text-[10px] text-black/45">{paymentMethods[order.metodoPago] || order.metodoPago}</span><Badge tone={order.estadoPago === 'APROBADO' ? 'good' : order.estadoPago === 'RECHAZADO' || order.estadoPago === 'REEMBOLSADO' ? 'bad' : 'pending'}>{paymentStates[order.estadoPago] || order.estadoPago}</Badge></td><td className="px-4 py-3.5"><Badge>{orderStates[order.estado] || order.estado}</Badge></td><td className="max-w-[160px] px-4 py-3.5 text-black/60">{order.retiro?.nombre || order.retiro?.lugar || 'No disponible'}</td><td className="px-4 py-3.5"><button type="button" onClick={() => setSelectedId(order.id)} className="rounded-lg border border-[#AF71DD]/30 px-3 py-2 font-poppins text-[10px] font-medium text-[#74439A] hover:bg-[#F8F2FB]">Ver detalle</button></td></tr>)}</tbody></table></div>}
      {!loading && !error && pages > 1 && <div className="flex items-center justify-between border-t border-black/[.06] px-5 py-3 font-poppins text-xs text-black/50"><span>Página {page} de {pages}</span><div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="inline-flex items-center gap-1 rounded-lg border border-black/10 px-3 py-2 disabled:opacity-40"><ChevronLeft size={14} />Anterior</button><button type="button" disabled={page >= pages} onClick={() => setPage((value) => value + 1)} className="inline-flex items-center gap-1 rounded-lg border border-black/10 px-3 py-2 disabled:opacity-40">Siguiente<ChevronRight size={14} /></button></div></div>}
    </section>

    {selectedId && <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedId('') }}><section role="dialog" aria-modal="true" aria-labelledby="admin-order-detail-heading" className="max-h-[94dvh] w-full max-w-[900px] overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-7">
      <div className="flex items-start justify-between gap-4"><div><p className="font-poppins text-[10px] font-semibold uppercase tracking-wider text-[#8E53B5]">Detalle de pedido</p><h2 id="admin-order-detail-heading" className="mt-1 font-poppins text-xl font-semibold text-[#292621]">{detail?.numeroPublico || 'Pedido'}</h2></div><button type="button" aria-label="Cerrar detalle" onClick={() => setSelectedId('')} className="rounded-lg p-2 text-black/45 hover:bg-black/5"><X size={18} /></button></div>
      {detailLoading ? <p role="status" className="p-10 text-center font-poppins text-sm text-black/45">Cargando detalle…</p> : detailError ? <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 font-poppins text-sm text-red-800">{detailError}</p> : detail && <>
        <div className="mt-5 grid gap-4 sm:grid-cols-2"><section className="rounded-xl bg-[#F8F7F5] p-4"><h3 className="font-poppins text-xs font-semibold text-[#466729]">Comprador</h3><p className="mt-2 font-poppins text-sm">{detail.comprador.nombre} {detail.comprador.apellido}</p><p className="mt-1 break-all font-poppins text-xs text-black/55">{detail.comprador.correo}</p><p className="mt-1 font-poppins text-xs text-black/55">{detail.comprador.telefono || 'Sin teléfono registrado'}</p><p className="mt-3 font-poppins text-[10px] text-black/45">Creado: {dateLabel(detail.creadoEn)}</p>{detail.observaciones && <p className="mt-2 whitespace-pre-wrap font-poppins text-xs text-black/60">Observaciones: {detail.observaciones}</p>}</section>
          <section className="rounded-xl bg-[#F8F7F5] p-4"><h3 className="font-poppins text-xs font-semibold text-[#466729]">Retiro</h3><p className="mt-2 font-poppins text-sm">{detail.retiro?.nombre || detail.retiro?.evento || detail.retiro?.lugar || 'Opción histórica no disponible'}</p>{detail.retiro?.direccion && <p className="mt-1 font-poppins text-xs text-black/55">{detail.retiro.direccion}</p>}{detail.retiro?.horarios && <p className="mt-1 whitespace-pre-wrap font-poppins text-xs text-black/55">{detail.retiro.horarios}</p>}{detail.retiro?.horariosHabituales?.map((time, index) => <p key={`${time.diaSemana}-${index}`} className="mt-1 font-poppins text-[10px] text-black/55">{time.diaSemana}: {time.horaInicio}–{time.horaFin}</p>)}{detail.retiro?.fecha && <p className="mt-2 font-poppins text-xs text-black/55">Fecha especial: {dateLabel(detail.retiro.fecha)}</p>}<p className="mt-3 font-poppins text-xs text-black/60">Retiro: {detail.estado === 'RETIRADO' ? `Entregado el ${dateLabel(detail.retiradoEn)}` : orderStates[detail.estado]}</p></section></div>
        <section className="mt-4 overflow-hidden rounded-xl border border-black/[.07]"><div className="border-b border-black/[.06] px-4 py-3"><h3 className="font-poppins text-xs font-semibold">Productos · precios históricos</h3></div><div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left"><thead><tr className="bg-[#FBFAF8] font-poppins text-[10px] text-black/45"><th className="px-4 py-2">Producto / variante</th><th className="px-3 py-2">Cantidad</th><th className="px-3 py-2">Precio unitario</th><th className="px-3 py-2">Subtotal</th></tr></thead><tbody>{detail.articulos.map((item) => <tr key={item.id} className="border-t border-black/[.05] font-poppins text-xs"><td className="px-4 py-3"><strong className="font-medium">{item.nombre}</strong>{item.atributos?.length > 0 && <span className="mt-1 block text-[10px] text-black/50">{item.atributos.map(({ atributo, valor }) => `${atributo}: ${valor}`).join(' · ')}</span>}{item.detalleVariante && <span className="mt-1 block text-[10px] text-black/50">{item.detalleVariante}</span>}</td><td className="px-3 py-3">{item.cantidad}</td><td className="px-3 py-3">{formatMoney(item.precioUnitario)}</td><td className="px-3 py-3 font-medium">{formatMoney(item.subtotal)}</td></tr>)}</tbody><tfoot><tr className="border-t border-black/10 font-poppins text-sm font-semibold"><td colSpan="3" className="px-4 py-3 text-right">Total histórico</td><td className="px-3 py-3">{formatMoney(detail.total)}</td></tr></tfoot></table></div></section>
        <div className="mt-4 grid gap-4 md:grid-cols-2"><section className="rounded-xl border border-black/[.07] p-4"><h3 className="font-poppins text-xs font-semibold">Pago</h3><p className="mt-2 font-poppins text-xs">{paymentMethods[detail.metodoPago] || detail.metodoPago} · <Badge tone={detail.estadoPago === 'APROBADO' ? 'good' : detail.estadoPago === 'RECHAZADO' || detail.estadoPago === 'REEMBOLSADO' ? 'bad' : 'pending'}>{paymentStates[detail.estadoPago] || detail.estadoPago}</Badge></p><p className="mt-2 font-poppins text-xs text-black/55">Importe histórico: {formatMoney(detail.total)}</p><p className="mt-1 font-poppins text-[10px] text-black/45">Acreditado: {dateLabel(detail.pagadoEn || detail.transferenciaRecibidaEn)}</p>{detail.pagoReferencia && <p className="mt-1 break-all font-poppins text-[10px] text-black/45">Referencia externa: {detail.pagoReferencia}</p>}{detail.intentosPago?.map((attempt, index) => <div key={`${attempt.orderExternaId}-${index}`} className="mt-3 rounded-lg bg-[#F8F7F5] p-3 font-poppins text-[10px] text-black/55"><p>Mercado Pago: {attempt.estadoProveedor || attempt.estadoCreacion}</p>{attempt.detalleEstadoProveedor && <p>Detalle: {attempt.detalleEstadoProveedor}</p>}{attempt.incidencia && <p className="mt-1 text-amber-800">Pendiente de conciliación: {attempt.incidencia}</p>}</div>)}{detail.confirmacionesTransferencia?.map((confirmation, index) => <div key={`${confirmation.referencia}-${index}`} className="mt-3 rounded-lg bg-[#F8F7F5] p-3 font-poppins text-[10px] text-black/55"><p>Transferencia {confirmation.resultado === 'TARDIA' ? 'tardía / revisión' : 'acreditada'}: {formatMoney(confirmation.importeAcreditado)}</p><p>Referencia: {confirmation.referencia} · {dateLabel(confirmation.recibidoEn)}</p><p>Cuenta responsable: {confirmation.admin || 'No registrada'}</p></div>)}{detail.reintegros?.map((refund, index) => <div key={`${refund.estado}-${index}`} className="mt-3 rounded-lg bg-[#F8F7F5] p-3 font-poppins text-[10px] text-black/55"><p>Reintegro {refund.tipo}: {formatMoney(refund.importeSolicitado)} · {refund.estado}</p><p>{refund.motivo} · solicitado {dateLabel(refund.solicitadoEn)}</p></div>)}</section>
          <section className="rounded-xl border border-black/[.07] p-4"><h3 className="font-poppins text-xs font-semibold">Estado operativo</h3><p className="mt-2"><Badge>{orderStates[detail.estado] || detail.estado}</Badge></p>{detail.estado === 'RETIRADO' && <><p className="mt-2 font-poppins text-[10px] text-black/50">Retirado: {dateLabel(detail.retiradoEn)}</p><p className="mt-1 font-poppins text-[10px] text-black/50">Cuenta que registró la entrega: {detail.retiradoPor?.correo || 'Cuenta administrativa registrada'}</p></>}{nextOperationalState && <div className="mt-4"><button type="button" disabled={saving || !operationalChangesEnabled} onClick={() => changeState(nextOperationalState)} className="rounded-lg bg-[#466729] px-4 py-2.5 font-poppins text-xs text-white disabled:cursor-not-allowed disabled:opacity-45">{saving ? 'Guardando…' : nextOperationalState === 'RETIRADO' ? 'Confirmar pedido retirado' : `Marcar ${orderStates[nextOperationalState].toLowerCase()}`}</button>{!operationalChangesEnabled && <p className="mt-2 font-poppins text-[10px] leading-4 text-amber-800">Los cambios operativos están bloqueados hasta probar transacciones en MongoDB aislado.</p>}</div>}{detail.estado === 'LISTO_PARA_RETIRAR' && detail.estadoPago !== 'APROBADO' && <p className="mt-3 font-poppins text-[10px] text-amber-800">No se habilita el retiro hasta que el pago esté confirmado.</p>}{detail.estado === 'LISTO_PARA_RETIRAR' && hasRefundBlockingDelivery && <p className="mt-3 font-poppins text-[10px] text-amber-800">El pedido tiene un reintegro solicitado o registrado; requiere revisión antes de entregarlo.</p>}
            {detail.reservas?.length > 0 && <div className="mt-4 border-t border-black/[.06] pt-3"><h4 className="font-poppins text-[10px] font-semibold">Reservas de inventario (no son ventas)</h4>{detail.reservas.map((reservation, index) => <p key={`${reservation.varianteId}-${index}`} className="mt-1 break-all font-poppins text-[10px] text-black/50">{reservation.cantidad} unidad(es) · {reservation.estado} · vence {dateLabel(reservation.venceEn)}</p>)}</div>}
          </section></div>
        {detail.metodoPago === 'TRANSFERENCIA' && detail.estadoPago === 'PENDIENTE' && <section className="mt-4 rounded-xl border border-[#AF71DD]/20 bg-[#FAF7FC] p-4"><h3 className="font-poppins text-xs font-semibold">Confirmación de transferencia</h3>{detail.puedeConfirmarTransferencia && detail.acciones?.confirmacionTransferenciaHabilitada ? <><p className="mt-1 font-poppins text-[10px] leading-4 text-black/55">Verificá el ingreso en la cuenta bancaria. El monto se toma del pedido persistido: <strong>{formatMoney(detail.total)}</strong>. Esta acción registra la auditoría y confirmación de reservas de PAG-03.</p><label className="mt-3 block font-poppins text-[10px] text-black/55">Referencia de la transferencia<input value={transferReference} onChange={(event) => setTransferReference(event.target.value)} maxLength={120} className="mt-1 h-10 w-full rounded-lg border border-black/10 bg-white px-3 font-poppins text-xs" /></label><label className="mt-3 flex items-start gap-2 font-poppins text-[10px] leading-4 text-black/60"><input type="checkbox" checked={transferAcknowledged} onChange={(event) => setTransferAcknowledged(event.target.checked)} className="mt-0.5 accent-[#466729]" />Confirmo que observé el dinero acreditado por el importe exacto del pedido.</label><button type="button" disabled={saving || !transferAcknowledged || !transferReference.trim()} onClick={confirmTransfer} className="mt-3 rounded-lg bg-[#466729] px-4 py-2.5 font-poppins text-xs text-white disabled:cursor-not-allowed disabled:opacity-45">{saving ? 'Registrando…' : 'Confirmar transferencia recibida'}</button></> : <p className="mt-2 font-poppins text-[10px] leading-4 text-amber-800">{!detail.acciones?.confirmacionTransferenciaHabilitada ? 'La confirmación de transferencias está bloqueada hasta validar PAG-03 en MongoDB aislado.' : 'No hay una reserva vigente que permita confirmar normalmente. Revisá el flujo de conciliación de PAG-03; no se enviará una confirmación automática.'}</p>}</section>}
        <section className="mt-4 rounded-xl bg-[#F8F7F5] p-4"><h3 className="font-poppins text-xs font-semibold">Historial de estados</h3>{detail.historial?.length ? <ol className="mt-3 space-y-3">{detail.historial.map((entry, index) => <li key={`${entry.creadoEn}-${index}`} className="border-l-2 border-[#AF71DD] pl-3"><p className="font-poppins text-xs">{entry.estadoAnterior ? `${orderStates[entry.estadoAnterior]} → ` : ''}{orderStates[entry.estadoNuevo] || entry.estadoNuevo}</p><p className="mt-1 font-poppins text-[10px] text-black/45">{dateLabel(entry.creadoEn)} · cuenta administrativa {entry.admin || 'no registrada'}</p>{entry.nota && <p className="mt-1 font-poppins text-[10px] text-black/55">{entry.nota}</p>}</li>)}</ol> : <p className="mt-2 font-poppins text-[10px] text-black/45">Sin cambios de estado registrados.</p>}</section>
      </>}
      {notice && <p role="status" aria-live="polite" className="mt-4 rounded-lg bg-[#EEF3EA] p-3 font-poppins text-xs text-[#466729]">{notice}</p>}
      <div className="mt-5 flex justify-end"><button type="button" onClick={() => setSelectedId('')} className="rounded-full border border-black/10 px-5 py-2.5 font-poppins text-xs text-black/60 hover:bg-black/5">Cerrar</button></div>
    </section></div>}
  </div>
}

export default AdminOrdersPage
