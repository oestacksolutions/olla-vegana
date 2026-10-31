import { useEffect, useState } from 'react'
import { Check, Copy, RotateCw } from 'lucide-react'
import StoreLayout from '../../components/layout/StoreLayout'
import { getTransferInstructions } from '../../services/api'
import { readOrderAccessToken, transferStatusPresentation } from '../../utils/orderTransferUi'

function formatDeadline(value) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return 'No disponible'
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Argentina/Buenos_Aires',
  }).format(date)
}

function TransferInstructionsPage({ orderId, demoOrder = null, demoStatus = '' }) {
  const [order, setOrder] = useState(null)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')

  useEffect(() => {
    if (demoOrder) {
      setOrder(demoOrder)
      setStatus('loaded')
      setError('')
      return undefined
    }

    const token = readOrderAccessToken(window.location.hash)
    if (!token) {
      setStatus('error')
      setError('Este enlace no contiene un acceso válido al pedido. Usá el enlace recibido al finalizar la compra.')
      return undefined
    }
    const controller = new AbortController()
    setStatus('loading')
    setError('')
    getTransferInstructions(orderId, token, { signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return
        setOrder(result)
        setStatus('loaded')
      })
      .catch((requestError) => {
        if (controller.signal.aborted) return
        setError(requestError.status === 404
          ? 'No encontramos el pedido o el enlace ya no es válido.'
          : 'No pudimos consultar las instrucciones. Revisá tu conexión e intentá nuevamente.')
        setStatus('error')
      })
    return () => controller.abort()
  }, [orderId, demoOrder])

  const copyValue = async (label, value) => {
    if (!value || !navigator.clipboard?.writeText) {
      setCopied('No pudimos copiar automáticamente. Seleccioná el dato y copialo manualmente.')
      return
    }
    try {
      await navigator.clipboard.writeText(value)
      setCopied(`${label} copiado.`)
    } catch {
      setCopied('No pudimos copiar automáticamente. Seleccioná el dato y copialo manualmente.')
    }
  }

  const [statusTitle, statusDescription] = transferStatusPresentation(order?.estado)
  const canTransfer = status === 'loaded' && order?.estado === 'PENDIENTE' && order.instrucciones

  return (
    <StoreLayout>
      <main className="w-full flex-1 px-4 py-9 sm:px-8 sm:py-14">
        <section className="mx-auto max-w-[760px] rounded-[18px] border border-[#AF71DD]/35 bg-white p-5 shadow-sm sm:p-9">
          <p className="font-poppins text-xs font-semibold uppercase tracking-[.14em] text-[#AF71DD]">Olla Vegana · Tu pedido</p>
          {demoOrder && <p className="mb-3 inline-flex rounded-full bg-[#FFF1C7] px-3 py-1 font-poppins text-xs font-bold uppercase tracking-wide text-[#795400]">Vista previa · DEMO · Datos ficticios</p>}
          <h1 className="mt-2 font-poppins text-2xl font-semibold text-[#466729] sm:text-3xl">Instrucciones de transferencia</h1>
          {demoOrder && <nav aria-label="Estados de vista previa" className="mt-4 flex flex-wrap gap-2">{['pendiente', 'pagado', 'vencido', 'cancelado'].map((state) => <a key={state} aria-current={state === demoStatus ? 'page' : undefined} href={`/__preview/transferencia/${state}`} className={`rounded-full px-3 py-2 font-poppins text-xs font-semibold capitalize focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#466729] ${state === demoStatus ? 'bg-[#466729] text-white' : 'border border-[#466729]/30 text-[#466729] hover:bg-[#466729]/5'}`}>{state}</a>)}</nav>}

          {status === 'loading' && <p role="status" className="mt-7 flex items-center gap-2 font-poppins text-sm text-black/65"><RotateCw aria-hidden="true" size={17} className="animate-spin" />Consultando el pedido…</p>}
          {status === 'error' && <div role="alert" className="mt-7 rounded-xl border border-[#F2380F]/20 bg-[#F2380F]/5 p-4 font-poppins text-sm leading-6 text-[#8A2817]">{error}</div>}

          {status === 'loaded' && order && <>
            <div className={`mt-6 rounded-xl border p-4 ${order.estado === 'PENDIENTE' ? 'border-[#D7B34A]/40 bg-[#FFF8E9]' : 'border-[#466729]/20 bg-[#466729]/5'}`}>
              <p className="font-poppins text-sm font-semibold text-[#466729]">{statusTitle}</p>
              <p className="mt-1 font-poppins text-sm leading-6 text-black/65">{statusDescription}</p>
            </div>

            <dl className="mt-6 grid gap-4 rounded-xl bg-[#FFFDF8] p-4 font-poppins text-sm sm:grid-cols-2 sm:p-5">
              <div><dt className="text-xs uppercase tracking-wide text-black/50">Número de pedido</dt><dd className="mt-1 font-semibold text-[#466729]">{order.pedidoNumero}</dd></div>
              <div><dt className="text-xs uppercase tracking-wide text-black/50">Importe del pedido</dt><dd className="mt-1 font-semibold text-[#466729]">{order.importe}</dd></div>
              {order.venceEn && <div className="sm:col-span-2"><dt className="text-xs uppercase tracking-wide text-black/50">Fecha y hora límite</dt><dd className="mt-1 text-black/75">{formatDeadline(order.venceEn)}</dd></div>}
            </dl>

            {canTransfer && <section aria-labelledby="bank-instructions-heading" className="mt-6 rounded-xl border border-[#466729]/20 p-4 sm:p-6">
              <h2 id="bank-instructions-heading" className="font-poppins text-lg font-semibold text-[#466729]">Datos para transferir</h2>
              {order.instrucciones.titular && <p className="mt-4 font-poppins text-sm text-black/70"><strong>Titular:</strong> {order.instrucciones.titular}</p>}
              {order.instrucciones.banco && <p className="mt-2 font-poppins text-sm text-black/70"><strong>Banco:</strong> {order.instrucciones.banco}</p>}
              {order.instrucciones.alias && <div className="mt-4 flex flex-col gap-2 rounded-lg bg-[#FFF8E9] p-3 sm:flex-row sm:items-center sm:justify-between"><p className="min-w-0 break-all font-poppins text-sm text-black/75"><strong>Alias:</strong> {order.instrucciones.alias}</p><button type="button" onClick={() => copyValue('Alias', order.instrucciones.alias)} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-full border border-[#AF71DD] px-4 font-poppins text-xs font-semibold text-[#7A42A7] hover:bg-[#AF71DD]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#466729]"><Copy aria-hidden="true" size={14} />Copiar alias</button></div>}
              {order.instrucciones.cbuCvu && <div className="mt-3 flex flex-col gap-2 rounded-lg bg-[#FFF8E9] p-3 sm:flex-row sm:items-center sm:justify-between"><p className="min-w-0 break-all font-poppins text-sm text-black/75"><strong>CBU/CVU:</strong> {order.instrucciones.cbuCvu}</p><button type="button" onClick={() => copyValue('CBU/CVU', order.instrucciones.cbuCvu)} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-full border border-[#AF71DD] px-4 font-poppins text-xs font-semibold text-[#7A42A7] hover:bg-[#AF71DD]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#466729]"><Copy aria-hidden="true" size={14} />Copiar CBU/CVU</button></div>}
              <p className="mt-4 font-poppins text-sm text-black/70"><strong>Importe exacto:</strong> {order.instrucciones.importe}</p>
              <p className="mt-2 font-poppins text-sm text-black/70"><strong>Referencia:</strong> {order.instrucciones.referencia}</p>
              {order.instrucciones.instrucciones && <p className="mt-3 font-poppins text-sm leading-6 text-black/65">{order.instrucciones.instrucciones}</p>}
              <p className="mt-4 rounded-lg bg-[#FFF8E9] p-3 font-poppins text-sm leading-6 text-[#69428A]">La reserva de stock dura 24 horas desde la creación del pedido. La pantalla no confirma el pago: el equipo verificará la acreditación y actualizará el estado.</p>
            </section>}

            {copied && <p role="status" aria-live="polite" className="mt-3 flex items-center gap-2 font-poppins text-xs text-[#466729]">{copied.endsWith('copiado.') && <Check aria-hidden="true" size={15} />}{copied}</p>}
            <p className="mt-5 font-poppins text-xs leading-5 text-black/55">El correo automático con estas instrucciones todavía no está integrado. No enviamos comprobantes ni confirmaciones desde esta página.</p>
          </>}

          <a href="/tienda" className="mt-7 inline-flex min-h-11 items-center justify-center rounded-full bg-[#AF71DD] px-6 font-poppins text-sm font-semibold text-white transition-colors hover:bg-[#995bc1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#466729]">Volver a la tienda</a>
        </section>
      </main>
    </StoreLayout>
  )
}

export default TransferInstructionsPage
