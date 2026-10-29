import { Link, useLocation } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { evenement } from '../lib/evenement'
import { estSuperAdmin, libelleRole } from '../lib/permissions'
import { LogoAuchan } from './LogoAuchan'

export function AppHeader({ subtitle }: { subtitle: string }) {
  const { profile, signOut } = useAuth()
  const { pathname } = useLocation()
  const dashboardActif = pathname === '/admin'
  const listeActive = pathname === '/admin/participants' || pathname.startsWith('/admin/participants/')
  const reglagesActifs = pathname === '/admin/reglages'
  const compteActif = pathname === '/admin/compte'
  const superAdmin = estSuperAdmin(profile?.role)

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
      <div className="flex items-center justify-between gap-2 px-3 py-2 sm:gap-4 sm:px-6 sm:py-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <Link to="/admin" className="shrink-0" aria-label="Tableau de bord">
            <LogoAuchan className="max-w-[9.5rem] object-left sm:h-9 sm:max-w-none" />
          </Link>
          <div className="hidden h-8 w-px bg-line sm:block" />
          <div className="min-w-0">
            <p className="hidden text-[11px] font-semibold uppercase tracking-[0.18em] text-red sm:block">
              {evenement.titre}
            </p>
            <h1 className="truncate text-base font-semibold tracking-tight text-ink sm:text-xl">{subtitle}</h1>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <nav className="flex items-center gap-1.5 text-xs font-medium sm:gap-2 sm:text-sm">
            <Link
              to="/admin"
              className={
                dashboardActif
                  ? 'rounded-full bg-red px-2.5 py-1.5 text-white sm:px-3'
                  : 'rounded-full border border-line px-2.5 py-1.5 hover:border-red/40 sm:px-3'
              }
            >
              Tableau de bord
            </Link>
            <Link
              to="/admin/participants"
              className={
                listeActive
                  ? 'rounded-full bg-red px-2.5 py-1.5 text-white sm:px-3'
                  : 'rounded-full border border-line px-2.5 py-1.5 hover:border-red/40 sm:px-3'
              }
            >
              Participants
            </Link>
            {superAdmin ? (
              <Link
                to="/admin/reglages"
                className={
                  reglagesActifs
                    ? 'rounded-full bg-red px-2.5 py-1.5 text-white sm:px-3'
                    : 'rounded-full border border-line px-2.5 py-1.5 hover:border-red/40 sm:px-3'
                }
              >
                Réglages
              </Link>
            ) : (
              <Link
                to="/admin/compte"
                className={
                  compteActif
                    ? 'rounded-full bg-red px-2.5 py-1.5 text-white sm:px-3'
                    : 'rounded-full border border-line px-2.5 py-1.5 hover:border-red/40 sm:px-3'
                }
              >
                Mon compte
              </Link>
            )}
          </nav>
          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold">{profile?.nom}</p>
            <p className="text-xs text-muted">{profile ? libelleRole(profile.role) : ''}</p>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="inline-flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-2 text-sm font-medium text-ink hover:border-red/40"
          >
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Quitter</span>
          </button>
        </div>
      </div>
      <div className="flex h-1">
        <div className="w-2/3 bg-red" />
        <div className="w-1/3 bg-green" />
      </div>
    </header>
  )
}
