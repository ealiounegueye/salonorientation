import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { evenement } from '../lib/evenement'

export function AppFooter() {
  const navigate = useNavigate()
  const appuis = useRef(0)
  const repos = useRef<number | null>(null)

  function toucher() {
    appuis.current += 1
    if (repos.current) window.clearTimeout(repos.current)
    repos.current = window.setTimeout(() => {
      appuis.current = 0
    }, 2500)
    if (appuis.current < 5) return
    appuis.current = 0
    navigate('/admin/connexion')
  }

  return (
    <footer className="mt-auto flex h-9 items-center justify-between gap-3 bg-red px-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-white sm:px-6">
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate">{evenement.organisation}</span>
        <button
          type="button"
          onClick={toucher}
          aria-label="Accès"
          className="grid size-6 shrink-0 place-items-center"
        >
          <span className="size-1.5 rounded-full bg-black" />
        </button>
      </span>
      <span className="truncate">{evenement.titre}</span>
    </footer>
  )
}
