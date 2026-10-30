import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { estBackoffice, estStaff } from '../lib/permissions'

/** Réservé admin / super admin (pas hôtesse). */
export function ProtectedBackoffice({ children }: { children: ReactNode }) {
  const { loading, session, profile } = useAuth()

  if (loading) {
    return <p className="p-6 text-center text-muted">Chargement…</p>
  }
  if (!session || !profile || !estStaff(profile.role)) {
    return <Navigate to="/admin/connexion" replace />
  }
  if (!estBackoffice(profile.role)) {
    return <Navigate to="/admin/participants" replace />
  }
  return children
}
