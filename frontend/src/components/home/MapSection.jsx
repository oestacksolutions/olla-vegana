import { useEffect } from 'react'
import { useRef, useState } from 'react'
import { divIcon } from 'leaflet'
import { MapContainer, Marker, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import cloudIcon from '../../assets/brand/herosvg/nube.svg'
import pinIcon from '../../assets/brand/herosvg/pin.svg'
import caraIcon from '../../assets/brand/svgMagui/cara.png'
import BtnAction from '../disenio/btn-action'
import { distributionPoints } from '../../data/distributionPoints'

const markerImageSize = 40
const markerLabels = {
  moreno: 'Moreno',
  moron: 'Mor\u00f3n',
  'ramos-mejia': 'Ramos Mejia',
}
const mapCenter = [-34.645, -58.68]
const orderedPointIds = ['moreno', 'moron', 'ramos-mejia']

function createMarkerIcon(label) {
  return divIcon({
    className: 'custom-map-marker',
    html: `
      <span class="map-location-marker">
        <span class="map-location-label">${label}</span>
        <span class="map-location-pin" style="width: ${markerImageSize}px; height: ${markerImageSize}px;">
          <img class="map-location-art" src="${caraIcon}" alt="" />
        </span>
      </span>
    `,
    iconSize: [markerImageSize, markerImageSize],
    iconAnchor: [markerImageSize / 2, markerImageSize / 2],
  })
}

function FitDistributionPoints() {
  const map = useMap()

  useEffect(() => {
    map.fitBounds(
      distributionPoints.map((point) => point.coordinates),
      { padding: [64, 64], maxZoom: 11 },
    )
  }, [map])

  return null
}

function MapSection() {
  const sectionRef = useRef(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return

    if (!('IntersectionObserver' in window)) {
      setIsVisible(true)
      return
    }

    const observer = new IntersectionObserver(([entry]) => {
      setIsVisible(entry.isIntersecting)
    }, { threshold: 0.1 })

    observer.observe(section)
    return () => observer.disconnect()
  }, [])

  return (
    <section
      ref={sectionRef}
      id="puntos"
      className={`store-appearance ${isVisible ? 'is-visible' : ''} relative overflow-hidden bg-[#FFF8E9] px-6 py-12 sm:px-10 lg:min-h-[400px] lg:px-0 lg:py-0`}
    >
      <div className="relative z-10 mx-auto flex w-full max-w-[900px] flex-col gap-8 lg:grid lg:min-h-[400px] lg:grid-cols-[500px_360px] lg:gap-[40px]">
        <div className="relative flex w-full flex-col items-center lg:items-start">
          <div className="relative h-[145px] w-full shrink-0">
            <img
              src={cloudIcon}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-[-8px] h-[138px] w-[420px] -translate-x-1/2 lg:left-[-8px] lg:translate-x-0"
            />

            <h2 className="absolute left-1/2 top-[61px] z-10 w-[420px] -translate-x-1/2 -translate-y-1/2 text-center font-scripter text-[36px] font-normal leading-none text-white lg:left-[-8px] lg:translate-x-0">
              ¿DÓNDE ESTAMOS?
            </h2>
          </div>

          <div className="relative z-10 w-full text-center font-scripter text-[22px] leading-[1.15] text-[#F13107] lg:w-[390px] lg:text-left">
            estamos presentes en tres puntos de Zona Oeste:
          </div>

          <div className="relative z-10 mt-[16px] flex w-full max-w-[400px] flex-col gap-[14px]">
          {orderedPointIds.map((pointId) => {
            const point = distributionPoints.find(({ id }) => id === pointId)
            if (!point) return null

            const buttonText = {
              moreno: <>MORENO - Plaza Mariano Moreno<br />(Viernes 20 a 21hs)</>,
              moron: <>MORÓN - Plaza La Roche<br />(Jueves 20 a 21hs)</>,
              'ramos-mejia': <>RAMOS MEJIA - Plaza Sarmiento<br />(Martes 20 a 21hs)</>,
            }[point.id]

            return (
              <div key={point.id} className="flex min-h-[40px] items-center gap-[14px]">
                <a
                  href={point.mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Abrir ubicación de ${point.city} en Google Maps`}
                  className="shrink-0"
                >
                  <img src={pinIcon} alt="" aria-hidden="true" className="h-[24px] w-[24px] object-contain" />
                </a>
                <BtnAction
                  href={point.mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  fluid
                  fontSize="12px"
                  className="min-h-[40px] min-w-0 flex-1 justify-center overflow-hidden px-[12px] text-center text-[11px] font-semibold leading-[15px] lg:h-[40px] lg:text-[12px] lg:leading-[18px]"
                >
                  {buttonText}
                </BtnAction>
              </div>
            )
          })}
          </div>
        </div>

        <div className="relative order-4 mt-8 aspect-[360/254] w-full max-w-[360px] self-start overflow-hidden rounded-[10px] shadow-sm lg:mt-[50px] lg:mx-0 lg:h-[310px] lg:w-[450px]">
          <MapContainer
            center={mapCenter}
            zoom={12}
            scrollWheelZoom={true}
            className="h-full w-full"
          >
            <FitDistributionPoints />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {distributionPoints.map((point) => (
              <DistributionMarker key={point.id} point={point} />
            ))}
          </MapContainer>
        </div>
      </div>
    </section>
  )
}

function DistributionMarker({ point }) {
  const map = useMap()
  const focusMarker = () => map.flyTo(point.coordinates, 16, { duration: 0.8 })

  return (
    <Marker
      position={point.coordinates}
      icon={createMarkerIcon(markerLabels[point.id])}
      eventHandlers={{ click: focusMarker }}
    >
      <Tooltip direction="top" offset={[0, -34]}>{point.city}</Tooltip>
      <Popup>
        <strong>{point.address}</strong>
        <br />
        {point.city}
        <br />
        {point.schedule}
        <br />
        <a href={point.mapsUrl} target="_blank" rel="noreferrer">Abrir en Google Maps</a>
      </Popup>
    </Marker>
  )
}

export default MapSection
