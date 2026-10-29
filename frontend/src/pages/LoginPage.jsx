import { useState } from 'react'
import Navbar from '../components/layout/Navbar'
import Footer from '../components/layout/Footer'
import { loginAdmin, requestPasswordReset } from '../services/auth'

function LoginPage() {
  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRecoveryOpen, setIsRecoveryOpen] = useState(false)
  const [recoveryEmail, setRecoveryEmail] = useState('')
  const [recoveryMessage, setRecoveryMessage] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)
    try {
      await loginAdmin(correo.trim(), contrasena)
      window.location.assign('/admin')
    } catch (loginError) {
      setError(loginError.message)
    } finally {
      setIsSubmitting(false)
    }

  }

  const handleRecovery = async (event) => {
    event.preventDefault()
    setError('')
    setRecoveryMessage('')
    setIsSubmitting(true)
    try {
      const { message } = await requestPasswordReset(recoveryEmail.trim())
      setRecoveryMessage(message)
    } catch (recoveryError) {
      setError(recoveryError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#FFF8E9]">
      <Navbar />
      <main className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6 lg:py-20">
        <section className="w-full max-w-md rounded-3xl border border-[#AF71DD]/20 bg-white p-6 shadow-lg sm:p-10" aria-labelledby="login-title">
          <div className="mb-8 text-center">
            <p className="font-poppins text-sm font-medium uppercase tracking-[.18em] text-[#AF71DD]">Panel administrativo</p>
            <h1 id="login-title" className="mt-2 font-scripter text-4xl font-normal text-[#466729]">Iniciar sesión</h1>
            <p className="mt-3 font-poppins text-sm text-black/60">Ingresá para administrar la tienda de Olla Vegana.</p>
          </div>
          {!isRecoveryOpen ? <form onSubmit={handleSubmit} className="space-y-5">
            {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 font-poppins text-sm text-red-800">{error}</p>}
            <label className="block font-poppins text-sm font-medium text-[#292621]">
              Correo electrónico
              <input type="email" autoComplete="username" required value={correo} onChange={(event) => setCorreo(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-[#466729]/25 bg-[#FFF8E9]/50 px-4 text-[#292621] outline-none transition focus:border-[#AF71DD] focus:ring-2 focus:ring-[#AF71DD]/20" />
            </label>
            <label className="block font-poppins text-sm font-medium text-[#292621]">
              Contraseña
              <input type="password" autoComplete="current-password" required value={contrasena} onChange={(event) => setContrasena(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-[#466729]/25 bg-[#FFF8E9]/50 px-4 text-[#292621] outline-none transition focus:border-[#AF71DD] focus:ring-2 focus:ring-[#AF71DD]/20" />
            </label>
            <button type="submit" disabled={isSubmitting} className="h-12 w-full rounded-xl bg-[#466729] font-poppins text-sm font-semibold text-white transition hover:bg-[#38531f] disabled:cursor-not-allowed disabled:opacity-60">
              {isSubmitting ? 'Ingresando…' : 'Ingresar'}
            </button>
            <button type="button" onClick={() => { setIsRecoveryOpen(true); setError('') }} className="block w-full text-center font-poppins text-sm font-medium text-[#466729] underline-offset-4 hover:underline">¿Olvidaste tu correo y contraseña?</button>
            <a href="/" className="block text-center font-poppins text-sm font-medium text-[#466729] underline-offset-4 hover:underline">Volver atrás</a>
          </form> : (
            <form onSubmit={handleRecovery} className="space-y-5">
              <p className="font-poppins text-sm leading-6 text-black/65">Ingresá el correo del administrador. Si está registrado, recibirás un enlace para crear una contraseña nueva.</p>
              {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 font-poppins text-sm text-red-800">{error}</p>}
              {recoveryMessage && <p role="status" className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 font-poppins text-sm text-green-800">{recoveryMessage}</p>}
              <label className="block font-poppins text-sm font-medium text-[#292621]">
                Correo electrónico
                <input type="email" autoComplete="email" required value={recoveryEmail} onChange={(event) => setRecoveryEmail(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-[#466729]/25 bg-[#FFF8E9]/50 px-4 text-[#292621] outline-none transition focus:border-[#AF71DD] focus:ring-2 focus:ring-[#AF71DD]/20" />
              </label>
              <button type="submit" disabled={isSubmitting} className="h-12 w-full rounded-xl bg-[#466729] font-poppins text-sm font-semibold text-white transition hover:bg-[#38531f] disabled:cursor-not-allowed disabled:opacity-60">
                {isSubmitting ? 'Enviando…' : 'Enviar instrucciones'}
              </button>
              <button type="button" onClick={() => { setIsRecoveryOpen(false); setRecoveryMessage(''); setError('') }} className="block w-full text-center font-poppins text-sm font-medium text-[#466729] underline-offset-4 hover:underline">Volver al inicio de sesión</button>
            </form>
          )}
        </section>
      </main>
      <Footer />
    </div>
  )
}

export default LoginPage
