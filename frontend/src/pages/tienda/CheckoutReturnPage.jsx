import StoreLayout from '../../components/layout/StoreLayout'

const states = {
  '/checkout/exito': {
    title: 'Recibimos tu regreso de Mercado Pago',
    message: 'La redirección no confirma la acreditación. El estado del pago sigue pendiente de verificación segura por el backend.',
  },
  '/checkout/pendiente': {
    title: 'El pago está pendiente de verificación',
    message: 'Esta página no puede verificar el estado de una operación. El estado del pago solo podrá confirmarse mediante una consulta segura del backend.',
  },
  '/checkout/error': {
    title: 'No se pudo completar el recorrido de pago',
    message: 'No podemos confirmar el resultado desde esta página. No se modificó el estado del pago; contactá a Olla Vegana para revisar la operación.',
  },
}

function CheckoutReturnPage({ pathname }) {
  const content = states[pathname] || states['/checkout/pendiente']
  return (
    <StoreLayout>
      <main className="w-full flex-1 px-4 py-12 sm:px-8 sm:py-16">
        <section className="mx-auto max-w-[680px] rounded-[18px] border border-[#AF71DD]/35 bg-white p-6 text-center sm:p-10">
          <p className="font-poppins text-sm font-semibold uppercase tracking-wide text-[#69428A]">Estado no verificado</p>
          <h1 className="mt-3 font-poppins text-2xl font-semibold text-[#466729] sm:text-3xl">{content.title}</h1>
          <p role="status" className="mx-auto mt-4 max-w-[540px] font-poppins text-sm leading-6 text-black/70">{content.message}</p>
          <a href="/tienda" className="mt-7 inline-flex min-h-11 items-center justify-center rounded-full bg-[#AF71DD] px-6 font-poppins text-sm font-semibold text-white transition-colors hover:bg-[#995bc1]">Volver a la tienda</a>
        </section>
      </main>
    </StoreLayout>
  )
}

export default CheckoutReturnPage
