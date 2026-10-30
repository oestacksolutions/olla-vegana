import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, CheckCircle2, RotateCw } from 'lucide-react'
import StoreLayout from '../../components/layout/StoreLayout'
import logoOllaVegana from '../../assets/png/logo_olla_vegana.png'
import { CART_UPDATED_EVENT, getStoreCart } from '../../data/storeCart'
import { getPickupOptions, validateStoreCart } from '../../services/api'
import {
  availablePickupOptions,
  cartFingerprint,
  formatARS,
  formatPickupSchedule,
  PAYMENT_METHODS,
  readCheckoutDraft,
  saveCheckoutDraft,
  validateBuyerFields,
  validatePaymentSelection,
  validatePickupSelection,
} from '../../utils/checkout'

const EMPTY_FORM = { nombre: '', apellido: '', correo: '', telefono: '', observaciones: '' }
const DRAFT = readCheckoutDraft()

function CheckoutPage() {
  const [cartItems, setCartItems] = useState(() => getStoreCart())
  const [form, setForm] = useState(() => DRAFT?.form || EMPTY_FORM)
  const [pickupId, setPickupId] = useState(() => DRAFT?.pickupId || '')
  const [paymentMethod, setPaymentMethod] = useState(() => DRAFT?.paymentMethod || '')
  const [pickupOptions, setPickupOptions] = useState([])
  const [pickupState, setPickupState] = useState('loading')
  const [pickupRetry, setPickupRetry] = useState(0)
  const [fieldErrors, setFieldErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [serverResult, setServerResult] = useState(null)
  const [isValidating, setIsValidating] = useState(false)
  const [stage, setStage] = useState('form')
  const [step, setStep] = useState(0)
  const validationLock = useRef(false)
  const cartSignatureRef = useRef(cartFingerprint(cartItems))

  useEffect(() => {
    let active = true
    setPickupState('loading')
    getPickupOptions()
      .then((response) => {
        if (!active) return
        setPickupOptions(availablePickupOptions(response))
        setPickupState('loaded')
      })
      .catch(() => {
        if (!active) return
        setPickupOptions([])
        setPickupState('error')
      })
    return () => { active = false }
  }, [pickupRetry])

  useEffect(() => {
    // Los datos de contacto se guardan solo en sessionStorage para sobrevivir al regreso al carrito en esta pestaña.
    saveCheckoutDraft({ form, pickupId, paymentMethod })
  }, [form, pickupId, paymentMethod])

  useEffect(() => {
    const syncCart = () => {
      const latest = getStoreCart()
      const nextSignature = cartFingerprint(latest)
      setCartItems(latest)
      if (nextSignature !== cartSignatureRef.current) {
        cartSignatureRef.current = nextSignature
        setServerResult(null)
        setStage('form')
        setServerError('El carrito cambió. Volvé a validar los artículos antes de revisar los datos.')
      }
    }
    window.addEventListener(CART_UPDATED_EVENT, syncCart)
    window.addEventListener('storage', syncCart)
    return () => {
      window.removeEventListener(CART_UPDATED_EVENT, syncCart)
      window.removeEventListener('storage', syncCart)
    }
  }, [])

  const selectedPickup = pickupOptions.find((option) => option.seleccionId === pickupId)
  const officialValidation = serverResult?.valido === true ? serverResult : null
  const officialLines = officialValidation?.articulos || []
  const lineByKey = new Map(cartItems.map((item) => [`${item.productId}:${item.variantId}`, item]))
  const failedLines = new Map((serverResult?.articulos || [])
    .filter((item) => !item.valido)
    .map((item) => [`${item.productoId}:${item.varianteId}`, item.error?.mensaje || 'Este artículo no pudo validarse.']))

  const invalidateCurrentValidation = () => {
    setServerResult(null)
    setServerError('')
    setStage('form')
  }

  const handleFieldChange = (event) => {
    const { name, value } = event.currentTarget
    setForm((current) => ({ ...current, [name]: value }))
    setFieldErrors((current) => ({ ...current, [name]: undefined }))
    invalidateCurrentValidation()
  }

  const handleContinue = async (event) => {
    event.preventDefault()
    if (step === 0) {
      const errors = validateBuyerFields(form)
      setFieldErrors(errors)
      if (Object.keys(errors).length === 0) setStep(1)
      return
    }
    if (step === 1) {
      const errors = validatePickupSelection(pickupId, pickupOptions)
      setFieldErrors(errors)
      if (Object.keys(errors).length === 0) setStep(2)
      return
    }
    if (validationLock.current || isValidating) return
    const errors = validatePaymentSelection(paymentMethod)
    setFieldErrors(errors)
    setServerResult(null)
    setServerError('')
    if (Object.keys(errors).length > 0) return

    const currentItems = getStoreCart()
    if (currentItems.length === 0) {
      setCartItems([])
      setServerError('El carrito está vacío. Agregá artículos antes de continuar.')
      return
    }

    validationLock.current = true
    setIsValidating(true)
    const submittedSignature = cartFingerprint(currentItems)
    cartSignatureRef.current = submittedSignature
    try {
      const result = await validateStoreCart(currentItems)
      if (cartFingerprint(getStoreCart()) !== submittedSignature) {
        const latest = getStoreCart()
        cartSignatureRef.current = cartFingerprint(latest)
        setCartItems(latest)
        setServerError('El carrito cambió durante la validación. Revisalo y volvé a intentar.')
        return
      }
      if (result?.valido !== true) {
        setServerResult(result)
        setServerError('Revisá los artículos del carrito antes de continuar.')
        return
      }
      setServerResult(result)
      setStage('review')
    } catch (error) {
      const response = error.response
      if (error.status === 422 && response?.valido === false) {
        setServerResult(response)
        setServerError('Hay artículos que ya no están disponibles o cambiaron. Volvé al carrito para corregirlos.')
      } else {
        setServerError('No pudimos validar el carrito. Revisá tu conexión e intentá nuevamente.')
      }
    } finally {
      validationLock.current = false
      setIsValidating(false)
    }
  }

  const handlePickupChange = (value) => {
    setPickupId(value)
    setFieldErrors((current) => ({ ...current, retiro: undefined }))
    invalidateCurrentValidation()
  }

  const handlePaymentChange = (value) => {
    setPaymentMethod(value)
    setFieldErrors((current) => ({ ...current, metodoPago: undefined }))
    invalidateCurrentValidation()
  }

  const goToStep = (nextStep) => {
    setFieldErrors({})
    setServerError('')
    setServerResult(null)
    setStage('form')
    setStep(nextStep)
  }

  const cartLink = '/tienda?carrito=abierto'

  return (
    <StoreLayout>
      <main className="w-full flex-1 px-4 py-8 sm:px-8 sm:py-12">
        <div className="mx-auto max-w-[1120px]">
          <a href={cartLink} className="inline-flex min-h-10 items-center gap-2 font-poppins text-sm text-[#466729] underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#466729]">
            <ArrowLeft aria-hidden="true" size={16} /> Volver al carrito
          </a>
          <h1 className="mt-4 font-poppins text-2xl font-semibold text-[#466729] sm:text-3xl">Checkout</h1>
          <p className="mt-2 max-w-[720px] font-poppins text-sm leading-6 text-black/65">
            Completá tus datos y revisá los artículos. El pedido y el pago todavía no se crean desde esta etapa.
          </p>

          {cartItems.length > 0 && <ol aria-label="Progreso del checkout" className="mt-6 grid grid-cols-3 gap-2 sm:gap-4">
            {['Tus datos', 'Retiro', 'Pago'].map((title, index) => (
              <li key={title} aria-current={step === index ? 'step' : undefined} className={`flex min-h-12 items-center gap-2 border-b-2 px-1 pb-2 font-poppins text-xs sm:gap-3 sm:text-sm ${step === index ? 'border-[#AF71DD] font-semibold text-[#69428A]' : index < step ? 'border-[#466729] font-medium text-[#466729]' : 'border-black/10 text-black/45'}`}>
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs ${index < step ? 'bg-[#466729] text-white' : step === index ? 'bg-[#AF71DD] text-white' : 'bg-black/5'}`}>{index < step ? '✓' : index + 1}</span>
                <span>{title}</span>
              </li>
            ))}
          </ol>}

          {cartItems.length === 0 ? (
            <section className="mt-8 rounded-[18px] border border-[#AF71DD]/30 bg-white p-7 text-center sm:p-10">
              <h2 className="font-poppins text-xl font-medium text-[#466729]">Tu carrito está vacío</h2>
              <p className="mt-2 font-poppins text-sm text-black/60">Agregá productos para empezar el checkout.</p>
              <a href="/tienda" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-[#AF71DD] px-6 font-poppins text-sm font-semibold text-white">Volver a la tienda</a>
            </section>
          ) : (
            <div className="mt-7 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
              <section className="min-w-0 rounded-[18px] border border-[#AF71DD]/35 bg-white p-5 sm:p-8">
                {stage === 'form' ? (
                  <form noValidate onSubmit={handleContinue}>
                    {step === 0 && <>
                    <fieldset>
                      <legend className="font-poppins text-lg font-semibold text-[#466729]">Tus datos</legend>
                      <p className="mt-1 font-poppins text-sm text-black/60">Solo necesitamos información para identificar y contactar a quien retira.</p>
                      <div className="mt-5 grid gap-4 sm:grid-cols-2">
                        <label htmlFor="checkout-nombre" className="font-poppins text-sm text-black/75">
                          Nombre <span aria-hidden="true" className="text-[#F2380F]">*</span>
                          <input id="checkout-nombre" name="nombre" type="text" autoComplete="given-name" required maxLength={80} value={form.nombre} onChange={handleFieldChange} aria-invalid={Boolean(fieldErrors.nombre)} aria-describedby={fieldErrors.nombre ? 'error-nombre' : undefined} className="mt-2 h-11 w-full rounded-[9px] border border-[#466729]/30 bg-[#FFFDF8] px-3 outline-none focus:border-[#AF71DD] focus:ring-2 focus:ring-[#AF71DD]/20" />
                          {fieldErrors.nombre && <span id="error-nombre" className="mt-1 block text-xs text-[#B42318]">{fieldErrors.nombre}</span>}
                        </label>
                        <label htmlFor="checkout-apellido" className="font-poppins text-sm text-black/75">
                          Apellido <span aria-hidden="true" className="text-[#F2380F]">*</span>
                          <input id="checkout-apellido" name="apellido" type="text" autoComplete="family-name" required maxLength={80} value={form.apellido} onChange={handleFieldChange} aria-invalid={Boolean(fieldErrors.apellido)} aria-describedby={fieldErrors.apellido ? 'error-apellido' : undefined} className="mt-2 h-11 w-full rounded-[9px] border border-[#466729]/30 bg-[#FFFDF8] px-3 outline-none focus:border-[#AF71DD] focus:ring-2 focus:ring-[#AF71DD]/20" />
                          {fieldErrors.apellido && <span id="error-apellido" className="mt-1 block text-xs text-[#B42318]">{fieldErrors.apellido}</span>}
                        </label>
                        <label htmlFor="checkout-correo" className="font-poppins text-sm text-black/75 sm:col-span-2">
                          Correo electrónico <span aria-hidden="true" className="text-[#F2380F]">*</span>
                          <input id="checkout-correo" name="correo" type="email" autoComplete="email" required maxLength={254} value={form.correo} onChange={handleFieldChange} aria-invalid={Boolean(fieldErrors.correo)} aria-describedby={fieldErrors.correo ? 'error-correo' : undefined} className="mt-2 h-11 w-full rounded-[9px] border border-[#466729]/30 bg-[#FFFDF8] px-3 outline-none focus:border-[#AF71DD] focus:ring-2 focus:ring-[#AF71DD]/20" />
                          {fieldErrors.correo && <span id="error-correo" className="mt-1 block text-xs text-[#B42318]">{fieldErrors.correo}</span>}
                        </label>
                        <label htmlFor="checkout-telefono" className="font-poppins text-sm text-black/75 sm:col-span-2">
                          Teléfono de contacto <span aria-hidden="true" className="text-[#F2380F]">*</span>
                          <input id="checkout-telefono" name="telefono" type="tel" autoComplete="tel" inputMode="tel" required maxLength={30} value={form.telefono} onChange={handleFieldChange} aria-invalid={Boolean(fieldErrors.telefono)} aria-describedby={fieldErrors.telefono ? 'error-telefono' : 'ayuda-telefono'} className="mt-2 h-11 w-full rounded-[9px] border border-[#466729]/30 bg-[#FFFDF8] px-3 outline-none focus:border-[#AF71DD] focus:ring-2 focus:ring-[#AF71DD]/20" />
                          {fieldErrors.telefono ? <span id="error-telefono" className="mt-1 block text-xs text-[#B42318]">{fieldErrors.telefono}</span> : <span id="ayuda-telefono" className="mt-1 block text-xs text-black/50">Podés incluir código de país, espacios, paréntesis o guiones.</span>}
                        </label>
                        <label htmlFor="checkout-observaciones" className="font-poppins text-sm text-black/75 sm:col-span-2">
                          Observaciones del pedido <span className="text-xs text-black/50">(opcional)</span>
                          <textarea id="checkout-observaciones" name="observaciones" rows={3} maxLength={1000} value={form.observaciones} onChange={handleFieldChange} aria-invalid={Boolean(fieldErrors.observaciones)} aria-describedby={fieldErrors.observaciones ? 'error-observaciones' : 'ayuda-observaciones'} className="mt-2 w-full resize-y rounded-[9px] border border-[#466729]/30 bg-[#FFFDF8] px-3 py-2 outline-none focus:border-[#AF71DD] focus:ring-2 focus:ring-[#AF71DD]/20" />
                          {fieldErrors.observaciones ? <span id="error-observaciones" className="mt-1 block text-xs text-[#B42318]">{fieldErrors.observaciones}</span> : <span id="ayuda-observaciones" className="mt-1 block text-xs text-black/50">Máximo 1000 caracteres. Se conserva temporalmente en esta pestaña.</span>}
                        </label>
                      </div>
                    </fieldset>
                    </>}
                    {step === 1 && <>
                    <fieldset className="mt-8 border-t border-[#466729]/15 pt-6">
                      <legend className="font-poppins text-lg font-semibold text-[#466729]">Opción de retiro</legend>
                      <p className="mt-1 font-poppins text-sm text-black/60">Elegí una sola opción habilitada por la tienda.</p>
                      {pickupState === 'loading' && <p role="status" className="mt-4 font-poppins text-sm text-black/55">Cargando opciones de retiro…</p>}
                      {pickupState === 'error' && <div className="mt-4 rounded-[10px] bg-[#F2380F]/5 p-4" role="alert"><p className="font-poppins text-sm text-[#8A2817]">No pudimos cargar las opciones de retiro.</p><button type="button" onClick={() => setPickupRetry((value) => value + 1)} className="mt-2 inline-flex min-h-9 items-center gap-2 font-poppins text-sm font-medium text-[#466729] underline"><RotateCw aria-hidden="true" size={15} /> Reintentar</button></div>}
                      {pickupState === 'loaded' && pickupOptions.length === 0 && <p role="status" className="mt-4 rounded-[10px] bg-[#AF71DD]/10 p-4 font-poppins text-sm text-[#69428A]">No hay opciones de retiro habilitadas en este momento.</p>}
                      {pickupOptions.length > 0 && <div className="mt-4 flex flex-col gap-3">
                        {pickupOptions.map((option) => {
                          const title = option.tipo === 'ESPECIAL' ? `Retiro especial · ${option.evento || 'Evento'}` : option.nombre
                          const schedule = formatPickupSchedule(option)
                          return (
                            <label key={option.seleccionId} className={`flex cursor-pointer gap-3 rounded-[11px] border p-4 transition-colors focus-within:ring-2 focus-within:ring-[#466729]/30 ${pickupId === option.seleccionId ? 'border-[#AF71DD] bg-[#AF71DD]/5' : 'border-[#466729]/20 hover:border-[#466729]/45'}`}>
                              <input type="radio" name="retiro" value={option.seleccionId} checked={pickupId === option.seleccionId} onChange={() => handlePickupChange(option.seleccionId)} aria-describedby={fieldErrors.retiro ? 'error-retiro' : undefined} className="mt-1 h-4 w-4 accent-[#AF71DD]" />
                              <span className="min-w-0 font-poppins text-sm text-black/70">
                                <strong className="block font-semibold text-[#466729]">{title}</strong>
                                {option.direccion && <span className="mt-1 block">{option.direccion}</span>}
                                {option.tipo === 'ESPECIAL' && option.lugar && <span className="mt-1 block">Lugar: {option.lugar}</span>}
                                {schedule && <span className="mt-1 block">{schedule}</span>}
                              </span>
                            </label>
                          )
                        })}
                      </div>}
                      {fieldErrors.retiro && <p id="error-retiro" role="alert" className="mt-2 font-poppins text-xs text-[#B42318]">{fieldErrors.retiro}</p>}
                    </fieldset>
                    </>}
                    {step === 2 && <>
                    <fieldset className="mt-8 border-t border-[#466729]/15 pt-6">
                      <legend className="font-poppins text-lg font-semibold text-[#466729]">Preferencia de pago</legend>
                      <p className="mt-1 font-poppins text-sm leading-6 text-black/60">Estos métodos están previstos en la tienda, pero elegir uno aquí no inicia un cobro ni crea un pedido.</p>
                      <div className="mt-4 flex flex-col gap-3">
                        {PAYMENT_METHODS.map((method) => (
                          <label key={method.id} className={`flex cursor-pointer gap-3 rounded-[11px] border p-4 transition-colors focus-within:ring-2 focus-within:ring-[#466729]/30 ${paymentMethod === method.id ? 'border-[#AF71DD] bg-[#AF71DD]/5' : 'border-[#466729]/20 hover:border-[#466729]/45'}`}>
                            <input type="radio" name="metodoPago" value={method.id} checked={paymentMethod === method.id} onChange={() => handlePaymentChange(method.id)} aria-describedby={fieldErrors.metodoPago ? 'error-metodo-pago' : undefined} className="mt-1 h-4 w-4 accent-[#AF71DD]" />
                            <span className="font-poppins text-sm text-black/70"><strong className="block font-semibold text-[#466729]">{method.title}</strong>{method.detail}</span>
                          </label>
                        ))}
                      </div>
                      {fieldErrors.metodoPago && <p id="error-metodo-pago" role="alert" className="mt-2 font-poppins text-xs text-[#B42318]">{fieldErrors.metodoPago}</p>}
                    </fieldset>

                    {serverError && <p role="alert" aria-live="assertive" className="mt-6 rounded-[10px] bg-[#F2380F]/5 p-4 font-poppins text-sm leading-6 text-[#8A2817]">{serverError}</p>}
                    {serverResult?.errores?.length > 0 && <ul className="mt-3 list-disc space-y-1 pl-5 font-poppins text-sm text-[#8A2817]" aria-label="Problemas encontrados en el carrito">
                      {serverResult.errores.map((issue, index) => <li key={`${issue.productoId}-${issue.varianteId}-${index}`}>{issue.mensaje}</li>)}
                    </ul>}
                    </>}

                    <div className="mt-7 flex flex-col-reverse gap-3 border-t border-[#466729]/15 pt-5 sm:flex-row sm:items-center sm:justify-between">
                      {step === 0 ? <a href={cartLink} className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#AF71DD] px-5 font-poppins text-sm text-[#7A42A7]">Volver al carrito</a> : <button type="button" onClick={() => goToStep(step - 1)} className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#AF71DD] px-5 font-poppins text-sm text-[#7A42A7]">Anterior</button>}
                      <button type="submit" disabled={isValidating || (step === 1 && (pickupState === 'loading' || pickupState === 'error' || pickupOptions.length === 0))} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#AF71DD] px-6 font-poppins text-sm font-semibold text-white transition-colors hover:bg-[#995bc1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#466729] disabled:cursor-wait disabled:opacity-55">
                        {isValidating && <RotateCw aria-hidden="true" size={16} className="animate-spin" />}
                        {isValidating ? 'Validando carrito…' : step < 2 ? 'Continuar' : 'Validar carrito y revisar compra'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <section aria-labelledby="checkout-review-title">
                    <div className="flex items-start gap-3 rounded-[12px] bg-[#466729]/5 p-4">
                      <CheckCircle2 aria-hidden="true" className="mt-0.5 shrink-0 text-[#466729]" size={21} />
                      <div>
                        <h2 id="checkout-review-title" className="font-poppins text-lg font-semibold text-[#466729]">Datos y carrito revisados</h2>
                        <p className="mt-1 font-poppins text-sm leading-6 text-black/65">Los precios y la disponibilidad mostrados se recibieron del servidor para esta consulta.</p>
                      </div>
                    </div>
                    <dl className="mt-6 grid gap-4 font-poppins text-sm sm:grid-cols-2">
                      <div><dt className="text-xs uppercase tracking-wide text-black/50">Comprador</dt><dd className="mt-1 text-black/80">{form.nombre.trim()} {form.apellido.trim()}</dd></div>
                      <div><dt className="text-xs uppercase tracking-wide text-black/50">Correo</dt><dd className="mt-1 break-all text-black/80">{form.correo.trim()}</dd></div>
                      <div><dt className="text-xs uppercase tracking-wide text-black/50">Teléfono</dt><dd className="mt-1 text-black/80">{form.telefono.trim()}</dd></div>
                      <div><dt className="text-xs uppercase tracking-wide text-black/50">Retiro</dt><dd className="mt-1 text-black/80">{selectedPickup?.tipo === 'ESPECIAL' ? `${selectedPickup.evento} · ${selectedPickup.lugar}` : selectedPickup?.nombre}</dd></div>
                      <div className="sm:col-span-2"><dt className="text-xs uppercase tracking-wide text-black/50">Preferencia de pago</dt><dd className="mt-1 text-black/80">{PAYMENT_METHODS.find((method) => method.id === paymentMethod)?.title}</dd></div>
                      {form.observaciones.trim() && <div className="sm:col-span-2"><dt className="text-xs uppercase tracking-wide text-black/50">Observaciones</dt><dd className="mt-1 whitespace-pre-wrap text-black/80">{form.observaciones.trim()}</dd></div>}
                    </dl>
                    <p role="status" className="mt-6 rounded-[10px] border border-[#AF71DD]/30 bg-[#AF71DD]/5 p-4 font-poppins text-sm leading-6 text-[#69428A]">
                      La disponibilidad es una consulta puntual: no reserva unidades. La creación del pedido y el inicio del pago todavía no están disponibles. No se creó ningún pedido ni se inició ningún cobro.
                    </p>
                    <div className="mt-7 flex flex-col-reverse gap-3 border-t border-[#466729]/15 pt-5 sm:flex-row sm:justify-between">
                      <a href={cartLink} className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#AF71DD] px-5 font-poppins text-sm text-[#7A42A7]">Volver al carrito</a>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => goToStep(0)} className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#AF71DD] px-4 font-poppins text-sm text-[#7A42A7]">Editar datos</button>
                        <button type="button" onClick={() => goToStep(1)} className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#AF71DD] px-4 font-poppins text-sm text-[#7A42A7]">Editar retiro</button>
                        <button type="button" onClick={() => goToStep(2)} className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#AF71DD] px-5 font-poppins text-sm font-semibold text-white">Editar pago</button>
                      </div>
                    </div>
                  </section>
                )}
              </section>

              <aside className="h-fit min-w-0 rounded-[18px] border border-[#AF71DD]/35 bg-white p-5 sm:p-6" aria-labelledby="checkout-summary-title">
                <h2 id="checkout-summary-title" className="font-poppins text-lg font-semibold text-[#466729]">Resumen del carrito</h2>
                <ul className="mt-5 flex flex-col gap-4">
                  {officialValidation ? officialLines.map((line) => {
                    const item = lineByKey.get(`${line.productoId}:${line.varianteId}`)
                    const attrs = (line.variante || []).map(({ atributo, valor }) => `${atributo}: ${valor}`).join(' · ')
                    return <li key={`${line.productoId}-${line.varianteId}`} className="flex gap-3 border-b border-[#466729]/10 pb-4">
                      <img src={item?.image || logoOllaVegana} alt={item?.image ? `Imagen de ${line.nombre}` : 'Logo de Olla Vegana'} onError={(event) => { event.currentTarget.src = logoOllaVegana }} className="h-[74px] w-[58px] shrink-0 rounded-[9px] bg-[#FFF8E9] object-contain" />
                      <div className="min-w-0 flex-1 font-poppins text-sm text-black/75">
                        <p className="font-medium text-black/85">{line.nombre}</p>
                        {attrs && <p className="mt-1 text-xs text-black/55">{attrs}</p>}
                        <p className="mt-1 text-xs text-black/55">{line.cantidad} × {formatARS(line.precioUnitario)}</p>
                        <p className="mt-1 font-medium text-[#466729]">{formatARS(line.subtotal)}</p>
                      </div>
                    </li>
                  }) : cartItems.map((item) => {
                    const error = failedLines.get(`${item.productId}:${item.variantId}`)
                    const attrs = item.attributes?.length
                      ? item.attributes.map(({ atributo, valor }) => `${atributo}: ${valor}`).join(' · ')
                      : item.variant || (item.size ? `Talle ${item.size}` : '')
                    return <li key={`${item.productId}-${item.variantId || ''}`} className="flex gap-3 border-b border-[#466729]/10 pb-4">
                      <img src={item.image || logoOllaVegana} alt={item.image ? `Imagen de ${item.name}` : 'Logo de Olla Vegana'} onError={(event) => { event.currentTarget.src = logoOllaVegana }} className="h-[74px] w-[58px] shrink-0 rounded-[9px] bg-[#FFF8E9] object-contain" />
                      <div className="min-w-0 flex-1 font-poppins text-sm text-black/75">
                        <p className="font-medium text-black/85">{item.name}</p>
                        {attrs && <p className="mt-1 text-xs text-black/55">{attrs}</p>}
                        <p className="mt-1 text-xs text-black/55">Cantidad: {item.quantity}</p>
                        <p className="mt-1 text-xs text-[#69428A]">Precio pendiente de validar con el servidor</p>
                        {error && <p role="alert" className="mt-2 text-xs leading-5 text-[#B42318]">{error}</p>}
                      </div>
                    </li>
                  })}
                </ul>
                {officialValidation ? <div className="mt-5 flex items-center justify-between border-t border-[#466729]/15 pt-4 font-poppins text-base text-black/80"><span>Total validado</span><strong className="font-semibold text-[#466729]">{formatARS(officialValidation.total)}</strong></div>
                  : <p className="mt-5 border-t border-[#466729]/15 pt-4 font-poppins text-xs leading-5 text-black/55">El servidor confirmará los precios y el total al revisar el carrito.</p>}
              </aside>
            </div>
          )}
        </div>
      </main>
    </StoreLayout>
  )
}

export default CheckoutPage
