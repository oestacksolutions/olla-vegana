import { useState } from 'react'
import Footer from '../components/layout/Footer'
import Navbar from '../components/layout/Navbar'
import { requestPasswordReset } from '../services/auth'

function ForgotPasswordPage() {
  const [correo, setCorreo] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')
    setIsSubmitting(true)
    try {
      const result = await requestPasswordReset(correo.trim())
      setMessage(result.message)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#FFF8E9]">
      <Navbar />
      <main className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6 lg:py-20">
        <section className="w-full max-w-md rounded-3xl border border-[#AF71DD]/20 bg-white p-6 shadow-lg sm:p-10" aria-labelledby="forgot-title">
          <p className="font-poppins text-sm font-medium uppercase tracking-[.18em] text-[#AF71DD]">Panel administrativo</p>
          <h1 id="forgot-title" className="mt-2 font-scripter text-4xl font-normal text-[#466729]">Recuperar contraseña</h1>
          <p className="mt-3 font-poppins text-sm leading-6 text-black/60">Ingresá tu correo. Si está registrado, recibirás instrucciones para crear una contraseña nueva.</p>
          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 font-poppins text-sm text-red-800">{error}</p>}
            {message && <p role="status" className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 font-poppins text-sm text-green-800">{message}</p>}
            <label className="block font-poppins text-sm font-medium text-[#292621]">
              Correo electrónico
              <input type="email" autoComplete="email" required value={correo} onChange={(event) => setCorreo(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-[#466729]/25 bg-[#FFF8E9]/50 px-4 text-[#292621] outline-none transition focus:border-[#AF71DD] focus:ring-2 focus:ring-[#AF71DD]/20" />
            </label>
            <button type="submit" disabled={isSubmitting} className="h-12 w-full rounded-xl bg-[#466729] font-poppins text-sm font-semibold text-white transition hover:bg-[#38531f] disabled:cursor-not-allowed disabled:opacity-60">
              {isSubmitting ? 'Enviando…' : 'Enviar instrucciones'}
            </button>
            <a href="/login" className="block text-center font-poppins text-sm font-medium text-[#466729] underline-offset-4 hover:underline">Volver al inicio de sesión</a>
          </form>
        </section>
      </main>
      <Footer />
    </div>
  )
}

export default ForgotPasswordPage
