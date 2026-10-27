import { useState } from 'react'
import StoreLayout from '../../components/layout/StoreLayout'
import { findStoreOrder } from '../../data/storeOrders'

const statuses = {
  confirmed: ['Pedido confirmado', 'El pago fue aprobado. Te contactaremos para coordinar el retiro.', 'text-[#466729]'],
  pending: ['Pago pendiente', 'El pedido está registrado y esperamos la confirmación del pago.', 'text-[#9A6500]'],
  rejected: ['Pago rechazado', 'No se pudo completar el pago. Contactanos si necesitás ayuda.', 'text-[#B42318]'],
  error: ['Estado no disponible', 'No pudimos consultar el estado en este momento.', 'text-[#B42318]'],
}

function OrderTrackingPage() {
  const [orderId, setOrderId] = useState('')
  const [email, setEmail] = useState('')
  const [order, setOrder] = useState(null)
  const [searched, setSearched] = useState(false)
  const [isSearching, setIsSearching] = useState(false)

  const searchOrder = async (event) => {
    event.preventDefault()
    setSearched(true)
    setOrder(null)
    setIsSearching(true)
    try {
      const result = await Promise.resolve(findStoreOrder(orderId, email))
      setOrder(result)
    } catch {
      setOrder(null)
    } finally {
      setIsSearching(false)
    }
  }

  const status = order && statuses[order.status] ? order.status : 'pending'

  return (
    <StoreLayout>
      <main className="w-full px-5 py-12 sm:px-8 sm:py-16">
        <section className="mx-auto max-w-[680px] rounded-[18px] border border-[#AF71DD]/40 bg-white p-6 sm:p-10">
          <p className="font-poppins text-sm font-semibold uppercase tracking-wide text-[#AF71DD]">Ayuda con tu compra</p>
          <h1 className="mt-2 font-poppins text-2xl font-semibold text-[#466729] sm:text-3xl">Consultar pedido</h1>
          <p className="mt-3 font-poppins text-sm leading-6 text-black/65">Ingresá el número de pedido y el email que usaste al comprar para consultar su estado.</p>

          <form onSubmit={searchOrder} className="mt-7 flex flex-col gap-4">
            <label className="font-poppins text-sm text-black/75">
              Número de pedido
              <input id="tracking-order-id" required value={orderId} onChange={(event) => setOrderId(event.target.value)} placeholder="Ej.: OV-M..." autoComplete="off" aria-describedby="tracking-order-hint" className="mt-2 h-11 w-full rounded-[8px] border border-[#466729]/30 bg-[#FFFDF8] px-3 outline-none focus:border-[#AF71DD]" />
              <span id="tracking-order-hint" className="sr-only">Encontrás el número en la confirmación de tu pedido.</span>
            </label>
            <label className="font-poppins text-sm text-black/75">
              Email de compra
              <input id="tracking-email" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@email.com" autoComplete="email" className="mt-2 h-11 w-full rounded-[8px] border border-[#466729]/30 bg-[#FFFDF8] px-3 outline-none focus:border-[#AF71DD]" />
            </label>
            <button type="submit" disabled={isSearching} className="mt-2 h-11 self-start rounded-full bg-[#AF71DD] px-6 font-poppins text-sm font-semibold text-white transition-colors hover:bg-[#9b58cc] disabled:cursor-wait disabled:opacity-60">{isSearching ? 'Buscando pedido…' : 'Consultar estado'}</button>
          </form>

          {isSearching && <p role="status" aria-live="polite" className="mt-5 font-poppins text-sm text-black/70">Buscando tu pedido…</p>}
          {searched && !isSearching && !order && <p role="alert" aria-live="assertive" className="mt-6 rounded-xl bg-[#FFF8E9] p-4 font-poppins text-sm leading-6 text-black/70">No encontramos un pedido con esos datos. Revisá el número y el email e intentá nuevamente.</p>}

          {order && (
            <section aria-live="polite" className="mt-7 rounded-xl bg-[#FFF8E9] p-5">
              <h2 className={`font-poppins text-lg font-semibold ${statuses[status][2]}`}>{statuses[status][0]}</h2>
              <p className="mt-2 font-poppins text-sm leading-6 text-black/70">{statuses[status][1]}</p>
              <dl className="mt-4 grid gap-2 font-poppins text-sm text-black/70 sm:grid-cols-2">
                <div><dt className="inline font-semibold text-[#466729]">Pedido: </dt><dd className="inline">{order.id}</dd></div>
                <div><dt className="inline font-semibold text-[#466729]">Total: </dt><dd className="inline">${order.total.toLocaleString('es-AR')}</dd></div>
                <div><dt className="inline font-semibold text-[#466729]">Pago: </dt><dd className="inline">{order.paymentTitle}</dd></div>
                <div><dt className="inline font-semibold text-[#466729]">Retiro: </dt><dd className="inline">{order.pickupTitle}</dd></div>
              </dl>
            </section>
          )}
        </section>
      </main>
    </StoreLayout>
  )
}

export default OrderTrackingPage
