import { evenement } from '../lib/evenement'

export function AppFooter() {
  return (
    <footer className="mt-auto flex h-9 items-center justify-between gap-3 bg-red px-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-white sm:px-6">
      <span className="truncate">{evenement.organisation}</span>
      <span className="truncate">{evenement.titre}</span>
    </footer>
  )
}
