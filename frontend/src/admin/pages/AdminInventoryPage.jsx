import { useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, Boxes, Search } from 'lucide-react'

const MOVEMENTS_KEY = 'olla-vegana-admin-stock-movements'
function readMovements() { try { return JSON.parse(window.localStorage.getItem(MOVEMENTS_KEY) || '[]') } catch { return [] } }

function AdminInventoryPage({ products, onSaveProducts }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('Todos')
  const [productId, setProductId] = useState('')
  const [variantLabel, setVariantLabel] = useState('')
  const [kind, setKind] = useState('Ingreso')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [movements, setMovements] = useState(readMovements)
  const filtered = useMemo(() => products.filter((product) => product.name.toLowerCase().includes(query.toLowerCase()) && (filter === 'Todos' || (filter === 'Agotados' ? product.stock === 0 : filter === 'Poco stock' ? product.stock > 0 && product.stock <= 5 : product.stock > 5))), [products, query, filter])

  const recordMovement = async (event) => {
    event.preventDefault()
    const amount = Number(quantity)
    const product = products.find((item) => item.id === productId)
    const combination = product?.combinations?.find((item) => item.label === variantLabel)
    if (!product || (product.combinations?.length && !combination) || !amount || amount < 0 || !reason.trim()) { setNotice('Elegí un producto y su variante, ingresá una cantidad válida y explicá el motivo.'); return }
    const previousStock = Number(combination?.stock ?? product.stock)
    if (kind === 'Ajuste' && amount > previousStock) { setNotice('El ajuste no puede dejar el stock en negativo.'); return }
    setBusy(true)
    try {
      const nextStock = kind === 'Ingreso' ? previousStock + amount : previousStock - amount
      await onSaveProducts(products.map((item) => {
        if (item.id !== product.id) return item
        if (!combination) return { ...item, stock: nextStock }
        const combinations = item.combinations.map((variant) => variant.label === variantLabel ? { ...variant, stock: nextStock } : variant)
        return { ...item, combinations, stock: combinations.reduce((sum, variant) => sum + Number(variant.stock), 0) }
      }))
      const movement = { id: Date.now(), product: product.name, variant: variantLabel, kind, quantity: amount, before: previousStock, after: nextStock, reason: reason.trim(), date: new Date().toISOString() }
      const nextMovements = [movement, ...movements]
      window.localStorage.setItem(MOVEMENTS_KEY, JSON.stringify(nextMovements))
      setMovements(nextMovements)
      setQuantity('')
      setVariantLabel('')
      setReason('')
      setNotice('Movimiento registrado en los datos de demostración.')
    } catch {
      setNotice('No pudimos registrar el movimiento. Intentá otra vez.')
    } finally { setBusy(false) }
  }

  return <div className="space-y-5">
    <div><p className="font-poppins text-xs font-medium text-[#8E53B5]">Operación · administración</p><h1 className="mt-1 font-poppins text-2xl font-semibold">Inventario</h1><p className="mt-1 font-poppins text-sm text-black/50">El stock se actualiza con movimientos simulados en este navegador.</p></div>
    <div className="grid gap-3 sm:grid-cols-3">{[['Unidades en catálogo', products.reduce((sum, item) => sum + item.stock, 0), Boxes], ['Stock bajo', products.filter((item) => item.stock > 0 && item.stock <= 5).length, ArrowDownLeft], ['Agotados', products.filter((item) => item.stock === 0).length, ArrowUpRight]].map(([label, value, Icon]) => <article key={label} className="flex items-center gap-3 rounded-2xl border border-black/[.06] bg-white p-4"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F2E8F8] text-[#8E53B5]"><Icon size={18} /></span><div><p className="font-poppins text-[10px] text-black/45">{label}</p><p className="font-poppins text-xl font-semibold">{value}</p></div></article>)}</div>
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(290px,.7fr)]">
      <section className="overflow-hidden rounded-2xl border border-black/[.06] bg-white"><div className="flex flex-col gap-3 border-b border-black/[.06] p-4 sm:flex-row"><label className="relative flex-1"><span className="sr-only">Buscar en inventario</span><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/35" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar producto" className="h-10 w-full rounded-lg border border-black/10 pl-9 pr-3 font-poppins text-xs" /></label><select aria-label="Filtrar stock" value={filter} onChange={(event) => setFilter(event.target.value)} className="h-10 rounded-lg border border-black/10 bg-white px-3 font-poppins text-xs"><option>Todos</option><option>Poco stock</option><option>Agotados</option><option>Disponible</option></select></div><div className="overflow-x-auto"><table className="w-full min-w-[500px] text-left"><thead><tr className="bg-[#FBFAF8] font-poppins text-[10px] uppercase tracking-wider text-black/40"><th className="px-5 py-3 font-medium">Producto / variante</th><th className="px-4 py-3 font-medium">Categoría</th><th className="px-4 py-3 font-medium">Disponible</th><th className="px-4 py-3 font-medium">Alerta</th></tr></thead><tbody>{filtered.map((product) => <tr key={product.id} className="border-t border-black/[.045] font-poppins text-xs"><td className="px-5 py-3.5"><strong className="font-medium">{product.name}</strong>{product.combinations?.map((combo, index) => <span key={index} className="mt-1 block text-[10px] text-black/45">{combo.label || 'Variante'} · {combo.stock} u.</span>)}</td><td className="px-4 py-3.5 text-black/55">{product.category}</td><td className="px-4 py-3.5 font-semibold">{product.stock} u.</td><td className="px-4 py-3.5">{product.stock === 0 ? <span className="rounded-full bg-[#FCE9E6] px-2 py-1 text-[9px] text-[#B34234]">Agotado</span> : product.stock <= 5 ? <span className="rounded-full bg-[#FFF3D9] px-2 py-1 text-[9px] text-[#966316]">Stock bajo</span> : <span className="text-[10px] text-[#466729]">Correcto</span>}</td></tr>)}</tbody></table></div></section>
      <form onSubmit={recordMovement} className="rounded-2xl border border-black/[.06] bg-white p-5"><h2 className="font-poppins text-sm font-semibold">Registrar movimiento</h2><p className="mt-1 font-poppins text-[10px] leading-4 text-black/45">Los cambios quedan en el historial local del panel.</p><label className="mt-4 block font-poppins text-[10px] text-black/55">Producto<select required value={productId} onChange={(event) => { setProductId(event.target.value); setVariantLabel('') }} className="mt-1.5 h-10 w-full rounded-lg border border-black/10 bg-white px-3 font-poppins text-xs"><option value="">Elegí un producto</option>{products.map((product) => <option value={product.id} key={product.id}>{product.name}</option>)}</select></label>{products.find((item) => item.id === productId)?.combinations?.length > 0 && <label className="mt-3 block font-poppins text-[10px] text-black/55">Variante<select required value={variantLabel} onChange={(event) => setVariantLabel(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-black/10 bg-white px-3 font-poppins text-xs"><option value="">Elegí una combinación</option>{products.find((item) => item.id === productId).combinations.map((variant) => <option key={variant.label} value={variant.label}>{variant.label} · {variant.stock} u.</option>)}</select></label>}<label className="mt-3 block font-poppins text-[10px] text-black/55">Tipo<select value={kind} onChange={(event) => setKind(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-black/10 bg-white px-3 font-poppins text-xs"><option>Ingreso</option><option>Ajuste</option></select></label><label className="mt-3 block font-poppins text-[10px] text-black/55">Unidades<input required type="number" min="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-black/10 px-3 font-poppins text-xs" /></label><label className="mt-3 block font-poppins text-[10px] text-black/55">Motivo<textarea required rows="3" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ej.: reposición de mercadería" className="mt-1.5 w-full rounded-lg border border-black/10 p-3 font-poppins text-xs" /></label>{notice && <p role="status" className="mt-3 font-poppins text-[10px] text-[#466729]">{notice}</p>}<button disabled={busy} className="mt-4 h-10 w-full rounded-xl bg-[#466729] font-poppins text-xs font-medium text-white disabled:opacity-50">{busy ? 'Guardando…' : 'Guardar movimiento'}</button></form>
    </div>
    <section className="rounded-2xl border border-black/[.06] bg-white p-5"><h2 className="font-poppins text-sm font-semibold">Historial de movimientos</h2><p className="mt-1 font-poppins text-[10px] text-black/40">La actualización automática por ventas dependerá de la confirmación del backend.</p>{movements.length ? <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[600px] text-left"><thead><tr className="font-poppins text-[9px] uppercase tracking-wider text-black/40"><th className="py-2 font-medium">Fecha</th><th className="py-2 font-medium">Producto / variante</th><th className="py-2 font-medium">Movimiento</th><th className="py-2 font-medium">Stock</th><th className="py-2 font-medium">Motivo</th></tr></thead><tbody>{movements.slice(0, 10).map((item) => <tr key={item.id} className="border-t border-black/[.05] font-poppins text-[10px]"><td className="py-3 text-black/45">{new Date(item.date).toLocaleString('es-AR')}</td><td className="py-3">{item.product}{item.variant ? ` · ${item.variant}` : ''}</td><td className="py-3">{item.kind} · {item.quantity}</td><td className="py-3">{item.before} → {item.after}</td><td className="py-3 text-black/55">{item.reason}</td></tr>)}</tbody></table></div> : <p className="mt-4 rounded-xl bg-[#F8F7F5] p-5 font-poppins text-xs text-black/45">Todavía no se registraron movimientos. Usá el formulario para ingresar mercadería o ajustar existencias.</p>}</section>
  </div>
}

export default AdminInventoryPage
