import { evenement } from '../lib/evenement'

export function InfosLieu({ className = '' }: { className?: string }) {
  return (
    <div className={`text-center text-xs leading-relaxed text-muted ${className}`}>
      <p>{evenement.lieu}</p>
      <p>{evenement.dates}</p>
      <p>{evenement.horaires}</p>
    </div>
  )
}
