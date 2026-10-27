import { useRef, useState } from 'react'
import { ArrowDown, ArrowUp, ImagePlus, Plus, Save, Trash2 } from 'lucide-react'
import { getStoreBanners, saveStoreBanners } from '../../data/storeBanners'

const focusFields = [
  { key: 'desktopFocusX', label: 'Desktop · horizontal', legacy: 'focus' },
  { key: 'desktopFocusY', label: 'Desktop · vertical' },
  { key: 'mobileFocusX', label: 'Mobile · horizontal', legacy: 'focus' },
  { key: 'mobileFocusY', label: 'Mobile · vertical' },
]
const zoomFields = [
  { key: 'desktopZoom', label: 'Desktop · zoom', fallback: 120 },
  { key: 'mobileZoom', label: 'Mobile · zoom', fallback: 120 },
]

function AdminBannersPage() {
  const [banners, setBanners] = useState(getStoreBanners)
  const [selectedId, setSelectedId] = useState(banners[0]?.id)
  const [draggingIndex, setDraggingIndex] = useState(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaveSucceeded, setLastSaveSucceeded] = useState(false)
  const [notice, setNotice] = useState('')
  const dragRef = useRef(null)
  const selected = banners.find(({ id }) => id === selectedId)
  const bannerLimitReached = banners.length >= 4
  const today = new Date().toLocaleDateString('en-CA')
  const publishableBanners = banners.filter((banner) => banner.active && (!banner.start || banner.start <= today) && (!banner.end || banner.end >= today))
  const publishedRank = publishableBanners.findIndex((banner) => banner.id === selectedId)

  const updateDraft = (next) => {
    setBanners(next)
    setHasChanges(true)
    setLastSaveSucceeded(false)
    setNotice('Tenés cambios sin guardar.')
  }

  const update = (key, value) => updateDraft(banners.map((banner) =>
    banner.id === selectedId ? { ...banner, [key]: value } : banner
  ))

  const addBanner = () => {
    if (bannerLimitReached) {
      setNotice('El máximo es de cuatro banners. Eliminá uno para crear otro.')
      return
    }
    const banner = {
      id: `banner-${Date.now()}`,
      title: '', subtitle: '', buttonText: '', href: '/tienda',
      desktop: '', mobile: '', active: true, position: 'Centro',
      desktopFocusX: 50, desktopFocusY: 50, desktopZoom: 120,
      mobileFocusX: 50, mobileFocusY: 50, mobileZoom: 120,
      start: '', end: '',
    }
    updateDraft([...banners, banner])
    setSelectedId(banner.id)
  }

  const saveChanges = async () => {
    setIsSaving(true)
    setLastSaveSucceeded(false)
    setNotice('')
    try {
      saveStoreBanners(banners)
      setHasChanges(false)
      setLastSaveSucceeded(true)
      if (publishedRank < 0) {
        setNotice('Cambios guardados como borrador. Activá el banner y verificá sus fechas para mostrarlo en la tienda.')
      } else if (publishedRank > 0) {
        setNotice(`Cambios guardados. Este banner está activo en la posición ${publishedRank + 1}; en la portada podés verlo con las flechas.`)
      } else {
        setNotice('Cambios guardados. Este banner ya se muestra primero en la portada de la tienda.')
      }
    } catch {
      setNotice('No pudimos guardar los cambios. Probá con imágenes más livianas o intentá nuevamente.')
    } finally {
      setIsSaving(false)
    }
  }

  const upload = (key, event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => update(key, reader.result)
    reader.onerror = () => setNotice('No pudimos leer esa imagen. Probá con otro archivo.')
    reader.readAsDataURL(file)
    event.target.value = ''
  }

  const move = (index, direction) => {
    const target = index + direction
    if (target < 0 || target >= banners.length) return
    const next = [...banners]
    ;[next[index], next[target]] = [next[target], next[index]]
    updateDraft(next)
  }

  const reorder = (from, to) => {
    if (from === null || from === to) return
    const next = [...banners]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    updateDraft(next)
  }

  const contentPosition = selected?.position === 'Izquierda'
    ? 'items-center justify-start text-left'
    : selected?.position === 'Derecha'
      ? 'items-center justify-end text-right'
      : selected?.position === 'Abajo'
        ? 'items-end justify-center text-center'
        : 'items-center justify-center text-center'

  const startImageDrag = (event, label, x, y) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    dragRef.current = { pointerId: event.pointerId, label, x, y, width: bounds.width, height: bounds.height, startX: event.clientX, startY: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
    event.preventDefault()
  }

  const moveImageDrag = (event) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const xKey = drag.label === 'Desktop' ? 'desktopFocusX' : 'mobileFocusX'
    const yKey = drag.label === 'Desktop' ? 'desktopFocusY' : 'mobileFocusY'
    const nextX = Math.max(0, Math.min(100, drag.x - ((event.clientX - drag.startX) / drag.width) * 100))
    const nextY = Math.max(0, Math.min(100, drag.y - ((event.clientY - drag.startY) / drag.height) * 100))
    const focusX = Math.round(nextX)
    const focusY = Math.round(nextY)
    updateDraft(banners.map((banner) => banner.id === selectedId ? { ...banner, [xKey]: focusX, [yKey]: focusY } : banner))
  }

  const finishImageDrag = () => { dragRef.current = null }
  const noticeIsError = notice.startsWith('No pudimos')

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="font-poppins text-xs font-medium text-[#8E53B5]">Contenido de tienda · administración</p>
          <h1 className="mt-1 font-poppins text-2xl font-semibold">Banners</h1>
          <p className="mt-1 font-poppins text-sm text-black/50">Previsualizá la portada y organizá el orden de publicación.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={addBanner} disabled={bannerLimitReached} className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#466729]/20 bg-white px-4 font-poppins text-xs font-medium text-[#466729] disabled:cursor-not-allowed disabled:opacity-45"><Plus size={15} />Crear banner</button>
          <button type="button" onClick={saveChanges} disabled={!hasChanges || isSaving} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#466729] px-4 font-poppins text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-45"><Save size={15} />{isSaving ? 'Guardando…' : lastSaveSucceeded ? 'Guardado' : 'Guardar cambios'}</button>
        </div>
      </div>

      {notice && <p role="status" aria-live="polite" className={`rounded-xl border px-4 py-3 font-poppins text-xs ${noticeIsError ? 'border-[#B34234]/20 bg-[#FCE9E6] text-[#9E4034]' : 'border-[#466729]/15 bg-[#EEF3EA] text-[#466729]'}`}>{notice}</p>}

      {banners.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/15 bg-white p-12 text-center font-poppins text-sm text-black/50">Todavía no hay banners. Creá uno para ver la vista previa.</div>
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(330px,.85fr)]">
          <section className="rounded-2xl border border-black/[.06] bg-white p-5">
            <h2 className="font-poppins text-sm font-semibold">Orden y publicaciones</h2>
            <p className="mt-1 font-poppins text-[10px] text-black/45">Arrastrá para ordenar o usá las flechas con teclado. Máximo cuatro banners ({banners.length}/4). Los cambios se publican al guardar.</p>
            <ul className="mt-4 space-y-2">
              {banners.map((banner, index) => (
                <li key={banner.id} draggable onDragStart={() => setDraggingIndex(index)} onDragOver={(event) => event.preventDefault()} onDrop={() => { reorder(draggingIndex, index); setDraggingIndex(null) }} onDragEnd={() => setDraggingIndex(null)} className={`flex items-center gap-3 rounded-xl border p-3 ${banner.id === selectedId ? 'border-[#AF71DD]/50 bg-[#FBF8FD]' : 'border-black/[.07]'} ${draggingIndex === index ? 'opacity-50' : ''}`}>
                  <button type="button" onClick={() => setSelectedId(banner.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <span className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#F2E8F8]">{banner.desktop ? <img src={banner.desktop} alt="" className="h-full w-full object-cover" /> : <ImagePlus size={18} className="text-[#8E53B5]" />}</span>
                    <span className="min-w-0"><strong className="block truncate font-poppins text-xs font-medium">{banner.title || 'Banner sin título'}</strong><small className="mt-1 block font-poppins text-[10px] text-black/45">{banner.active ? 'Activo · demo' : 'Borrador / inactivo'}</small></span>
                  </button>
                  <button type="button" aria-label="Mover banner arriba" disabled={index === 0} onClick={() => move(index, -1)} className="p-1.5 text-black/45 disabled:opacity-20"><ArrowUp size={15} /></button>
                  <button type="button" aria-label="Mover banner abajo" disabled={index === banners.length - 1} onClick={() => move(index, 1)} className="p-1.5 text-black/45 disabled:opacity-20"><ArrowDown size={15} /></button>
                  <button type="button" aria-label="Eliminar banner" onClick={() => { const next = banners.filter(({ id }) => id !== banner.id); updateDraft(next); setSelectedId(next[0]?.id) }} className="p-1.5 text-[#B34234]"><Trash2 size={14} /></button>
                </li>
              ))}
            </ul>

            {selected && (
              <form onSubmit={(event) => { event.preventDefault(); setNotice('Tus cambios todavía no están publicados. Usá “Guardar cambios”.') }} className="mt-5 grid gap-3 border-t border-black/[.06] pt-5 sm:grid-cols-2">
                <label className="font-poppins text-[10px] text-black/55 sm:col-span-2">Título opcional<input value={selected.title || ''} onChange={(event) => update('title', event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-black/10 px-3 text-xs" /></label>
                <label className="font-poppins text-[10px] text-black/55 sm:col-span-2">Subtítulo opcional<textarea rows="2" value={selected.subtitle || ''} onChange={(event) => update('subtitle', event.target.value)} className="mt-1.5 w-full rounded-lg border border-black/10 p-3 text-xs" /></label>
                <label className="font-poppins text-[10px] text-black/55">Texto del botón<input value={selected.buttonText || ''} onChange={(event) => update('buttonText', event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-black/10 px-3 text-xs" /></label>
                <label className="font-poppins text-[10px] text-black/55">Enlace<input value={selected.href || ''} onChange={(event) => update('href', event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-black/10 px-3 text-xs" /></label>
                <label className="font-poppins text-[10px] text-black/55">Imagen desktop<input type="file" accept="image/*" onChange={(event) => upload('desktop', event)} className="mt-1.5 block w-full text-[10px]" /></label>
                <label className="font-poppins text-[10px] text-black/55">Imagen mobile<input type="file" accept="image/*" onChange={(event) => upload('mobile', event)} className="mt-1.5 block w-full text-[10px]" /></label>
                <label className="font-poppins text-[10px] text-black/55">Posición del contenido<select value={selected.position || 'Centro'} onChange={(event) => update('position', event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-xs"><option>Centro</option><option>Izquierda</option><option>Derecha</option><option>Abajo</option></select></label>
                <label className="font-poppins text-[10px] text-black/55">Inicio opcional<input type="date" value={selected.start || ''} onChange={(event) => update('start', event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-black/10 px-3 text-xs" /></label>
                <label className="font-poppins text-[10px] text-black/55">Fin opcional<input type="date" value={selected.end || ''} onChange={(event) => update('end', event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-black/10 px-3 text-xs" /></label>
                <label className="flex items-center gap-2 self-end pb-2 font-poppins text-xs text-black/60"><input type="checkbox" checked={Boolean(selected.active)} onChange={(event) => update('active', event.target.checked)} className="accent-[#466729]" />Activo en tienda (al guardar)</label>
                <div className="grid grid-cols-1 gap-3 border-t border-black/[.06] pt-3 sm:col-span-2 sm:grid-cols-2">
                  {focusFields.map(({ key, label, legacy }) => {
                    const fallback = legacy ? selected[legacy] ?? 50 : 50
                    return <label key={key} className="font-poppins text-[10px] text-black/55"><span className="flex items-center justify-between gap-2">{label}<input type="number" min="0" max="100" aria-label={`${label}, valor numérico`} value={selected[key] ?? fallback} onChange={(event) => update(key, Math.max(0, Math.min(100, Number(event.target.value))))} className="h-7 w-14 rounded-md border border-black/10 px-1 text-center text-[10px]" /></span><input type="range" min="0" max="100" value={selected[key] ?? fallback} onChange={(event) => update(key, Number(event.target.value))} className="mt-2 block h-8 w-full cursor-ew-resize touch-pan-x accent-[#AF71DD]" /></label>
                  })}
                  {zoomFields.map(({ key, label, fallback }) => <label key={key} className="font-poppins text-[10px] text-black/55">{label}: {selected[key] ?? fallback}%<input type="range" min="100" max="200" step="1" value={selected[key] ?? fallback} onChange={(event) => update(key, Number(event.target.value))} className="mt-2 w-full accent-[#AF71DD]" /></label>)}
                </div>
              </form>
            )}
          </section>

          {selected && (
            <section className="space-y-4">
              <div><h2 className="font-poppins text-sm font-semibold">Vista previa responsive</h2><p className="mt-1 font-poppins text-[10px] text-black/45">Arrastrá la imagen hacia arriba, abajo o los costados para reencuadrarla.</p></div>
              {[
                { label: 'Desktop', image: selected.desktop, ratio: 'aspect-[3/1] max-w-full', x: selected.desktopFocusX ?? selected.focus ?? 50, y: selected.desktopFocusY ?? 50, zoom: selected.desktopZoom ?? 120 },
                { label: 'Mobile', image: selected.mobile || selected.desktop, ratio: 'mx-auto aspect-square max-w-[230px]', x: selected.mobileFocusX ?? selected.focus ?? 50, y: selected.mobileFocusY ?? 50, zoom: selected.mobileZoom ?? 120 },
              ].map(({ label, image, ratio, x, y, zoom }) => (
                <article key={label} className="rounded-2xl border border-black/[.06] bg-white p-4">
                  <div className="mb-2 flex items-center justify-between"><span className="font-poppins text-xs font-medium">{label}</span><span className="font-poppins text-[9px] text-black/40">Proporción controlada</span></div>
                  <div
                    className={`relative isolate overflow-hidden rounded-xl bg-gradient-to-br from-[#466729] to-[#AF71DD] ${ratio} cursor-grab touch-none select-none active:cursor-grabbing`}
                    onPointerDown={(event) => startImageDrag(event, label, x, y)}
                    onPointerMove={moveImageDrag}
                    onPointerUp={finishImageDrag}
                    onPointerCancel={finishImageDrag}
                    onLostPointerCapture={finishImageDrag}
                    title="Arrastrá para reencuadrar la imagen"
                  >
                    {image && <img src={image} alt="" className="absolute h-full w-full object-cover" style={{ left: `${(50 - x) * ((zoom / 100) - 1)}%`, top: `${(50 - y) * ((zoom / 100) - 1)}%`, objectPosition: `${x}% ${y}%`, transform: `scale(${zoom / 100})`, transformOrigin: 'center' }} />}
                    <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-black/45 via-black/15 to-transparent" />
                    <div className={`absolute inset-0 flex p-5 text-white ${contentPosition}`}><div className="max-w-[85%]">{selected.title && <h3 className="font-poppins text-base font-semibold sm:text-xl">{selected.title}</h3>}{selected.subtitle && <p className="mt-1 font-poppins text-[10px] text-white/85 sm:text-xs">{selected.subtitle}</p>}{selected.buttonText && <span className="mt-3 inline-flex rounded-full bg-[#AF71DD] px-3 py-1.5 font-poppins text-[9px] font-medium">{selected.buttonText}</span>}</div></div>
                  </div>
                </article>
              ))}
            </section>
          )}
        </div>
      )}

      <p className="font-poppins text-[10px] text-black/35">Las imágenes se guardan localmente en esta demo. Los cambios se reflejan en la tienda al pulsar “Guardar cambios”.</p>
    </div>
  )
}

export default AdminBannersPage
