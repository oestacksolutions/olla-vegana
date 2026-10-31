import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, Boxes, History, Package, RefreshCw, SlidersHorizontal } from 'lucide-react'
import {
  adjustAdminStock, createAdminAttribute, createAdminAttributeValue, createAdminVariant, getAdminAttributes, getAdminProducts,
  getAdminStock, getAdminStockMovements, getAdminVariants, updateAdminVariant,
  updateAdminAttribute, updateAdminAttributeValue,
} from '../../services/api'
import { availabilityLabel, attributePairs, formatAmount, isValidAdjustment, summarizeValues } from '../utils/inventory'

const PAGE_SIZE = 20

function newOperationKey() {
  const bytes = new Uint8Array(16)
  window.crypto.getRandomValues(bytes)
  return [...bytes].map((part) => part.toString(16).padStart(2, '0')).join('')
}

function AdminInventoryPage() {
  const [section, setSection] = useState('stock')
  const [stockRows, setStockRows] = useState([])
  const [stockPage, setStockPage] = useState(1)
  const [stockPages, setStockPages] = useState(0)
  const [stockTotal, setStockTotal] = useState(0)
  const [threshold, setThreshold] = useState(5)
  const [stockFilter, setStockFilter] = useState('all')
  const [productFilter, setProductFilter] = useState('')
  const [products, setProducts] = useState([])
  const [stockLoading, setStockLoading] = useState(true)
  const [stockError, setStockError] = useState('')
  const [stockNotice, setStockNotice] = useState('')
  const [selectedVariant, setSelectedVariant] = useState('')
  const [movementPage, setMovementPage] = useState(1)
  const [movements, setMovements] = useState([])
  const [movementPages, setMovementPages] = useState(0)
  const [movementLoading, setMovementLoading] = useState(false)
  const [movementError, setMovementError] = useState('')
  const [adjustment, setAdjustment] = useState({ tipo: 'INGRESO', cantidad: '', motivo: '' })
  const [savingAdjustment, setSavingAdjustment] = useState(false)
  const operationKey = useRef(null)
  const [attributes, setAttributes] = useState([])
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [catalogError, setCatalogError] = useState('')
  const [selectedProduct, setSelectedProduct] = useState('')
  const [variants, setVariants] = useState([])
  const [variantsLoading, setVariantsLoading] = useState(false)
  const [variantError, setVariantError] = useState('')
  const [variantNotice, setVariantNotice] = useState('')
  const [creatingVariant, setCreatingVariant] = useState(false)
  const [createValues, setCreateValues] = useState({})
  const [createPrice, setCreatePrice] = useState('')
  const [editingVariant, setEditingVariant] = useState('')
  const [editValues, setEditValues] = useState({})
  const [editPrice, setEditPrice] = useState('')
  const [editActive, setEditActive] = useState(true)
  const [savingVariant, setSavingVariant] = useState(false)
  const [newAttributeName, setNewAttributeName] = useState('')
  const [newAttributeValues, setNewAttributeValues] = useState({})
  const [editingAttribute, setEditingAttribute] = useState('')
  const [attributeNameDraft, setAttributeNameDraft] = useState('')
  const [editingAttributeValue, setEditingAttributeValue] = useState('')
  const [attributeValueDraft, setAttributeValueDraft] = useState('')

  const loadStock = useCallback(async (page = 1, signal) => {
    setStockLoading(true); setStockError('')
    try {
      const filters = { page, limit: PAGE_SIZE }
      if (productFilter) filters.productoId = productFilter
      if (stockFilter === 'low') filters.stockBajo = threshold
      if (stockFilter === 'out') filters.stockBajo = 0
      const response = await getAdminStock(filters, { signal })
      if (signal?.aborted) return
      setStockRows(response.inventario || [])
      setStockPage(response.paginacion?.pagina || page)
      setStockPages(response.paginacion?.paginas || 0)
      setStockTotal(response.paginacion?.total || 0)
      if (Number.isSafeInteger(response.umbralStockBajo)) setThreshold(response.umbralStockBajo)
    } catch (error) {
      if (!signal?.aborted) setStockError(error.message || 'No pudimos consultar el inventario.')
    } finally { if (!signal?.aborted) setStockLoading(false) }
  }, [productFilter, stockFilter, threshold])

  useEffect(() => {
    const controller = new AbortController()
    loadStock(1, controller.signal)
    return () => controller.abort()
  }, [productFilter, stockFilter, loadStock])

  useEffect(() => {
    let active = true
    getAdminProducts().then((response) => { if (active) setProducts(response.productos || []) }).catch(() => {})
    return () => { active = false }
  }, [])

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true); setCatalogError('')
    try {
      const [productResponse, attributeResponse] = await Promise.all([getAdminProducts(), getAdminAttributes()])
      setProducts(productResponse.productos || [])
      setAttributes(Array.isArray(attributeResponse) ? attributeResponse : attributeResponse.atributos || [])
    } catch (error) { setCatalogError(error.message || 'No pudimos cargar las opciones del catálogo.') }
    finally { setCatalogLoading(false) }
  }, [])
  useEffect(() => { if (section === 'variants' && !attributes.length) loadCatalog() }, [section, attributes.length, loadCatalog])

  const loadVariants = useCallback(async (productId) => {
    if (!productId) { setVariants([]); return }
    setVariantsLoading(true); setVariantError('')
    try { const response = await getAdminVariants(productId); setVariants(response.variantes || []) }
    catch (error) { setVariantError(error.message || 'No pudimos consultar las variantes.') }
    finally { setVariantsLoading(false) }
  }, [])
  useEffect(() => { loadVariants(selectedProduct) }, [selectedProduct, loadVariants])

  const loadMovements = useCallback(async (variantId, page = 1) => {
    if (!variantId) return
    setMovementLoading(true); setMovementError('')
    try {
      const response = await getAdminStockMovements(variantId, { page, limit: 10 })
      setMovements(response.movimientos || [])
      setMovementPages(response.paginacion?.paginas || 0)
      setMovementPage(response.paginacion?.pagina || page)
    } catch (error) { setMovementError(error.message || 'No pudimos cargar los movimientos de esta variante.') }
    finally { setMovementLoading(false) }
  }, [])
  useEffect(() => { if (selectedVariant) loadMovements(selectedVariant, 1) }, [selectedVariant, loadMovements])

  const selectedInventory = stockRows.find((row) => row.variante.id === selectedVariant)

  async function submitAdjustment(event) {
    event.preventDefault()
    const amount = Number(adjustment.cantidad)
    if (!selectedInventory) { setStockNotice('Seleccioná una variante de la lista.'); return }
    if (!isValidAdjustment(adjustment.tipo, adjustment.cantidad, adjustment.motivo)) { setStockNotice('Ingresá una cantidad entera válida y un motivo de al menos 3 caracteres.'); return }
    if (adjustment.tipo === 'AJUSTE' && amount < 0 && selectedInventory.stockFisico + amount < selectedInventory.cantidadReservada) {
      setStockNotice('El ajuste dejaría el stock por debajo de las unidades reservadas.'); return
    }
    const action = adjustment.tipo === 'INGRESO' ? `ingresar ${amount} unidades` : `ajustar ${amount > 0 ? '+' : ''}${amount} unidades`
    if (!window.confirm(`¿Confirmás ${action} para ${selectedInventory.producto.nombre}?`)) return
    const signature = JSON.stringify({ variantId: selectedVariant, ...adjustment, amount })
    if (operationKey.current?.signature !== signature) operationKey.current = { signature, key: newOperationKey() }
    setSavingAdjustment(true); setStockNotice('')
    try {
      await adjustAdminStock(selectedVariant, { ...adjustment, cantidad: amount, idOperacion: operationKey.current.key })
      operationKey.current = null
      setAdjustment((current) => ({ ...current, cantidad: '' }))
      setStockNotice('Movimiento registrado correctamente.')
      await loadStock(stockPage)
      await loadMovements(selectedVariant, 1)
    } catch (error) {
      setStockNotice(error.status === 503
        ? 'Los ajustes están temporalmente bloqueados hasta verificar el índice de idempotencia en MongoDB.'
        : (error.message || 'No pudimos registrar el movimiento. Si reintentás, se conservará la misma clave de operación.'))
    } finally { setSavingAdjustment(false) }
  }

  function startVariantEditor(variant) {
    setEditingVariant(variant.id)
    setEditValues(Object.fromEntries((variant.valores || []).map(({ atributoId, valorAtributoId }) => [atributoId, valorAtributoId])))
    setEditPrice(variant.precio || '')
    setEditActive(variant.activa !== false)
  }

  async function saveVariant(variantId) {
    setSavingVariant(true); setVariantError(''); setVariantNotice('')
    try {
      if (!window.confirm('¿Confirmás guardar los cambios de esta variante?')) return
      await updateAdminVariant(selectedProduct, variantId, { valores: attributePairs(editValues), precio: editPrice.trim() || null, activa: editActive })
      setEditingVariant(''); setVariantNotice('Variante actualizada.')
      await loadVariants(selectedProduct)
    } catch (error) { setVariantError(error.message || 'No pudimos actualizar la variante.') }
    finally { setSavingVariant(false) }
  }

  async function submitNewVariant(event) {
    event.preventDefault()
    if (!selectedProduct) { setVariantError('Elegí un producto antes de crear una variante.'); return }
    if (!window.confirm('¿Confirmás crear esta variante?')) return
    setCreatingVariant(true); setVariantError(''); setVariantNotice('')
    try {
      await createAdminVariant(selectedProduct, { valores: attributePairs(createValues), precio: createPrice.trim() || null })
      setCreateValues({}); setCreatePrice(''); setVariantNotice('Variante creada. El stock inicial es cero y se administra desde Inventario.')
      await loadVariants(selectedProduct); await loadStock(1)
    } catch (error) { setVariantError(error.message || 'No pudimos crear la variante.') }
    finally { setCreatingVariant(false) }
  }

  const pageControls = (page, pages, onChange) => <div className="flex items-center justify-between border-t border-black/[.06] px-4 py-3 font-poppins text-xs text-black/50"><span>Página {page} de {Math.max(1, pages)}</span><div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} className="rounded-lg border border-black/10 px-3 py-1.5 disabled:opacity-40">Anterior</button><button type="button" disabled={page >= pages} onClick={() => onChange(page + 1)} className="rounded-lg border border-black/10 px-3 py-1.5 disabled:opacity-40">Siguiente</button></div></div>

  return <div className="space-y-5">
    <header><p className="font-poppins text-xs font-medium text-[#8E53B5]">Operación · administración</p><h1 className="mt-1 font-poppins text-2xl font-semibold">Variantes e inventario</h1><p className="mt-1 font-poppins text-sm text-black/50">Consultá opciones y existencias; cada ajuste queda registrado con su motivo.</p></header>
    <div role="tablist" aria-label="Administración de variantes e inventario" className="flex flex-wrap gap-2">{[['stock', 'Inventario', Boxes], ['variants', 'Variantes', SlidersHorizontal]].map(([key, label, Icon]) => <button key={key} type="button" role="tab" aria-selected={section === key} onClick={() => setSection(key)} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-poppins text-xs font-medium ${section === key ? 'bg-[#466729] text-white' : 'border border-black/10 bg-white text-black/60 hover:border-[#466729]/30'}`}><Icon size={15} />{label}</button>)}</div>

    {section === 'stock' && <div className="space-y-5">
      {stockError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 font-poppins text-sm text-red-800">{stockError}<button type="button" onClick={() => loadStock(stockPage)} className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2"><RefreshCw size={14} />Reintentar</button></div>}
      <section className="rounded-2xl border border-black/[.06] bg-white p-4 sm:p-5"><div className="grid gap-3 sm:grid-cols-3">
        <label className="font-poppins text-[10px] text-black/55">Producto<select value={productFilter} onChange={(event) => { setProductFilter(event.target.value); setStockPage(1) }} className="mt-1.5 h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-xs"><option value="">Todos los productos</option>{products.map((product) => <option key={product.id} value={product.id}>{product.nombre}</option>)}</select></label>
        <label className="font-poppins text-[10px] text-black/55">Disponibilidad<select value={stockFilter} onChange={(event) => { setStockFilter(event.target.value); setStockPage(1) }} className="mt-1.5 h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-xs"><option value="all">Todas</option><option value="low">Stock bajo (≤ {threshold})</option><option value="out">Agotadas</option></select></label>
        <div className="flex items-end font-poppins text-xs text-black/50">{stockLoading ? 'Consultando existencias…' : `${stockTotal} variantes encontradas`}</div>
      </div></section>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(290px,.7fr)]">
        <section className="overflow-hidden rounded-2xl border border-black/[.06] bg-white"><div className="flex items-center gap-2 border-b border-black/[.06] p-4"><Package size={16} className="text-[#8E53B5]" /><h2 className="font-poppins text-sm font-semibold">Existencias por variante</h2></div>
          {stockLoading ? <p role="status" className="p-6 font-poppins text-sm text-black/50">Cargando inventario…</p> : stockError ? null : stockRows.length === 0 ? <p className="p-6 font-poppins text-sm text-black/50">No hay variantes para mostrar con estos filtros.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left"><thead><tr className="bg-[#FBFAF8] font-poppins text-[10px] uppercase tracking-wider text-black/45"><th className="px-4 py-3">Producto / opciones</th><th className="px-3 py-3">Físico</th><th className="px-3 py-3">Reservado</th><th className="px-3 py-3">Disponible</th><th className="px-3 py-3">Estado</th><th className="px-3 py-3">Movimientos</th></tr></thead><tbody>{stockRows.map((row) => <tr key={row.variante.id} className={`border-t border-black/[.05] font-poppins text-xs ${selectedVariant === row.variante.id ? 'bg-[#F7FAF4]' : ''}`}><td className="px-4 py-3.5"><strong className="font-medium text-[#292621]">{row.producto?.nombre || 'Producto no disponible'}</strong><span className="mt-1 block text-[10px] text-black/50">{summarizeValues(row.variante.valores)}{row.variante.activa ? '' : ' · Inactiva'}</span></td><td className="px-3 py-3.5">{row.stockFisico}</td><td className="px-3 py-3.5">{row.cantidadReservada}</td><td className="px-3 py-3.5 font-semibold">{row.stockDisponible}</td><td className="px-3 py-3.5"><span className={`rounded-full px-2 py-1 text-[9px] ${row.inconsistente ? 'bg-red-100 text-red-800' : row.stockDisponible === 0 ? 'bg-[#FCE9E6] text-[#B34234]' : row.stockDisponible <= threshold ? 'bg-[#FFF3D9] text-[#966316]' : 'bg-[#EAF0E4] text-[#466729]'}`}>{row.inconsistente ? 'Revisar' : availabilityLabel(row, threshold)}</span>{row.inconsistente && <span title={row.alertas?.join(', ')} className="ml-1 text-red-700">!</span>}</td><td className="px-3 py-3.5"><button type="button" onClick={() => { setSelectedVariant(row.variante.id); setAdjustment({ tipo: 'INGRESO', cantidad: '', motivo: '' }) }} className="rounded-lg border border-[#AF71DD]/30 px-2.5 py-1.5 text-[10px] text-[#69428A] hover:bg-[#F8F2FB]">Ver / ajustar</button></td></tr>)}</tbody></table></div>}
          {!stockLoading && !stockError && stockPages > 1 && pageControls(stockPage, stockPages, (page) => { setStockPage(page); loadStock(page) })}
        </section>
        <section className="rounded-2xl border border-black/[.06] bg-white p-5"><h2 className="font-poppins text-sm font-semibold">Registrar movimiento</h2>
          {!selectedInventory ? <p className="mt-3 rounded-xl bg-[#F8F7F5] p-4 font-poppins text-xs leading-5 text-black/50">Elegí “Ver / ajustar” en una variante para registrar un movimiento.</p> : <>
            <p className="mt-2 font-poppins text-xs text-black/60"><strong>{selectedInventory.producto.nombre}</strong> · {summarizeValues(selectedInventory.variante.valores)}</p><p className="mt-2 font-poppins text-[10px] text-black/45">Físico: {selectedInventory.stockFisico} · Reservado vigente: {selectedInventory.cantidadReservada} · Disponible: {selectedInventory.stockDisponible}</p>
            <form onSubmit={submitAdjustment} className="mt-4 space-y-3"><label className="block font-poppins text-[10px] text-black/55">Tipo<select value={adjustment.tipo} onChange={(event) => setAdjustment((current) => ({ ...current, tipo: event.target.value, cantidad: '' }))} className="mt-1.5 h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-xs"><option value="INGRESO">Reposición / ingreso</option><option value="AJUSTE">Ajuste de inventario</option></select></label>
              <label className="block font-poppins text-[10px] text-black/55">{adjustment.tipo === 'INGRESO' ? 'Unidades a ingresar' : 'Diferencia (positiva o negativa)'}<input required type="number" step="1" min={adjustment.tipo === 'INGRESO' ? '1' : undefined} value={adjustment.cantidad} onChange={(event) => setAdjustment((current) => ({ ...current, cantidad: event.target.value }))} className="mt-1.5 h-10 w-full rounded-lg border border-black/10 px-3 text-xs" placeholder={adjustment.tipo === 'INGRESO' ? 'Ej.: 12' : 'Ej.: -2 o 3'} /></label>
              <label className="block font-poppins text-[10px] text-black/55">Motivo<textarea required maxLength={500} minLength={3} rows={3} value={adjustment.motivo} onChange={(event) => setAdjustment((current) => ({ ...current, motivo: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-black/10 p-3 text-xs" placeholder="Reposición, corrección, rotura…" /></label>
              {stockNotice && <p role="status" className="rounded-lg bg-[#F8F7F5] p-3 font-poppins text-[10px] leading-5 text-black/65">{stockNotice}</p>}<button disabled={savingAdjustment || selectedInventory.inconsistente} className="h-10 w-full rounded-xl bg-[#466729] font-poppins text-xs font-medium text-white disabled:opacity-50">{savingAdjustment ? 'Registrando…' : 'Confirmar movimiento'}</button>{selectedInventory.inconsistente && <p className="font-poppins text-[10px] text-red-700">El inventario presenta una inconsistencia. No se permiten ajustes hasta revisarla.</p>}
            </form>
          </>}</section>
      </div>
      <section className="overflow-hidden rounded-2xl border border-black/[.06] bg-white"><div className="flex items-center gap-2 border-b border-black/[.06] p-4"><History size={16} className="text-[#8E53B5]" /><h2 className="font-poppins text-sm font-semibold">Historial de movimientos físicos</h2></div>
        {!selectedVariant ? <p className="p-5 font-poppins text-xs text-black/50">Seleccioná una variante para consultar su historial. Las reservas temporales no son movimientos de venta ni de inventario físico.</p> : movementLoading ? <p role="status" className="p-5 font-poppins text-xs text-black/50">Cargando movimientos…</p> : movementError ? <p role="alert" className="p-5 font-poppins text-xs text-red-700">{movementError}</p> : movements.length === 0 ? <p className="p-5 font-poppins text-xs text-black/50">Esta variante todavía no tiene movimientos físicos registrados.</p> : <><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead><tr className="bg-[#FBFAF8] font-poppins text-[10px] uppercase tracking-wider text-black/45"><th className="px-4 py-3">Fecha</th><th className="px-3 py-3">Movimiento</th><th className="px-3 py-3">Cantidad</th><th className="px-3 py-3">Stock antes → después</th><th className="px-3 py-3">Motivo</th><th className="px-3 py-3">Responsable</th></tr></thead><tbody>{movements.map((movement) => <tr key={movement.id} className="border-t border-black/[.05] font-poppins text-[10px]"><td className="whitespace-nowrap px-4 py-3">{new Date(movement.creadoEn).toLocaleString('es-AR')}</td><td className="px-3 py-3">{movement.tipo}</td><td className="px-3 py-3">{movement.cantidad > 0 ? '+' : ''}{movement.cantidad}</td><td className="px-3 py-3">{movement.stockAnterior ?? '—'} → {movement.stockResultante ?? '—'}</td><td className="max-w-xs px-3 py-3 text-black/55">{movement.motivo || 'Sin motivo registrado'}</td><td className="px-3 py-3 text-black/55">{movement.adminId ? 'Cuenta administrativa compartida' : 'No registrado'}</td></tr>)}</tbody></table></div>{movementPages > 1 && pageControls(movementPage, movementPages, (page) => loadMovements(selectedVariant, page))}</>}
      </section>
    </div>}

    {section === 'variants' && <section className="space-y-5">
      <div className="rounded-2xl border border-black/[.06] bg-white p-4 sm:p-5"><label className="block max-w-xl font-poppins text-[10px] text-black/55">Producto<select value={selectedProduct} onChange={(event) => { setSelectedProduct(event.target.value); setEditingVariant(''); setVariantNotice('') }} className="mt-1.5 h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-xs"><option value="">Seleccioná un producto</option>{products.map((product) => <option key={product.id} value={product.id}>{product.nombre}</option>)}</select></label>{catalogLoading && <p role="status" className="mt-3 font-poppins text-xs text-black/50">Cargando productos y atributos…</p>}{catalogError && <p role="alert" className="mt-3 font-poppins text-xs text-red-700">{catalogError}</p>}{variantError && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 font-poppins text-xs text-red-800">{variantError}</p>}{variantNotice && <p role="status" className="mt-3 rounded-lg bg-[#EEF3EA] p-3 font-poppins text-xs text-[#466729]">{variantNotice}</p>}</div>
      {selectedProduct && <>
        <details className="rounded-2xl border border-black/[.06] bg-white p-5"><summary className="cursor-pointer font-poppins text-sm font-semibold">Administrar atributos y valores</summary><p className="mt-2 font-poppins text-[10px] leading-5 text-black/45">Los atributos existentes son compartidos por el catálogo. No se eliminan valores desde aquí; renombrar datos con historial queda sujeto a validaciones del backend.</p>
          <form onSubmit={async (event) => { event.preventDefault(); try { await createAdminAttribute({ nombre: newAttributeName }); setNewAttributeName(''); await loadCatalog(); setVariantNotice('Atributo creado.') } catch (error) { setVariantError(error.message || 'No pudimos crear el atributo.') } }} className="mt-3 flex flex-col gap-2 sm:flex-row"><label className="sr-only" htmlFor="admin-new-attribute">Nombre del atributo</label><input id="admin-new-attribute" required minLength={1} maxLength={120} value={newAttributeName} onChange={(event) => setNewAttributeName(event.target.value)} placeholder="Nuevo atributo, por ejemplo Material" className="h-10 flex-1 rounded-lg border border-black/10 px-3 font-poppins text-xs" /><button className="h-10 rounded-lg bg-[#466729] px-4 font-poppins text-xs text-white">Agregar atributo</button></form>
          <div className="mt-4 grid gap-3 md:grid-cols-2">{attributes.map((attribute) => <div key={attribute.id} className="rounded-xl border border-black/[.06] p-3">
            <div className="flex items-center justify-between gap-2"><strong className="font-poppins text-xs">{attribute.nombre}</strong><button type="button" onClick={() => { setEditingAttribute(attribute.id); setAttributeNameDraft(attribute.nombre) }} className="rounded-md border border-black/10 px-2 py-1 font-poppins text-[9px]">Editar nombre</button></div>
            {editingAttribute === attribute.id && <form onSubmit={async (event) => { event.preventDefault(); try { await updateAdminAttribute(attribute.id, { nombre: attributeNameDraft }); setEditingAttribute(''); await loadCatalog(); setVariantNotice('Atributo actualizado.') } catch (error) { setVariantError(error.message || 'No pudimos actualizar el atributo.') } }} className="mt-2 flex gap-2"><label className="sr-only" htmlFor={`attribute-name-${attribute.id}`}>Nombre de {attribute.nombre}</label><input id={`attribute-name-${attribute.id}`} required maxLength={120} value={attributeNameDraft} onChange={(event) => setAttributeNameDraft(event.target.value)} className="h-9 min-w-0 flex-1 rounded-lg border border-black/10 px-2 font-poppins text-[10px]" /><button className="h-9 rounded-lg bg-[#466729] px-3 font-poppins text-[10px] text-white">Guardar</button><button type="button" onClick={() => setEditingAttribute('')} className="h-9 rounded-lg border border-black/10 px-2 font-poppins text-[10px]">Cancelar</button></form>}
            <div className="mt-2 space-y-1">{attribute.valores.map((value) => <div key={value.id} className="flex items-center justify-between gap-2 rounded-lg bg-[#FBFAF8] px-2 py-1.5">{editingAttributeValue === value.id ? <form onSubmit={async (event) => { event.preventDefault(); try { await updateAdminAttributeValue(value.id, { valor: attributeValueDraft }); setEditingAttributeValue(''); await loadCatalog(); setVariantNotice('Valor actualizado.') } catch (error) { setVariantError(error.message || 'No pudimos actualizar el valor.') } }} className="flex min-w-0 flex-1 gap-1"><label className="sr-only" htmlFor={`attribute-edit-value-${value.id}`}>Editar {attribute.nombre}: {value.valor}</label><input id={`attribute-edit-value-${value.id}`} required maxLength={120} value={attributeValueDraft} onChange={(event) => setAttributeValueDraft(event.target.value)} className="h-8 min-w-0 flex-1 rounded border border-black/10 px-2 font-poppins text-[10px]" /><button className="rounded bg-[#466729] px-2 font-poppins text-[9px] text-white">Guardar</button><button type="button" onClick={() => setEditingAttributeValue('')} className="rounded border border-black/10 px-2 font-poppins text-[9px]">×</button></form> : <><span className="font-poppins text-[10px] text-black/60">{value.valor}</span><button type="button" onClick={() => { setEditingAttributeValue(value.id); setAttributeValueDraft(value.valor) }} className="font-poppins text-[9px] text-[#69428A]">Editar</button></>}</div>)}</div>
            <form onSubmit={async (event) => { event.preventDefault(); const input = newAttributeValues[attribute.id]?.trim(); if (!input) return; try { await createAdminAttributeValue(attribute.id, { valor: input }); setNewAttributeValues((current) => ({ ...current, [attribute.id]: '' })); await loadCatalog(); setVariantNotice(`Valor agregado a ${attribute.nombre}.`) } catch (error) { setVariantError(error.message || 'No pudimos agregar el valor.') } }} className="mt-2 flex gap-2"><label className="sr-only" htmlFor={`attribute-value-${attribute.id}`}>Nuevo valor de {attribute.nombre}</label><input id={`attribute-value-${attribute.id}`} maxLength={120} value={newAttributeValues[attribute.id] || ''} onChange={(event) => setNewAttributeValues((current) => ({ ...current, [attribute.id]: event.target.value }))} placeholder="Nuevo valor" className="h-9 min-w-0 flex-1 rounded-lg border border-black/10 px-2 font-poppins text-[10px]" /><button className="h-9 rounded-lg border border-[#AF71DD]/30 px-3 font-poppins text-[10px] text-[#69428A]">Agregar valor</button></form>
          </div>)}</div>
        </details>
        <form onSubmit={submitNewVariant} className="rounded-2xl border border-black/[.06] bg-white p-5"><h2 className="font-poppins text-sm font-semibold">Agregar variante</h2><p className="mt-1 font-poppins text-[10px] text-black/45">Elegí como máximo un valor por atributo. Una variante nueva comienza sin stock; ingresá unidades desde la pestaña Inventario.</p><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{attributes.map((attribute) => <label key={attribute.id} className="font-poppins text-[10px] text-black/55">{attribute.nombre}<select value={createValues[attribute.id] || ''} onChange={(event) => setCreateValues((current) => ({ ...current, [attribute.id]: event.target.value }))} className="mt-1.5 h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-xs"><option value="">Sin valor</option>{attribute.valores.map((value) => <option key={value.id} value={value.id}>{value.valor}</option>)}</select></label>)}</div><div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,260px)_auto] sm:items-end"><label className="font-poppins text-[10px] text-black/55">Precio propio (opcional)<input inputMode="decimal" value={createPrice} onChange={(event) => setCreatePrice(event.target.value)} placeholder="Usar precio base" className="mt-1.5 h-10 w-full rounded-lg border border-black/10 px-3 text-xs" /></label><button disabled={creatingVariant || !selectedProduct} className="h-10 rounded-xl bg-[#466729] px-5 font-poppins text-xs font-medium text-white disabled:opacity-50">{creatingVariant ? 'Creando…' : 'Crear variante'}</button></div></form>
        <div className="space-y-3">{variantsLoading ? <p role="status" className="rounded-xl bg-white p-5 font-poppins text-sm text-black/50">Cargando variantes…</p> : variants.length === 0 ? <p className="rounded-xl bg-white p-5 font-poppins text-sm text-black/50">Este producto todavía no tiene variantes.</p> : variants.map((variant) => <article key={variant.id} className="rounded-2xl border border-black/[.06] bg-white p-5">
          {editingVariant !== variant.id ? <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h3 className="font-poppins text-sm font-semibold text-[#292621]">{summarizeValues(variant.valores)}</h3><p className="mt-1 font-poppins text-[10px] text-black/50">{variant.precio ? `Precio propio: ${formatAmount(variant.precio)}` : 'Usa el precio base'} · Stock físico: {stockRows.find((row) => row.variante.id === variant.id)?.stockFisico ?? variant.stock} · {variant.activa ? 'Activa' : 'Inactiva'}</p></div><button type="button" onClick={() => startVariantEditor(variant)} className="rounded-lg border border-[#AF71DD]/30 px-3 py-2 font-poppins text-xs text-[#69428A] hover:bg-[#F8F2FB]">Editar opciones</button></div> : <div><h3 className="font-poppins text-sm font-semibold">Editar variante</h3><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{attributes.map((attribute) => <label key={attribute.id} className="font-poppins text-[10px] text-black/55">{attribute.nombre}<select value={editValues[attribute.id] || ''} onChange={(event) => setEditValues((current) => ({ ...current, [attribute.id]: event.target.value }))} className="mt-1.5 h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-xs"><option value="">Sin valor</option>{attribute.valores.map((value) => <option key={value.id} value={value.id}>{value.valor}</option>)}</select></label>)}</div><div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,260px)_auto_auto] sm:items-end"><label className="font-poppins text-[10px] text-black/55">Precio propio (opcional)<input inputMode="decimal" value={editPrice} onChange={(event) => setEditPrice(event.target.value)} placeholder="Usar precio base" className="mt-1.5 h-10 w-full rounded-lg border border-black/10 px-3 text-xs" /></label><label className="flex h-10 items-center gap-2 font-poppins text-xs text-black/60"><input type="checkbox" checked={editActive} onChange={(event) => setEditActive(event.target.checked)} className="accent-[#466729]" />Activa</label><div className="flex gap-2"><button type="button" onClick={() => setEditingVariant('')} className="h-10 rounded-lg border border-black/10 px-3 font-poppins text-xs">Cancelar</button><button type="button" disabled={savingVariant} onClick={() => saveVariant(variant.id)} className="h-10 rounded-lg bg-[#466729] px-4 font-poppins text-xs text-white disabled:opacity-50">{savingVariant ? 'Guardando…' : 'Guardar'}</button></div></div><p className="mt-3 flex gap-2 font-poppins text-[10px] leading-5 text-amber-800"><AlertTriangle size={13} className="shrink-0" />Una combinación con referencias históricas no puede cambiarse. En ese caso, desactivá la variante y creá otra.</p></div>}
        </article>)}</div>
      </>}
      {selectedProduct && attributes.length === 0 && !catalogLoading && <p className="font-poppins text-xs text-amber-800">No se encontraron atributos configurados. Podés crear una variante sin opciones; el backend impedirá combinaciones activas duplicadas.</p>}
    </section>}
  </div>
}

export default AdminInventoryPage
