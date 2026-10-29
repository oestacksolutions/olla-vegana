import { useEffect } from 'react'
import Navbar from './components/layout/Navbar'
import Hero from './components/home/Hero'
import MissionVision from './components/home/MissionVision'
import Donaciones from './components/home/Donaciones'
import Store from './components/home/Store'
import MapSection from './components/home/MapSection'
import Campaigns from './components/home/Campaigns'
import Footer from './components/layout/Footer'
import Nosotros from './pages/nosotros'
import DonationPage from './pages/DonationPage'
import HomeTienda from './pages/tienda/HomeTienda'
import ProductDetailPage from './pages/tienda/ProductDetailPage'
import AllProductsPage from './pages/tienda/AllProductsPage'
import CheckoutPage from './pages/tienda/CheckoutPage'
import OrderStatusPage from './pages/tienda/OrderStatusPage'
import OrderTrackingPage from './pages/tienda/OrderTrackingPage'
import AdminApp from './admin/AdminApp'
import LoginPage from './pages/LoginPage'
import ProtectedRoute from './components/auth/ProtectedRoute'
import ResetPasswordPage from './pages/ResetPasswordPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import { extractStoreProductSlug } from './utils/storeRoutes'

function App() {
  useEffect(() => {
    const targetId = window.location.hash.slice(1)
    if (!targetId) return

    const frame = window.requestAnimationFrame(() => {
      document.getElementById(decodeURIComponent(targetId))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [])

  if (window.location.pathname.replace(/\/$/, '') === '/nosotros') {
    return <Nosotros />
  }

  if (window.location.pathname.replace(/\/$/, '') === '/donacion') {
    return <DonationPage />
  }

  const pathname = window.location.pathname.replace(/\/$/, '')

  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return <ProtectedRoute><AdminApp /></ProtectedRoute>
  }

  if (pathname === '/login') {
    return <LoginPage />
  }

  if (pathname === '/forgot-password') {
    return <ForgotPasswordPage />
  }

  if (pathname === '/reset-password') {
    return <ResetPasswordPage />
  }

  if (pathname === '/tienda') {
    return <HomeTienda />
  }

  if (pathname === '/tienda/productos') {
    return <AllProductsPage />
  }

  if (pathname === '/tienda/checkout') {
    return <CheckoutPage />
  }

  if (pathname === '/tienda/seguimiento') {
    return <OrderTrackingPage />
  }

  const orderMatch = pathname.match(/^\/tienda\/pedido\/([^/]+)$/)
  if (orderMatch) {
    return <OrderStatusPage orderId={decodeURIComponent(orderMatch[1])} />
  }

  const productSlug = extractStoreProductSlug(pathname)
  if (productSlug) {
    return <ProductDetailPage productId={productSlug} />
  }

  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Campaigns />
        <MapSection />
        <Donaciones />
        <Store />
        <MissionVision introOnly />
      </main>
      <Footer />
    </>
  )
}

export default App
