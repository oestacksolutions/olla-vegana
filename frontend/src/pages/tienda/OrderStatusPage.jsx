import StoreLayout from '../../components/layout/StoreLayout'
import { getStoreOrder } from '../../data/storeOrders'

const statusContent = {
  confirmed: {
    eyebrow: 'Pago aprobado', title: '¡Tu pedido está confirmado!',
    description: 'Recibimos la confirmación del pago. Te contactaremos para coordinar el retiro.',
    color: 'text-[#466729]',
  },
  pending: {
    eyebrow: 'Pago pendiente', title: 'Estamos esperando tu pago',
    description: 'Tu pedido quedó registrado, pero todavía no recibimos la confirmación del pago. Te contactaremos con los próximos pasos.',
    color: 'text-[#9A6500]',
  },
  rejected: {
    eyebrow: 'Pago rechazado', title: 'No se pudo completar el pago',
    description: 'El medio de pago rechazó la operación. Podés volver al checkout e intentar con otra opción.',
    color: 'text-[#B42318]',
  },
  error: {
    eyebrow: 'No pudimos procesar el pedido', title: 'Ocurrió un error',
    description: 'No pudimos confirmar el estado de tu pedido. Revisá tu conexión e intentá nuevamente.',
    color: 'text-[#B42318]',
  },
}

function OrderStatusPage({ orderId }) {
  const order = getStoreOrder(orderId)
  const status = order ? (statusContent[order.status] ? order.status : 'pending') : 'error'
  const content = statusContent[status]

  return (
    <StoreLayout>
      <main className="w-full px-5 py-12 sm:px-8 sm:py-16">
        <section aria-labelledby="order-status-title" className="mx-auto max-w-[680px] rounded-[18px] border border-[#AF71DD]/40 bg-white p-6 text-center sm:p-10">
          <p className={`font-poppins text-sm font-semibold uppercase tracking-wide ${content.color}`}>{content.eyebrow}</p>
          <h1 id="order-status-title" className="mt-3 font-poppins text-2xl font-semibold text-[#466729] sm:text-3xl">{content.title}</h1>
          <p className="mx-auto mt-4 max-w-[520px] font-poppins text-sm leading-6 text-black/70">{content.description}</p>
          {order && (
            <div className="mx-auto mt-6 max-w-[360px] rounded-xl bg-[#FFFDF8] p-4 text-left font-poppins text-sm text-black/70">
              <p><strong className="text-[#466729]">Pedido:</strong> {order.id}</p>
              <p className="mt-2"><strong className="text-[#466729]">Total:</strong> ${order.total.toLocaleString('es-AR')}</p>
              <p className="mt-2"><strong className="text-[#466729]">Pago:</strong> {order.paymentTitle}</p>
              {order.status === 'pending' && order.payment === 'transferencia' && <p className="mt-3 text-xs leading-5">Los datos para transferir se coordinarán por email o Instagram.</p>}
            </div>
          )}
          <a href={status === 'rejected' || status === 'error' ? '/tienda/checkout' : '/tienda'} className="mt-7 inline-flex h-11 items-center rounded-full bg-[#AF71DD] px-6 font-poppins text-sm font-semibold text-white transition-colors hover:bg-[#9b58cc]">
            {status === 'rejected' || status === 'error' ? 'Volver al checkout' : 'Seguir en la tienda'}
          </a>
        </section>
      </main>
    </StoreLayout>
  )
}

export default OrderStatusPage
