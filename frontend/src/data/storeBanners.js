import storeHeroImage from '../assets/jpg/remera-frente.jpg'

export const STORE_BANNERS_STORAGE_KEY = 'olla-vegana-store-banners'
export const STORE_BANNERS_UPDATED_EVENT = 'olla-vegana:store-banners-updated'

export const defaultStoreBanners = [{
  id: 'banner-principal',
  title: '',
  subtitle: '',
  buttonText: '',
  href: '/tienda',
  desktop: storeHeroImage,
  mobile: storeHeroImage,
  active: true,
  position: 'Centro',
  desktopFocusX: 50,
  desktopFocusY: 50,
  desktopZoom: 120,
  mobileFocusX: 50,
  mobileFocusY: 50,
  mobileZoom: 120,
  start: '',
  end: '',
}]

export function getStoreBanners() {
  try {
    const saved = window.localStorage.getItem(STORE_BANNERS_STORAGE_KEY)
    if (saved === null) {
      const previousAdminBanners = JSON.parse(window.localStorage.getItem('olla-vegana-admin-banners') || 'null')
      if (Array.isArray(previousAdminBanners)) {
        window.localStorage.setItem(STORE_BANNERS_STORAGE_KEY, JSON.stringify(previousAdminBanners))
        return previousAdminBanners
      }
    }
    const banners = JSON.parse(saved || 'null')
    return Array.isArray(banners) ? banners : defaultStoreBanners
  } catch {
    return defaultStoreBanners
  }
}

function getLocalDate() {
  const date = new Date()
  const localOffset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - localOffset).toISOString().slice(0, 10)
}

export function getVisibleStoreBanners() {
  const today = getLocalDate()
  return getStoreBanners().filter((banner) =>
    banner.active && (!banner.start || banner.start <= today) && (!banner.end || banner.end >= today)
  )
}

export function getVisibleStoreBanner() {
  return getVisibleStoreBanners()[0] || null
}

export function saveStoreBanners(banners) {
  window.localStorage.setItem(STORE_BANNERS_STORAGE_KEY, JSON.stringify(banners))
  window.dispatchEvent(new Event(STORE_BANNERS_UPDATED_EVENT))
  return banners
}
