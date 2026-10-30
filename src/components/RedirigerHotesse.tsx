import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { estHotesse } from '../lib/permissions'

/** Empêche une hôtesse d’ouvrir tableau de bord, réglages ou mon compte (URL directe ou ancien cache). */
export function RedirigerHotesse() {
  const { loading, profile } = useAuth()
  const { pathname } = useLocation()

  if (loading || !profile || !estHotesse(profile.role)) return null

  const pageBackoffice =
    pathname === '/admin' || pathname === '/admin/reglages' || pathname === '/admin/compte'

  if (!pageBackoffice) return null

  return <Navigate to="/admin/participants" replace />
}
