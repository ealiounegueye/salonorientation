import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'

export function Protected({ children }: { children: ReactNode }) {
  const { loading, session, profile } = useAuth()

  if (loading) {
    return <div className="grid min-h-screen place-items-center text-muted">Chargement…</div>
  }

  if (!session || !profile || profile.role !== 'admin') {
    return <Navigate to="/admin/connexion" replace />
  }

  return children
}
