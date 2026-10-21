import { createContext, useContext, useMemo, useState } from 'react'

const CartContext = createContext(null)

export function CartProvider({ children }) {
  const [items, setItems] = useState([])

  const addItem = (product, variant) => {
    setItems((currentItems) => [...currentItems, { product, variant, quantity: 1 }])
  }

  const removeItem = (productId, variantId) => {
    setItems((currentItems) =>
      currentItems.filter(
        (item) => item.product.id !== productId || item.variant?.id !== variantId,
      ),
    )
  }

  const value = useMemo(
    () => ({
      items,
      itemCount: items.reduce((total, item) => total + item.quantity, 0),
      addItem,
      removeItem,
    }),
    [items],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const context = useContext(CartContext)

  if (!context) {
    throw new Error('useCart debe utilizarse dentro de CartProvider')
  }

  return context
}
