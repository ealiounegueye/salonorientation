import { useEffect, useState } from 'react'
import { apercuDates, lireParametres, parametresDefaut } from '../lib/parametres'

export function InfosLieu({ className = '' }: { className?: string }) {
  const [salon, setSalon] = useState(parametresDefaut)

  useEffect(() => {
    void lireParametres().then(setSalon)
  }, [])

  return (
    <p className={`text-center text-[11px] leading-tight text-muted ${className}`}>
      <span className="block">{salon.lieu}</span>
      <span className="mt-1 block">
        {apercuDates(salon)}
        <span className="mx-1 text-red" aria-hidden="true">
          ·
        </span>
        {salon.horaires}
      </span>
    </p>
  )
}
