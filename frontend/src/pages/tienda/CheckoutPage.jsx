import { useEffect, useState } from 'react'
import StoreLayout from '../../components/layout/StoreLayout'
import { CART_UPDATED_EVENT, clearStoreCart, getStoreCart } from '../../data/storeCart'
import { createStoreOrder } from '../../data/storeOrders'

const steps = ['Tus datos', 'Método de pago', 'Retiro']
const paymentMethods = [
  { id: 'mercado-pago', title: 'Mercado Pago', detail: 'Mercado Pago o tarjetas de crédito a través de Mercado Pago.' },
  { id: 'transferencia', title: 'Transferencia bancaria', detail: 'Te compartiremos los datos para transferir al coordinar el pedido.' },
]
const pickupOptions = [
  { id: 'moreno', title: 'Moreno', detail: 'Viernes de 16 a 19 hs.' },
  { id: 'moron', title: 'Morón', detail: 'Martes y viernes de 16 a 19 hs.' },
  { id: 'veganpalooza', title: 'Veganpalooza', detail: 'Un domingo al mes. La fecha se coordina según el evento.' },
]
const money = (value) => `$${value.toLocaleString('es-AR')}`

function CheckoutPage() {
  const [cartItems, setCartItems] = useState(() => getStoreCart())
  const [step, setStep] = useState(0)
  const [payment, setPayment] = useState('')
  const [pickup, setPickup] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [form, setForm] = useState({ name: '', email: '', phone: '', instagram: '' })
  const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0)

  useEffect(() => {
    const updateCart = () => setCartItems(getStoreCart())
    window.addEventListener(CART_UPDATED_EVENT, updateCart)
    window.addEventListener('storage', updateCart)
    return () => {
      window.removeEventListener(CART_UPDATED_EVENT, updateCart)
      window.removeEventListener('storage', updateCart)
    }
  }, [])

  const submitStep = (event) => {
    event.preventDefault()
    setFormError('')
    if (step === 0) {
      setStep(1)
      return
    }
    if (step === 1) {
      if (!payment) {
        setFormError('Elegí un método de pago para continuar.')
        return
      }
      setStep(2)
      return
    }
    confirmOrder()
  }

  const confirmOrder = async () => {
    const customer = {
      ...form,
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.replace(/\D/g, ''),
      instagram: form.instagram.trim(),
    }
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)
    if (!customer.name || !validEmail || !customer.phone) {
      setStep(0)
      setFormError(!customer.name
        ? 'Completá tu nombre y apellido.'
        : !validEmail
          ? 'Revisá el email: debe tener un formato válido, por ejemplo nombre@email.com.'
          : 'Completá tu número de teléfono.')
      return
    }
    if (!payment) {
      setStep(1)
      setFormError('Elegí un método de pago para continuar.')
      return
    }
    if (!pickup) {
      setStep(2)
      setFormError('Elegí un punto de retiro para confirmar el pedido.')
      return
    }
    setFormError('')
    setSubmitting(true)
    try {
      const order = await createStoreOrder({
        customer,
        items: cartItems,
        total,
        payment,
        paymentTitle: paymentMethods.find((option) => option.id === payment)?.title,
        pickup,
        pickupTitle: pickupOptions.find((option) => option.id === pickup)?.title,
      })
      clearStoreCart()
      window.location.assign(`/tienda/pedido/${encodeURIComponent(order.id)}`)
    } catch {
      setFormError('No pudimos registrar el pedido. Revisá tu conexión e intentá nuevamente.')
    } finally {
      setSubmitting(false)
    }
  }

  const summary = (
    <aside className="h-fit rounded-[18px] border border-[#AF71DD]/40 bg-white p-5 sm:p-6">
      <h2 className="font-poppins text-lg font-semibold text-[#466729]">Resumen del pedido</h2>
      <ul className="mt-5 flex flex-col gap-4">
        {cartItems.map((item) => (
          <li key={`${item.productId}-${item.size || ''}-${item.variant || ''}`} className="flex justify-between gap-4 font-poppins text-sm text-black/75">
            <span className="min-w-0">{item.name}{item.size ? ` · Talle ${item.size}` : ''}{item.variant ? ` · ${item.variant}` : ''} <span className="text-black/55">× {item.quantity}</span></span>
            <span className="shrink-0">{money(item.price * item.quantity)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex justify-between border-t border-[#466729]/15 pt-4 font-poppins text-base text-black/80">
        <span>Total</span><strong className="font-semibold">{money(total)}</strong>
      </div>
      <p className="mt-3 font-poppins text-xs leading-5 text-black/55">El retiro no tiene costo. La entrega se coordina después de ingresar la compra.</p>
    </aside>
  )

  return (
    <StoreLayout>
      <main className="w-full px-5 py-10 sm:px-8 sm:py-14">
        <div className="mx-auto max-w-[1080px]">
          <a href="/tienda" className="font-poppins text-sm text-[#466729] underline">← Volver a la tienda</a>
          <h1 className="mt-5 font-poppins text-2xl font-semibold text-[#466729] sm:text-3xl">Finalizar compra</h1>

          {cartItems.length === 0 ? (
            <div className="mt-8 rounded-[18px] bg-white p-8 text-center font-poppins text-black/70">
              Tu carrito está vacío. <a href="/tienda" className="text-[#7A42A7] underline">Volver a la tienda</a>
            </div>
          ) : (
            <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1fr_360px]">
              <section className="rounded-[18px] border border-[#AF71DD]/40 bg-white p-5 sm:p-8">
                <ol aria-label="Pasos del checkout" className="mb-8 grid grid-cols-3 gap-2">
                  {steps.map((label, index) => (
                    <li key={label} aria-current={index === step ? 'step' : undefined} className={`border-b-2 pb-3 font-poppins text-xs sm:text-sm ${index === step ? 'border-[#AF71DD] font-semibold text-[#466729]' : index < step ? 'border-[#466729] text-[#466729]' : 'border-[#466729]/15 text-black/45'}`}>
                      <span className="mr-1">{index + 1}.</span>{label}
                    </li>
                  ))}
                </ol>

                <form onSubmit={submitStep}>
                  {step === 0 && (
                    <fieldset>
                      <legend className="font-poppins text-lg font-semibold text-[#466729]">1. Tus datos</legend>
                      <p className="mt-1 font-poppins text-sm text-black/60">Necesitamos tus datos para contactarte por el pedido.</p>
                      <div className="mt-5 grid gap-4 sm:grid-cols-2">
                        {[
                          { key: 'name', label: 'Nombre y apellido', type: 'text', required: true, autoComplete: 'name' },
                          { key: 'email', label: 'Email', type: 'email', required: true, autoComplete: 'email' },
                          { key: 'phone', label: 'Teléfono', type: 'tel', required: true, autoComplete: 'tel' },
                          { key: 'instagram', label: 'Instagram (opcional)', type: 'text', required: false, autoComplete: 'off' },
                        ].map(({ key, label, ...attributes }) => (
                          <label key={key} className="font-poppins text-sm text-black/75">
                            {label}
                            <input {...attributes} inputMode={key === 'phone' ? 'numeric' : undefined} pattern={key === 'phone' ? '[0-9]*' : undefined} value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: key === 'phone' ? event.target.value.replace(/\D/g, '') : event.target.value }))} className="mt-2 h-11 w-full rounded-[8px] border border-[#466729]/30 bg-[#FFFDF8] px-3 outline-none focus:border-[#AF71DD]" />
                            {key === 'instagram' && <span className="mt-1 block text-xs text-black/55">Opcional; lo usamos para coordinar la entrega.</span>}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  )}

                  {step === 1 && (
                    <fieldset>
                      <legend className="font-poppins text-lg font-semibold text-[#466729]">2. Método de pago</legend>
                      <p className="mt-1 font-poppins text-sm text-black/60">Seleccioná cómo preferís pagar.</p>
                      <div className="mt-5 flex flex-col gap-3">
                        {paymentMethods.map((option) => (
                          <label key={option.id} className={`flex cursor-pointer gap-3 rounded-[10px] border p-4 ${payment === option.id ? 'border-[#AF71DD] bg-[#AF71DD]/5' : 'border-[#466729]/20'}`}>
                            <input type="radio" name="payment" value={option.id} checked={payment === option.id} onChange={() => setPayment(option.id)} className="mt-1 accent-[#AF71DD]" />
                            <span className="font-poppins text-sm text-black/75"><strong className="block font-semibold text-[#466729]">{option.title}</strong>{option.detail}</span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  )}

                  {step === 2 && (
                    <fieldset>
                      <legend className="font-poppins text-lg font-semibold text-[#466729]">3. Punto de retiro</legend>
                      <p className="mt-1 font-poppins text-sm text-black/60">Elegí dónde preferís retirar tu pedido.</p>
                      <div className="mt-5 flex flex-col gap-3">
                        {pickupOptions.map((option) => (
                          <label key={option.id} className={`flex cursor-pointer gap-3 rounded-[10px] border p-4 ${pickup === option.id ? 'border-[#AF71DD] bg-[#AF71DD]/5' : 'border-[#466729]/20'}`}>
                            <input type="radio" name="pickup" value={option.id} checked={pickup === option.id} onChange={() => setPickup(option.id)} className="mt-1 accent-[#AF71DD]" />
                            <span className="font-poppins text-sm text-black/70"><strong className="block font-semibold text-[#466729]">{option.title}</strong>{option.detail}</span>
                          </label>
                        ))}
                      </div>
                      <p className="mt-4 font-poppins text-xs leading-5 text-black/55">La fecha y los detalles del retiro se confirman por email o Instagram una vez ingresada la compra.</p>
                    </fieldset>
                  )}

                  {formError && <p role="alert" aria-live="assertive" className="mt-4 font-poppins text-sm leading-5 text-[#B42318]">{formError}</p>}
                  <div className="mt-8 flex items-center justify-between gap-3 border-t border-[#466729]/15 pt-5">
                    {step > 0 ? <button type="button" onClick={() => setStep((current) => current - 1)} className="h-11 rounded-full border border-[#AF71DD] px-5 font-poppins text-sm text-[#7A42A7]">Atrás</button> : <span />}
                    <button type="submit" disabled={submitting} className="h-11 rounded-full bg-[#AF71DD] px-6 font-poppins text-sm font-semibold text-white transition-colors hover:bg-[#9b58cc] disabled:cursor-wait disabled:opacity-60" aria-live="polite">
                      {submitting ? 'Registrando pedido…' : step < 2 ? 'Continuar' : 'Confirmar pedido'}
                    </button>
                  </div>
                </form>
              </section>
              {summary}
            </div>
          )}
        </div>
      </main>
    </StoreLayout>
  )
}

export default CheckoutPage
