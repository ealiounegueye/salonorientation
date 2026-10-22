import { evenement } from '../lib/evenement'

export function InfosLieu({ className = '' }: { className?: string }) {
  return (
    <p className={`text-center text-[11px] leading-tight text-muted ${className}`}>
      <span className="block">{evenement.lieu}</span>
      <span className="mt-1 block">
        {evenement.dates}
        <span className="mx-1 text-red" aria-hidden="true">
          ·
        </span>
        {evenement.horaires}
      </span>
    </p>
  )
}
