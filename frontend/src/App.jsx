import Navbar from './components/layout/Navbar'
import Hero from './components/home/Hero'
import Timeline from './components/home/Timeline'
import MissionVision from './components/home/MissionVision'
import Store from './components/home/Store'
import MapSection from './components/home/MapSection'
import Campaigns from './components/home/Campaigns'
import Footer from './components/layout/Footer'

function App() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Timeline />
        <MissionVision />
        <Store />
        <MapSection />
        <Campaigns />
      </main>
      <Footer />
    </>
  )
}

export default App
