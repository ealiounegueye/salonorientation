import { Link, useLocation } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { evenement } from '../lib/evenement'
import {
  accueilApresConnexion,
  estBackoffice,
  estHotesse,
  estSuperAdmin,
  libelleRole,
  peutVoirTableauDeBord,
} from '../lib/permissions'
import { LogoAuchan } from './LogoAuchan'

const lienClasse = (actif: boolean) =>
  actif
    ? 'shrink-0 whitespace-nowrap rounded-full bg-red px-3 py-2 text-xs font-semibold text-white sm:px-3.5 sm:text-sm'
    : 'shrink-0 whitespace-nowrap rounded-full border border-line px-3 py-2 text-xs font-semibold hover:border-red/40 sm:px-3.5 sm:text-sm'

export function AppHeader({ subtitle }: { subtitle: string }) {
  const { profile, signOut } = useAuth()
  const { pathname } = useLocation()
  const hotesse = estHotesse(profile?.role)
  const backoffice = estBackoffice(profile?.role)
  const superAdmin = estSuperAdmin(profile?.role)
  const accueil = profile ? accueilApresConnexion(profile.role) : '/admin/participants'
  const dashboardActif = pathname === '/admin'
  const listeActive = pathname === '/admin/participants' || pathname.startsWith('/admin/participants/')
  const reglagesActifs = pathname === '/admin/reglages'
  const compteActif = pathname === '/admin/compte'

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="flex flex-col gap-2 px-3 py-2 sm:gap-3 sm:px-6 sm:py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <Link to={accueil} className="shrink-0" aria-label={hotesse ? 'Participants' : 'Tableau de bord'}>
            <LogoAuchan className="h-8 max-w-[8.5rem] object-left sm:h-9 sm:max-w-none" />
          </Link>
          <div className="hidden h-8 w-px bg-line md:block" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-red sm:text-[11px] sm:tracking-[0.18em]">
              {evenement.titre}
            </p>
            <h1 className="truncate text-base font-semibold tracking-tight text-ink sm:text-xl">{subtitle}</h1>
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <nav
            className="bandeau-defilant flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2 lg:flex-none"
            aria-label="Navigation admin"
          >
            {peutVoirTableauDeBord(profile?.role) && (
              <Link to="/admin" className={lienClasse(dashboardActif)}>
                <span className="sm:hidden">Tableau</span>
                <span className="hidden sm:inline">Tableau de bord</span>
              </Link>
            )}
            <Link to="/admin/participants" className={lienClasse(listeActive)}>
              Participants
            </Link>
            {superAdmin ? (
              <Link to="/admin/reglages" className={lienClasse(reglagesActifs)}>
                Réglages
              </Link>
            ) : backoffice ? (
              <Link to="/admin/compte" className={lienClasse(compteActif)}>
                <span className="sm:hidden">Compte</span>
                <span className="hidden sm:inline">Mon compte</span>
              </Link>
            ) : null}
          </nav>

          <div className="hidden shrink-0 text-right lg:block">
            <p className="max-w-[10rem] truncate text-sm font-semibold">{profile?.nom}</p>
            <p className="text-xs text-muted">{profile ? libelleRole(profile.role) : ''}</p>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-paper px-2.5 py-2 text-xs font-semibold text-ink hover:border-red/40 sm:gap-2 sm:px-3 sm:text-sm"
            aria-label="Quitter"
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
