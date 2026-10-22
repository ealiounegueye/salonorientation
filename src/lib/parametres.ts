import { evenement } from './evenement'
import { JOURS } from './format'
import { supabase } from './supabase'

export type ParametresSalon = {
  lieu: string
  horaires: string
  periode: string
  jours: string[]
  ouverte: boolean
}

export const parametresDefaut: ParametresSalon = {
  lieu: evenement.lieu,
  horaires: evenement.horaires,
  periode: 'novembre 2026',
  jours: [...JOURS],
  ouverte: true,
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
  cache = {
    lieu: String(brut.lieu || parametresDefaut.lieu),
    horaires: String(brut.horaires || parametresDefaut.horaires),
    periode: String(brut.periode || parametresDefaut.periode),
    jours: jours.length ? jours : parametresDefaut.jours,
    ouverte: Boolean(brut.ouverte),
  }
  return cache
}
