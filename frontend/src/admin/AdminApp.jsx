import { useEffect, useState } from 'react'
import AdminLayout from './components/AdminLayout'
import AdminDashboard from './pages/AdminDashboard'
import AdminOrdersPage from './pages/AdminOrdersPage'
import AdminProductsPage from './pages/AdminProductsPage'
import AdminCatalogPage from './pages/AdminCatalogPage'
import AdminInventoryPage from './pages/AdminInventoryPage'
import AdminBannersPage from './pages/AdminBannersPage'
import AdminPickupPage from './pages/AdminPickupPage'
import AdminSettingsPage from './pages/AdminSettingsPage'
import { adminNavigation } from './data/mockAdminData'
import { getAdminSnapshot, saveMockProducts, updateMockOrder } from './services/adminService'

function AdminApp() {
  const initialPage = window.location.pathname.replace(/\/$/, '').split('/')[2] || 'resumen'
  const [activePage, setActivePage] = useState(adminNavigation.some(({ id }) => id === initialPage) ? initialPage : 'resumen')
  const [snapshot, setSnapshot] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    getAdminSnapshot()
      .then((data) => { if (active) setSnapshot(data) })
      .catch(() => { if (active) setError('No pudimos cargar los datos de demostración. Recargá la página para intentar otra vez.') })
    const handlePopState = () => {
      const page = window.location.pathname.replace(/\/$/, '').split('/')[2] || 'resumen'
      setActivePage(adminNavigation.some(({ id }) => id === page) ? page : 'resumen')
    }
    window.addEventListener('popstate', handlePopState)
    return () => {
      active = false
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  const navigate = (page) => {
    setActivePage(page)
    window.history.pushState({}, '', page === 'resumen' ? '/admin' : `/admin/${page}`)
  }

  const updateOrder = async (orderId, updates) => {
    const updated = await updateMockOrder(orderId, updates)
    setSnapshot((current) => ({ ...current, orders: current.orders.map((order) => order.id === orderId ? updated : order) }))
    return updated
  }

  const updateProducts = async (products) => {
    const saved = await saveMockProducts(products)
    setSnapshot((current) => ({ ...current, products: saved }))
    return saved
  }

  return (
    <AdminLayout activePage={activePage} onNavigate={navigate}>
      {error ? <section role="alert" className="rounded-2xl border border-red-200 bg-white p-8 font-poppins text-sm text-red-800">{error}</section>
        : !snapshot ? <div role="status" aria-live="polite" className="rounded-2xl border border-black/[.06] bg-white p-8 font-poppins text-sm text-black/55">Cargando datos de demostración…</div>
          : activePage === 'resumen' ? <AdminDashboard snapshot={snapshot} onNavigate={navigate} />
            : activePage === 'pedidos' ? <AdminOrdersPage orders={snapshot.orders} onUpdateOrder={updateOrder} />
              : activePage === 'productos' ? <AdminProductsPage products={snapshot.products} onSaveProducts={updateProducts} />
                : activePage === 'catalogo' ? <AdminCatalogPage />
                  : activePage === 'inventario' ? <AdminInventoryPage products={snapshot.products} onSaveProducts={updateProducts} />
                    : activePage === 'banners' ? <AdminBannersPage />
                      : activePage === 'retiros' ? <AdminPickupPage orders={snapshot.orders} />
                        : activePage === 'configuracion' ? <AdminSettingsPage /> : null}
    </AdminLayout>
  )
}

export default AdminApp
