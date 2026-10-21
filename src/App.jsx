import { CartProvider } from './context/CartContext'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Timeline from './components/Timeline'
import MissionVision from './components/MissionVision'
import Store from './components/Store'
import CartModal from './components/CartModal'
import MapSection from './components/MapSection'
import Campaigns from './components/Campaigns'
import Footer from './components/Footer'

function App() {
  return (
    <CartProvider>
      <Navbar />
      <main>
        <Hero />
        <Timeline />
        <MissionVision />
        <Store />
        <CartModal />
        <MapSection />
        <Campaigns />
      </main>
      <Footer />
    </CartProvider>
  )
}

export default App
