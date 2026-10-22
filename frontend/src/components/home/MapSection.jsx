import { useEffect } from 'react'
import { divIcon } from 'leaflet'
import { MapContainer, Marker, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import mapPinIcon from '../../assets/brand/herosvg/map-icon.png'
import ollaFlorIcon from '../../assets/brand/svgMagui/olla-flor-titulo.png'
import mapsIcon from '../../assets/brand/herosvg/maps.svg'
import mapsTwoIcon from '../../assets/brand/herosvg/maps2.svg'
import { distributionPoints } from '../../data/distributionPoints'

const markerImages = {
  moreno: ollaFlorIcon,
  moron: ollaFlorIcon,
  'ramos-mejia': ollaFlorIcon,
}

const markerImageSize = 120
const mapCenter = [-34.645, -58.68]

function createMarkerIcon(image) {
  return divIcon({
    className: 'custom-map-marker',
    html: `
      <span class="map-location-pin" style="width: ${markerImageSize}px; height: ${markerImageSize}px;">
        <img class="map-location-art" src="${image}" alt="" style="left: 0; top: 0; width: ${markerImageSize}px; height: ${markerImageSize}px;" />
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
  return (
    <section id="puntos" className="relative overflow-hidden bg-[#FFF8E9] px-6 py-16 text-center sm:px-10 lg:min-h-[500px] lg:px-0 lg:py-0 lg:text-left">
      <img
        src={mapsIcon}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 right-0 z-0 hidden h-auto w-[726px] lg:block"


      />
      <img
        src={mapsTwoIcon}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 z-0 hidden h-auto w-[667px] translate-y-10 lg:block"
 />

      <div className="relative z-10 mx-auto flex min-h-[500px] w-full max-w-[1200px] flex-col items-center lg:block">
        <div className="flex w-full flex-col items-center pt-1 lg:absolute lg:left-0 lg:top-[150.76px] lg:block lg:w-auto lg:p-0">
          <h2 className="order-1 mt-0 max-w-[329px] font-scripter text-[42px] font-normal leading-[1.05] text-black/80 sm:text-[52px] lg:text-[60px]">
            DÓNDE NOS
            <br />
            ENCONTRAMOS
          </h2>
          <p className="order-2 mt-4 max-w-[320px] font-sans text-base leading-[1.25] text-black/80 lg:mt-1">
            Puntos estratégicos de alta densidad poblacional y vulnerabilidad social.
          </p>
          <p className="order-3 mt-8 font-scripter text-[28px] leading-[30px] text-[#F13107] lg:absolute lg:left-[409px] lg:top-[-45px] lg:mt-0 lg:whitespace-nowrap">
            Huellas en zona oeste
          </p>

          <div className="order-4 mt-8 flex h-[192.28px] w-full max-w-[377px] flex-col justify-between gap-[10px] lg:absolute lg:left-[409px] lg:top-0 lg:mt-0">
            {distributionPoints.map((point) => (
              <div key={point.id} className="flex min-h-0 flex-1 items-center gap-[10px]">
                <img src={mapPinIcon} alt="" aria-hidden="true" className="h-[42px] w-6 shrink-0 object-contain" />
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${point.coordinates[0]},${point.coordinates[1]}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-full min-w-0 flex-1 items-center justify-center rounded-full bg-[#E87C55] px-3 text-center font-sans text-[15px] font-bold leading-[1.15] text-white transition-transform hover:scale-[1.02] sm:px-5"
                >
                  {point.city.toUpperCase()} - {point.address.toUpperCase()} ({point.schedule.toUpperCase()})
                </a>
              </div>
            ))}
          </div>
        </div>

        <div className="mx-auto order-5 mt-12 aspect-[453/307] w-full max-w-[453px] overflow-hidden rounded-[14px] shadow-sm lg:absolute lg:right-0 lg:top-[120px] lg:mx-0 lg:mt-0 lg:aspect-[453/307] lg:h-auto lg:w-[clamp(300px,30vw,400px)]">
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
      icon={createMarkerIcon(markerImages[point.id])}
      eventHandlers={{ click: focusMarker }}
    >
      <Tooltip direction="top" offset={[0, -34]}>{point.city}</Tooltip>
      <Popup>
        <strong>{point.address}</strong>
        <br />
        {point.city}
        <br />
        {point.schedule}
      </Popup>
    </Marker>
  )
}

export default MapSection








