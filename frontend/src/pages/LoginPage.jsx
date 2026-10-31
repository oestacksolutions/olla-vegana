import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import Navbar from '../components/layout/Navbar'
import Footer from '../components/layout/Footer'
import { loginAdmin } from '../services/auth'

function LoginPage() {
  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const resetSuccess = new URLSearchParams(window.location.search).get('reset') === 'success'
  const sessionExpired = new URLSearchParams(window.location.search).get('expired') === '1'
  const accessDenied = new URLSearchParams(window.location.search).get('denied') === '1'

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (isSubmitting) return
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
          {resetSuccess && <p role="status" className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 font-poppins text-sm text-green-800">Tu contraseña fue actualizada. Ya podés iniciar sesión.</p>}
          {sessionExpired && <p role="status" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 font-poppins text-sm text-amber-900">Tu sesión venció. Iniciá sesión nuevamente.</p>}
          {accessDenied && <p role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 font-poppins text-sm text-red-800">Tu cuenta no tiene acceso al panel administrativo.</p>}
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 font-poppins text-sm text-red-800">{error}</p>}
            <label className="block font-poppins text-sm font-medium text-[#292621]">
              Correo electrónico
              <input type="email" autoComplete="username" required value={correo} onChange={(event) => setCorreo(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-[#466729]/25 bg-[#FFF8E9]/50 px-4 text-[#292621] outline-none transition focus:border-[#AF71DD] focus:ring-2 focus:ring-[#AF71DD]/20" />
            </label>
            <label className="block font-poppins text-sm font-medium text-[#292621]">
              Contraseña
              <span className="relative mt-2 block">
                <input type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={contrasena} onChange={(event) => setContrasena(event.target.value)} className="h-12 w-full rounded-xl border border-[#466729]/25 bg-[#FFF8E9]/50 px-4 pr-12 text-[#292621] outline-none transition focus:border-[#AF71DD] focus:ring-2 focus:ring-[#AF71DD]/20" />
                <button type="button" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-[#466729] hover:bg-[#466729]/5 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#AF71DD]">
                  {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                </button>
              </span>
            </label>
            <button type="submit" disabled={isSubmitting} className="h-12 w-full rounded-xl bg-[#466729] font-poppins text-sm font-semibold text-white transition hover:bg-[#38531f] disabled:cursor-not-allowed disabled:opacity-60">
              {isSubmitting ? 'Ingresando…' : 'Ingresar'}
            </button>
            <a href="/forgot-password" className="block w-full text-center font-poppins text-sm font-medium text-[#466729] underline-offset-4 hover:underline">¿Olvidaste tu contraseña?</a>
            <a href="/" className="block text-center font-poppins text-sm font-medium text-[#466729] underline-offset-4 hover:underline">Volver atrás</a>
          </form>
        </section>
      </main>
      <Footer />
    </div>
  )
}

export default LoginPage
