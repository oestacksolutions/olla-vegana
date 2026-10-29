import { useState } from 'react'
import Footer from '../components/layout/Footer'
import Navbar from '../components/layout/Navbar'
import { resetAdminPassword } from '../services/auth'

function ResetPasswordPage() {
  const token = new URLSearchParams(window.location.search).get('token') || ''
  const [contrasena, setContrasena] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')
    if (contrasena !== confirmacion) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setIsSubmitting(true)
    try {
      const result = await resetAdminPassword(token, contrasena)
      setMessage(result.message)
    } catch (resetError) {
      setError(resetError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#FFF8E9]">
      <Navbar />
      <main className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6 lg:py-20">
        <section className="w-full max-w-md rounded-3xl border border-[#AF71DD]/20 bg-white p-6 shadow-lg sm:p-10" aria-labelledby="reset-title">
          <h1 id="reset-title" className="font-scripter text-4xl font-normal text-[#466729]">Nueva contraseña</h1>
          <p className="mt-3 font-poppins text-sm leading-6 text-black/60">Elegí una contraseña nueva para tu acceso administrativo.</p>
          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 font-poppins text-sm text-red-800">{error}</p>}
            {message && <p role="status" className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 font-poppins text-sm text-green-800">{message} <a href="/login" className="font-semibold underline">Volver al login</a></p>}
            <label className="block font-poppins text-sm font-medium text-[#292621]">
              Contraseña nueva
              <input type="password" autoComplete="new-password" minLength="12" required value={contrasena} onChange={(event) => setContrasena(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-[#466729]/25 bg-[#FFF8E9]/50 px-4 text-[#292621] outline-none transition focus:border-[#AF71DD] focus:ring-2 focus:ring-[#AF71DD]/20" />
            </label>
            <label className="block font-poppins text-sm font-medium text-[#292621]">
              Repetir contraseña
              <input type="password" autoComplete="new-password" minLength="12" required value={confirmacion} onChange={(event) => setConfirmacion(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-[#466729]/25 bg-[#FFF8E9]/50 px-4 text-[#292621] outline-none transition focus:border-[#AF71DD] focus:ring-2 focus:ring-[#AF71DD]/20" />
            </label>
            <button type="submit" disabled={isSubmitting || !token || Boolean(message)} className="h-12 w-full rounded-xl bg-[#466729] font-poppins text-sm font-semibold text-white transition hover:bg-[#38531f] disabled:cursor-not-allowed disabled:opacity-60">
              {isSubmitting ? 'Guardando…' : 'Guardar contraseña'}
            </button>
          </form>
        </section>
      </main>
      <Footer />
    </div>
  )
}

export default ResetPasswordPage
