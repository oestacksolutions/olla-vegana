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

  if (window.location.pathname.replace(/\/$/, '') === '/tienda') {
    return <HomeTienda />
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
