import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { estHotesse, estStaff, estSuperAdmin } from '../lib/permissions'

export function ProtectedSuperAdmin({ children }: { children: ReactNode }) {
  const { loading, session, profile } = useAuth()

  if (loading) {
    return <p className="p-6 text-center text-muted">Chargement…</p>
  }
  if (!session || !profile || !estStaff(profile.role)) {
    return <Navigate to="/admin/connexion" replace />
  }
  if (estHotesse(profile.role)) {
    return <Navigate to="/admin/participants" replace />
  }
  if (!estSuperAdmin(profile.role)) {
    return <Navigate to="/admin/compte" replace />
  }
  return children
}
