export const adminNavigation = [
  { id: 'resumen', label: 'Resumen general', icon: 'LayoutDashboard' },
  { id: 'pedidos', label: 'Pedidos y ventas', icon: 'ShoppingBag' },
  { id: 'productos', label: 'Productos', icon: 'Package' },
  { id: 'catalogo', label: 'Categorías y variantes', icon: 'Tags' },
  { id: 'inventario', label: 'Inventario', icon: 'Boxes' },
  { id: 'banners', label: 'Banners', icon: 'PanelsTopLeft' },
  { id: 'retiros', label: 'Puntos de retiro', icon: 'MapPin' },
  { id: 'configuracion', label: 'Configuración', icon: 'Settings' },
]

export const mockOrders = [
  { id: 'OV-20261027-A8K2', date: '2026-10-27T10:42:00', customer: 'Lucía Fernández', email: 'lucia@example.com', products: 'Remera Olla Vegana (M) × 1', quantity: 1, total: 18500, payment: 'Pendiente', status: 'Nuevo', pickup: 'Morón', notes: '', history: ['Pedido de muestra creado · 27 oct 2026, 10:42'] },
  { id: 'OV-20261026-C4M1', date: '2026-10-26T16:12:00', customer: 'Joaquín Pérez', email: 'joaquin@example.com', products: 'Tote Flores × 2', quantity: 2, total: 22000, payment: 'Pendiente', status: 'Nuevo', pickup: 'Moreno', notes: '', history: ['Pedido de muestra creado · 26 oct 2026, 16:12'] },
  { id: 'OV-20261025-F7B9', date: '2026-10-25T12:05:00', customer: 'Camila Torres', email: 'camila@example.com', products: 'Gorra Olla Vegana × 1', quantity: 1, total: 12000, payment: 'Pendiente', status: 'Nuevo', pickup: 'Ramos Mejía', notes: '', history: ['Pedido de muestra creado · 25 oct 2026, 12:05'] },
  { id: 'OV-20261022-D2P5', date: '2026-10-22T09:30:00', customer: 'Marina López', email: 'marina@example.com', products: 'Remera Olla Vegana (L) × 1', quantity: 1, total: 18500, payment: 'Pendiente', status: 'Nuevo', pickup: 'Morón', notes: '', history: ['Pedido de muestra creado · 22 oct 2026, 09:30'] },
]

export const mockProducts = [
  { id: 'remera-olla', name: 'Remera Olla Vegana', category: 'Remeras', price: 18500, stock: 12, status: 'Activo', featured: true, variants: 'Color · Talle' },
  { id: 'tote-flores', name: 'Tote Flores', category: 'Tote Bags', price: 11000, stock: 3, status: 'Activo', featured: false, variants: 'Estampado' },
  { id: 'gorra-olla', name: 'Gorra Olla Vegana', category: 'Gorras', price: 12000, stock: 0, status: 'Activo', featured: false, variants: 'Color · Modelo' },
  { id: 'tote-lisa', name: 'Tote Lisa', category: 'Tote Bags', price: 9500, stock: 7, status: 'Borrador', featured: false, variants: 'Color' },
]

export const mockSalesSeries = [35, 48, 40, 66, 56, 78, 62, 88, 72, 95, 80, 100]
