import { useCallback, useEffect, useState } from 'react'
import { CalendarDays, Clock3, MapPin, Pencil, Plus, RotateCw, Save, X } from 'lucide-react'
import {
  createAdminPickupEvent,
  createAdminPickupPoint,
  getAdminPickups,
  updateAdminPickupEvent,
  updateAdminPickupPoint,
} from '../../services/api'

const WEEK_DAYS = [
  ['LUNES', 'Lunes'], ['MARTES', 'Martes'], ['MIERCOLES', 'Miércoles'], ['JUEVES', 'Jueves'],
  ['VIERNES', 'Viernes'], ['SABADO', 'Sábado'], ['DOMINGO', 'Domingo'],
]
const TIME_ZONE = 'America/Argentina/Buenos_Aires'
const emptyPoint = () => ({ id: '', version: 0, nombre: '', direccion: '', indicaciones: '', horariosHabituales: [], activo: false, habilitadoCheckout: false })
const emptyEvent = () => ({ id: '', version: 0, evento: 'VEGANPALUJA', nombre: 'Veganpaluja', lugar: '', direccion: '', indicaciones: '', fechaInicio: '', fechaFin: '', seleccionDesde: '', seleccionHasta: '', horariosRetiro: [], activo: false, habilitadoCheckout: false })

function Field({ label, className = '', ...props }) {
  return <label className={`block font-poppins text-[10px] text-black/55 ${className}`}>{label}<input {...props} className={`mt-1.5 h-10 w-full rounded-lg border border-black/10 bg-white px-3 font-poppins text-xs text-[#292621] focus:border-[#AF71DD] focus:outline-none focus:ring-2 focus:ring-[#AF71DD]/15 ${props.className || ''}`} /></label>
}

