import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'
import { estStaff } from '../lib/permissions'

export function Protected({ children }: { children: ReactNode }) {
  const { loading, session, profile } = useAuth()

  if (loading) {
    return <div className="grid min-h-screen place-items-center text-muted">Chargement…</div>
  }

  if (!session || !profile || !estStaff(profile.role)) {
    return <Navigate to="/admin/connexion" replace />
  }

  return children
}
