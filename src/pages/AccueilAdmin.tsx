import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { estBackoffice, estHotesse, estStaff } from '../lib/permissions'
import { DashboardPage } from './DashboardPage'

/** Point d’entrée /admin : les hôtesses n’accèdent jamais au tableau de bord. */
export function AccueilAdmin() {
  const { loading, profile } = useAuth()

  if (loading) {
    return <div className="grid min-h-screen place-items-center text-muted">Chargement…</div>
  }
  if (!profile || !estStaff(profile.role)) {
    return <Navigate to="/admin/connexion" replace />
  }
  if (estHotesse(profile.role)) {
    return <Navigate to="/admin/participants" replace />
  }
  if (estBackoffice(profile.role)) {
    return <DashboardPage />
  }
  return <Navigate to="/admin/connexion" replace />
}
