import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, AlertTriangle, RefreshCw } from 'lucide-react'
import { getAdminDashboardSummary } from '../../services/api'
import { buildSummaryParagraph, DASHBOARD_PERIODS, hasAttentionItems } from '../utils/dashboardSummary'

function AdminDashboard() {
  const [period, setPeriod] = useState('30d')
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const load = useCallback(async (signal) => {
    setLoading(true); setError('')
    try {
      const result = await getAdminDashboardSummary(period, { signal })
      if (!signal.aborted) setSummary(result)
    } catch (requestError) {
      if (!signal.aborted) {
        setSummary(null)
        setError(requestError.status === 401 || requestError.status === 403 ? 'Tu sesión no permite consultar este resumen.' : 'No pudimos cargar el resumen. Revisá tu conexión e intentá nuevamente.')
      }
    } finally { if (!signal.aborted) setLoading(false) }
  }, [period, attempt])
  useEffect(() => {
    const controller = new AbortController(); load(controller.signal)
    return () => controller.abort()
  }, [load])

  const paragraph = summary ? buildSummaryParagraph(summary) : null
  const attention = summary?.attention || {}
  return (
    <main className="mx-auto w-full max-w-5xl space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="font-poppins text-xs font-medium text-[#8E53B5]">Actividad y pendientes</p><h1 className="mt-1 font-poppins text-2xl font-semibold tracking-[-.03em] text-[#292621] sm:text-[28px]">Resumen de la tienda</h1><p className="mt-1 font-poppins text-sm text-black/50">Un resumen claro de pedidos, pagos y tareas que requieren atención.</p></div>
        <label className="font-poppins text-xs font-medium text-black/55">Período<select value={period} onChange={(event) => setPeriod(event.target.value)} className="mt-1 block min-w-48 rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm text-[#292621] outline-none focus:border-[#8E53B5] focus:ring-2 focus:ring-[#AF71DD]/20">{DASHBOARD_PERIODS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}</select></label>
      </header>
      <section aria-labelledby="activity-title" className="rounded-2xl border border-black/[.06] bg-white p-5 shadow-[0_2px_10px_rgba(24,20,16,.025)] sm:p-7">
        <h2 id="activity-title" className="font-poppins text-base font-semibold text-[#292621]">Actividad del período</h2>
        {loading && <p role="status" className="mt-4 font-poppins text-sm text-black/55">Cargando el resumen…</p>}
        {!loading && error && <div role="alert" className="mt-4 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between"><span>{error}</span><button type="button" onClick={() => setAttempt((value) => value + 1)} className="inline-flex w-fit items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 font-medium hover:bg-red-100"><RefreshCw size={15} aria-hidden="true" /> Reintentar</button></div>}
        {!loading && !error && paragraph && <p className="mt-4 font-poppins text-sm leading-7 text-black/70">{paragraph}</p>}
        {!loading && !error && !paragraph && <p role="alert" className="mt-4 font-poppins text-sm text-amber-800">La respuesta recibida no contiene importes verificables para mostrar.</p>}
        {!loading && summary && <p className="mt-3 font-poppins text-[11px] leading-5 text-black/40">Los pedidos se cuentan por fecha de creación. Los pagos acreditados se cuentan por su fecha de verificación. Los reintegros descontados son únicamente los completados en el período.</p>}
      </section>
      <section aria-labelledby="attention-title" className="rounded-2xl border border-black/[.06] bg-white p-5 shadow-[0_2px_10px_rgba(24,20,16,.025)] sm:p-7">
        <div className="flex items-center gap-2"><AlertTriangle size={18} className="text-[#A06A13]" aria-hidden="true" /><h2 id="attention-title" className="font-poppins text-base font-semibold text-[#292621]">Necesitan atención</h2></div>
        {!loading && !error && summary && !hasAttentionItems(attention) && <p className="mt-4 rounded-xl bg-[#EEF3EA] p-4 font-poppins text-sm text-[#466729]">No hay asuntos pendientes que requieran atención.</p>}
        {!loading && !error && summary && hasAttentionItems(attention) && <ul className="mt-4 space-y-3">
          {attention.transferPaymentsPending > 0 && <li className="rounded-xl bg-[#FFF7E7] p-4 font-poppins text-sm leading-6 text-[#75500F]">Hay {attention.transferPaymentsPending} {attention.transferPaymentsPending === 1 ? 'transferencia pendiente' : 'transferencias pendientes'} de confirmación.</li>}
          {attention.pickupsPending > 0 && <li className="rounded-xl bg-[#F8F2FB] p-4 font-poppins text-sm leading-6 text-[#69428A]">Hay {attention.pickupsPending} {attention.pickupsPending === 1 ? 'pedido pagado esperando' : 'pedidos pagados esperando'} ser retirados.</li>}
          {attention.lowStockCount > 0 && <li className="rounded-xl bg-[#FFF7E7] p-4 font-poppins text-sm leading-6 text-[#75500F]"><strong>Stock bajo</strong> (hasta {attention.stockThreshold} unidades disponibles): {attention.lowStockProducts.map((product) => `${product.name} (${product.available})`).join(', ')}{attention.lowStockCount > attention.lowStockProducts.length ? ` y ${attention.lowStockCount - attention.lowStockProducts.length} más` : ''}.</li>}
          {attention.outOfStockCount > 0 && <li className="rounded-xl bg-[#FCEFED] p-4 font-poppins text-sm leading-6 text-[#8C372E]"><strong>Agotados:</strong> {attention.outOfStockProducts.map(({ name }) => name).join(', ')}{attention.outOfStockCount > attention.outOfStockProducts.length ? ` y ${attention.outOfStockCount - attention.outOfStockProducts.length} más` : ''}.</li>}
        </ul>}
        {(loading || error) && <p className="mt-4 flex items-center gap-2 font-poppins text-sm text-black/50"><AlertCircle size={15} aria-hidden="true" />{loading ? 'Consultando alertas…' : 'Las alertas no están disponibles hasta recuperar la conexión.'}</p>}
      </section>
      {summary?.payments?.netReliable && summary.payments.netMovement && Number(summary.payments.netMovement) < 0 && <p className="font-poppins text-xs text-amber-800">Los reintegros confirmados del período superan los pagos acreditados registrados en el mismo período. El neto representa movimientos financieros del período, no ingresos por cohorte de pedidos.</p>}
      {summary && !summary.payments.netReliable && !loading && !error && <p className="font-poppins text-xs text-amber-800">No se informa un ingreso neto porque hay registros de reintegros históricos incompletos. El importe bruto acreditado y los reintegros completados se muestran por separado.</p>}
    </main>
  )
}
export default AdminDashboard
