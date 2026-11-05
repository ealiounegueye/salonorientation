import { evenement } from './evenement'
import { JOURS } from './format'
import { supabase } from './supabase'

export type ParametresSalon = {
  lieu: string
  horaires: string
  periode: string
  jours: string[]
  ouverte: boolean
  /** Si true, tous les postes scannent pour `jourPointage`. */
  pointageForce: boolean
  jourPointage: string | null
}

export const parametresDefaut: ParametresSalon = {
  lieu: evenement.lieu,
  horaires: evenement.horaires,
  periode: 'novembre 2026',
  jours: [...JOURS],
  ouverte: true,
  pointageForce: false,
  jourPointage: null,
}

let cache: ParametresSalon | null = null

export function normaliserJours(valeur: string) {
  const vus = new Set<string>()
  const jours: string[] = []
  for (const morceau of valeur.split(/[^0-9]+/)) {
    if (!morceau || morceau.length > 2) continue
    const jour = String(Number(morceau))
    if (jour === '0' || vus.has(jour)) continue
    vus.add(jour)
    jours.push(jour)
  }
  return jours
}

export function apercuDates(parametres: Pick<ParametresSalon, 'jours' | 'periode'>) {
  return [parametres.jours.join(', '), parametres.periode].filter(Boolean).join(' ')
}

export async function lireParametres(forcer = false) {
  if (cache && !forcer) return cache
  const { data, error } = await supabase.rpc('parametres_publics')
  if (error || !data || typeof data !== 'object') return cache ?? parametresDefaut
  const brut = data as Record<string, unknown>
  const jours = normaliserJours(String(brut.jours ?? ''))
  const joursListe = jours.length ? jours : parametresDefaut.jours
  const pointageForce = Boolean(brut.pointage_force)
  const jourBrut = String(brut.jour_pointage ?? '').trim()
  const jourPointage =
    pointageForce && jourBrut && joursListe.includes(String(Number.parseInt(jourBrut, 10)))
      ? String(Number.parseInt(jourBrut, 10))
      : null
  cache = {
    lieu: String(brut.lieu || parametresDefaut.lieu),
    horaires: String(brut.horaires || parametresDefaut.horaires),
    periode: String(brut.periode || parametresDefaut.periode),
    jours: joursListe,
    ouverte: Boolean(brut.ouverte),
    pointageForce: pointageForce && Boolean(jourPointage),
    jourPointage,
  }
  return cache
}