function AdminPickupPage() {
  const [data, setData] = useState({ puntos: [], eventos: [] })
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [notice, setNotice] = useState('')
  const [pointForm, setPointForm] = useState(null)
  const [eventForm, setEventForm] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    setLoadError('')
    try {
      const result = await getAdminPickups()
      setData({ puntos: result.puntos || [], eventos: result.eventos || [] })
    } catch (error) {
      setLoadError(error.message || 'No pudimos cargar los puntos de retiro.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const updatePoint = (key, value) => setPointForm((current) => ({ ...current, [key]: value }))
  const updateEvent = (key, value) => setEventForm((current) => ({ ...current, [key]: value }))
  const updatePointSchedule = (index, key, value) => setPointForm((current) => ({
    ...current, horariosHabituales: current.horariosHabituales.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row),
  }))
  const updateEventSchedule = (index, key, value) => setEventForm((current) => ({
    ...current, horariosRetiro: current.horariosRetiro.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row),
  }))

  const savePoint = async (event) => {
    event.preventDefault()
    if (pointForm.id) {
      const original = data.puntos.find((point) => point.id === pointForm.id)
      if (original?.activo && !pointForm.activo && original.pedidosPendientes > 0 &&
        !window.confirm(`Hay ${original.pedidosPendientes} pedido(s) pendientes asociados. El cambio no modificará su punto histórico. ¿Desactivar igualmente?`)) return
    }
    setSaving(true); setNotice(''); setLoadError('')
    try {
      const payload = { ...pointForm }
      delete payload.id; delete payload.pedidosPendientes; delete payload.tipo; delete payload.zonaHoraria; delete payload.diasHabituales; delete payload.disponibleParaSeleccionar
      if (pointForm.id) await updateAdminPickupPoint(pointForm.id, payload)
      else await createAdminPickupPoint(payload)
      setPointForm(null); setNotice('Punto de retiro guardado.'); await load()
    } catch (error) { setLoadError(error.message || 'No pudimos guardar el punto.') }
    finally { setSaving(false) }
  }

  const saveEvent = async (event) => {
    event.preventDefault()
    if (eventForm.id) {
      const original = data.eventos.find((item) => item.id === eventForm.id)
      if (original?.activo && !eventForm.activo && original.pedidosPendientes > 0 &&
        !window.confirm(`Hay ${original.pedidosPendientes} pedido(s) pendientes asociados a este evento. No se cambiará el retiro histórico. ¿Desactivar igualmente?`)) return
    }
    setSaving(true); setNotice(''); setLoadError('')
    try {
      const payload = { ...eventForm }
      delete payload.id; delete payload.pedidosPendientes; delete payload.tipo; delete payload.zonaHoraria; delete payload.disponibleParaSeleccionar
      if (eventForm.id) await updateAdminPickupEvent(eventForm.id, payload)
      else await createAdminPickupEvent(payload)
      setEventForm(null); setNotice('Retiro de Veganpaluja guardado.'); await load()
    } catch (error) { setLoadError(error.message || 'No pudimos guardar el evento.') }
    finally { setSaving(false) }
  }

  const fieldInput = 'mt-1.5 h-10 w-full rounded-lg border border-black/10 bg-white px-3 font-poppins text-xs text-[#292621] focus:border-[#AF71DD] focus:outline-none focus:ring-2 focus:ring-[#AF71DD]/15'
  const status = (item) => item.activo ? (item.habilitadoCheckout ? 'Activo · visible en checkout' : 'Activo · no disponible en checkout') : 'Inactivo'

  return <div className="space-y-6">
    <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div><p className="font-poppins text-xs font-medium text-[#8E53B5]">Logística · administración</p><h1 className="mt-1 font-poppins text-2xl font-semibold">Puntos de retiro</h1><p className="mt-1 font-poppins text-sm text-black/50">Gestioná ubicaciones, horarios habituales y retiros de Veganpaluja.</p><p className="mt-1 font-poppins text-[10px] text-black/40">Los horarios comerciales se interpretan en {TIME_ZONE}.</p></div>
      <button type="button" onClick={load} disabled={isLoading} className="inline-flex h-10 items-center gap-2 self-start rounded-xl border border-[#466729]/20 bg-white px-4 font-poppins text-xs text-[#466729] disabled:opacity-50"><RotateCw size={14} />Actualizar</button>
    </header>
    {loadError && <div role="alert" className="flex flex-col gap-3 rounded-xl border border-[#B34234]/20 bg-[#FCE9E6] p-4 font-poppins text-xs text-[#9E4034] sm:flex-row sm:items-center sm:justify-between"><span>{loadError}</span><button type="button" onClick={load} className="underline">Reintentar</button></div>}
    {notice && <p role="status" className="rounded-xl border border-[#466729]/15 bg-[#EEF3EA] px-4 py-3 font-poppins text-xs text-[#466729]">{notice}</p>}
    {isLoading ? <p role="status" className="rounded-xl bg-white p-10 text-center font-poppins text-sm text-black/50">Cargando puntos de retiro…</p> : !loadError && <>
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-poppins text-lg font-semibold text-[#466729]">Puntos habituales</h2><p className="font-poppins text-xs text-black/45">Las ubicaciones existentes se conservan; editá sus datos antes de habilitarlas para compras.</p></div><button type="button" onClick={() => { setEventForm(null); setPointForm(emptyPoint()) }} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#466729] px-4 font-poppins text-xs text-white"><Plus size={15} />Agregar punto</button></div>
        {data.puntos.length === 0 && <p className="rounded-xl border border-dashed border-black/15 bg-white p-8 text-center font-poppins text-sm text-black/50">No hay puntos habituales registrados.</p>}
        <div className="grid gap-4 xl:grid-cols-2">{data.puntos.map((point) => <article key={point.id} className="rounded-2xl border border-black/[.06] bg-white p-5 sm:p-6">
          <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F2E8F8] text-[#8E53B5]"><MapPin size={18} /></span><div className="min-w-0 flex-1"><h3 className="font-poppins text-sm font-semibold">{point.nombre}</h3><p className={`mt-1 font-poppins text-[10px] ${point.activo && point.habilitadoCheckout ? 'text-[#466729]' : 'text-black/45'}`}>{status(point)}</p></div><button type="button" onClick={() => { setEventForm(null); setPointForm({ ...point }) }} aria-label={`Editar ${point.nombre}`} className="rounded-lg p-2 text-[#466729] hover:bg-[#466729]/5"><Pencil size={16} /></button></div>
          <p className="mt-4 font-poppins text-xs text-black/65">{point.direccion || 'Sin dirección configurada'}</p><div className="mt-2 flex gap-2 font-poppins text-[11px] text-black/55"><Clock3 size={14} />{point.horariosHabituales.length ? point.horariosHabituales.map((row) => `${WEEK_DAYS.find(([key]) => key === row.diaSemana)?.[1] || row.diaSemana} ${row.horaInicio}–${row.horaFin}`).join(' · ') : (point.horarios || 'Sin horarios configurados')}</div>
          {point.indicaciones && <p className="mt-2 font-poppins text-[11px] leading-5 text-black/50">{point.indicaciones}</p>}
          {point.pedidosPendientes > 0 && <p className="mt-4 rounded-lg bg-[#FFF3D9] p-3 font-poppins text-[10px] text-[#966316]">Hay {point.pedidosPendientes} pedido(s) sin retirar asociados. Cambiar o desactivar el punto no modifica esos pedidos.</p>}
        </article>)}</div>
        {pointForm && <form onSubmit={savePoint} className="rounded-2xl border border-[#AF71DD]/25 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-3"><div><h3 className="font-poppins text-base font-semibold text-[#466729]">{pointForm.id ? 'Editar punto habitual' : 'Nuevo punto habitual'}</h3><p className="mt-1 font-poppins text-[10px] text-black/45">Cada franja usa hora local argentina y no puede superponerse con otra del mismo día.</p></div><button type="button" onClick={() => setPointForm(null)} aria-label="Cerrar formulario" className="rounded-lg p-2 text-black/45"><X size={17} /></button></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2"><Field label="Nombre" required maxLength={100} value={pointForm.nombre} onChange={(e) => updatePoint('nombre', e.target.value)} /><Field label="Dirección" required maxLength={300} value={pointForm.direccion} onChange={(e) => updatePoint('direccion', e.target.value)} /><label className="font-poppins text-[10px] text-black/55 sm:col-span-2">Indicaciones<textarea maxLength={1000} rows="2" value={pointForm.indicaciones} onChange={(e) => updatePoint('indicaciones', e.target.value)} className="mt-1.5 w-full rounded-lg border border-black/10 p-3 font-poppins text-xs focus:border-[#AF71DD] focus:outline-none" /></label></div>
          <div className="mt-5"><div className="flex items-center justify-between"><h4 className="font-poppins text-xs font-semibold">Horarios</h4><button type="button" onClick={() => updatePoint('horariosHabituales', [...pointForm.horariosHabituales, { diaSemana: 'LUNES', horaInicio: '', horaFin: '' }])} className="font-poppins text-[10px] text-[#466729] underline">Agregar franja</button></div>
            {pointForm.horariosHabituales.map((row, index) => <div key={`point-slot-${index}`} className="mt-2 grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2"><label className="font-poppins text-[10px] text-black/55">Día<select value={row.diaSemana} onChange={(e) => updatePointSchedule(index, 'diaSemana', e.target.value)} className={fieldInput}>{WEEK_DAYS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><Field label="Desde" type="time" required value={row.horaInicio} onChange={(e) => updatePointSchedule(index, 'horaInicio', e.target.value)} /><Field label="Hasta" type="time" required value={row.horaFin} onChange={(e) => updatePointSchedule(index, 'horaFin', e.target.value)} /><button type="button" aria-label="Quitar franja horaria" onClick={() => updatePoint('horariosHabituales', pointForm.horariosHabituales.filter((_, i) => i !== index))} className="mb-2 p-2 text-[#B34234]"><X size={15} /></button></div>)}
          </div>
          <div className="mt-5 flex flex-wrap gap-5"><label className="flex items-center gap-2 font-poppins text-xs text-black/65"><input type="checkbox" checked={pointForm.activo} onChange={(e) => { updatePoint('activo', e.target.checked); if (!e.target.checked) updatePoint('habilitadoCheckout', false) }} className="accent-[#466729]" />Activo en administración</label><label className="flex items-center gap-2 font-poppins text-xs text-black/65"><input type="checkbox" checked={pointForm.habilitadoCheckout} onChange={(e) => updatePoint('habilitadoCheckout', e.target.checked)} className="accent-[#466729]" />Ofrecer en checkout</label></div>
          <div className="mt-5 flex justify-end"><button type="submit" disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#466729] px-5 font-poppins text-xs text-white disabled:opacity-50"><Save size={14} />{saving ? 'Guardando…' : 'Guardar punto'}</button></div>
        </form>}
      </section>

      <section className="space-y-4 border-t border-black/[.06] pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-poppins text-lg font-semibold text-[#466729]">Retiros de Veganpaluja</h2><p className="font-poppins text-xs text-black/45">Configurá fechas del evento, horarios efectivos y período de selección por separado.</p></div><button type="button" onClick={() => { setPointForm(null); setEventForm(emptyEvent()) }} className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#466729]/20 bg-white px-4 font-poppins text-xs text-[#466729]"><Plus size={15} />Agregar evento</button></div>
        {data.eventos.length === 0 && <p className="rounded-xl border border-dashed border-black/15 bg-white p-8 text-center font-poppins text-sm text-black/50">No hay eventos de retiro registrados.</p>}
        <div className="grid gap-4 xl:grid-cols-2">{data.eventos.map((item) => <article key={item.id} className="rounded-2xl border border-black/[.06] bg-white p-5 sm:p-6"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFF3D9] text-[#966316]"><CalendarDays size={18} /></span><div className="min-w-0 flex-1"><h3 className="font-poppins text-sm font-semibold">{item.nombre}</h3><p className="mt-1 font-poppins text-[10px] text-black/45">{status(item)}</p></div><button type="button" onClick={() => { setPointForm(null); setEventForm({ ...item }) }} aria-label={`Editar ${item.nombre}`} className="rounded-lg p-2 text-[#466729]"><Pencil size={16} /></button></div><p className="mt-4 font-poppins text-xs text-black/65">{item.lugar} · {item.direccion}</p><p className="mt-2 font-poppins text-[11px] text-black/55">Evento: {item.fechaInicio}{item.fechaFin !== item.fechaInicio ? ` al ${item.fechaFin}` : ''}</p><p className="mt-1 font-poppins text-[11px] text-black/55">Selección: {item.seleccionDesde || 'sin definir'} – {item.seleccionHasta || 'sin definir'}</p><p className="mt-1 font-poppins text-[11px] text-black/55">{item.horariosRetiro.map((row) => `${row.fecha} · ${row.horaInicio}–${row.horaFin}`).join(' / ') || 'Sin horarios'}</p>{item.pedidosPendientes > 0 && <p className="mt-4 rounded-lg bg-[#FFF3D9] p-3 font-poppins text-[10px] text-[#966316]">Hay {item.pedidosPendientes} pedido(s) pendiente(s) asociados a este evento.</p>}</article>)}</div>
        {eventForm && <form onSubmit={saveEvent} className="rounded-2xl border border-[#AF71DD]/25 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-start justify-between gap-3"><div><h3 className="font-poppins text-base font-semibold text-[#466729]">{eventForm.id ? 'Editar evento' : 'Nuevo evento Veganpaluja'}</h3><p className="mt-1 font-poppins text-[10px] text-black/45">Las fechas se ingresan y se muestran como calendario de Argentina; las horas se guardan como horario local.</p></div><button type="button" onClick={() => setEventForm(null)} aria-label="Cerrar formulario" className="rounded-lg p-2 text-black/45"><X size={17} /></button></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2"><Field label="Nombre identificatorio" required maxLength={120} value={eventForm.nombre} onChange={(e) => updateEvent('nombre', e.target.value)} /><Field label="Ubicación / espacio" required maxLength={200} value={eventForm.lugar} onChange={(e) => updateEvent('lugar', e.target.value)} /><Field label="Dirección" required maxLength={300} value={eventForm.direccion} onChange={(e) => updateEvent('direccion', e.target.value)} /><div className="hidden sm:block" /><Field label="Evento desde" type="date" required value={eventForm.fechaInicio} onChange={(e) => updateEvent('fechaInicio', e.target.value)} /><Field label="Evento hasta" type="date" required value={eventForm.fechaFin} onChange={(e) => updateEvent('fechaFin', e.target.value)} /><Field label="Disponible para seleccionar desde" type="date" value={eventForm.seleccionDesde} onChange={(e) => updateEvent('seleccionDesde', e.target.value)} /><Field label="Disponible para seleccionar hasta" type="date" value={eventForm.seleccionHasta} onChange={(e) => updateEvent('seleccionHasta', e.target.value)} /><label className="font-poppins text-[10px] text-black/55 sm:col-span-2">Indicaciones<textarea maxLength={1000} rows="2" value={eventForm.indicaciones} onChange={(e) => updateEvent('indicaciones', e.target.value)} className="mt-1.5 w-full rounded-lg border border-black/10 p-3 font-poppins text-xs focus:border-[#AF71DD] focus:outline-none" /></label></div>
          <div className="mt-5"><div className="flex items-center justify-between"><h4 className="font-poppins text-xs font-semibold">Horarios efectivos de retiro</h4><button type="button" onClick={() => updateEvent('horariosRetiro', [...eventForm.horariosRetiro, { fecha: '', horaInicio: '', horaFin: '' }])} className="font-poppins text-[10px] text-[#466729] underline">Agregar horario</button></div>{eventForm.horariosRetiro.map((row, index) => <div key={`event-slot-${index}`} className="mt-2 grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2"><Field label="Fecha" type="date" required value={row.fecha} onChange={(e) => updateEventSchedule(index, 'fecha', e.target.value)} /><Field label="Desde" type="time" required value={row.horaInicio} onChange={(e) => updateEventSchedule(index, 'horaInicio', e.target.value)} /><Field label="Hasta" type="time" required value={row.horaFin} onChange={(e) => updateEventSchedule(index, 'horaFin', e.target.value)} /><button type="button" aria-label="Quitar horario" onClick={() => updateEvent('horariosRetiro', eventForm.horariosRetiro.filter((_, i) => i !== index))} className="mb-2 p-2 text-[#B34234]"><X size={15} /></button></div>)}</div>
          <div className="mt-5 flex flex-wrap gap-5"><label className="flex items-center gap-2 font-poppins text-xs text-black/65"><input type="checkbox" checked={eventForm.activo} onChange={(e) => { updateEvent('activo', e.target.checked); if (!e.target.checked) updateEvent('habilitadoCheckout', false) }} className="accent-[#466729]" />Evento activo</label><label className="flex items-center gap-2 font-poppins text-xs text-black/65"><input type="checkbox" checked={eventForm.habilitadoCheckout} onChange={(e) => updateEvent('habilitadoCheckout', e.target.checked)} className="accent-[#466729]" />Ofrecer en checkout</label></div>
          <div className="mt-5 flex justify-end"><button type="submit" disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#466729] px-5 font-poppins text-xs text-white disabled:opacity-50"><Save size={14} />{saving ? 'Guardando…' : 'Guardar evento'}</button></div>
        </form>}
      </section>
    </>}
  </div>
}

export default AdminPickupPage
