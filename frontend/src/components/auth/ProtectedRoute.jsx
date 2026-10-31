import { useEffect } from 'react'
import { getAdminAuth } from '../../services/auth'

function ProtectedRoute({ children }) {
  const authenticated = Boolean(getAdminAuth())

  useEffect(() => {
    if (!authenticated) window.location.replace('/login')
  }, [authenticated])

  if (!authenticated) return null
  return children
}

export default ProtectedRoute
