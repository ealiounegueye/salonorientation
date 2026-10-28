import type { Participant } from '../types'
import { JOURS, PROFILS, SEXES } from './format'

const dateurJour = new Intl.DateTimeFormat('fr-CA', {
  timeZone: 'Africa/Dakar',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function jourDakar(iso: string) {
  return dateurJour.format(new Date(iso))
}

export function estAujourdDhakar(iso: string) {
  return jourDakar(iso) === jourDakar(new Date().toISOString())
}

export const COULEURS_AUCHAN = ['#e0001a', '#00985f', '#1a1a1a'] as const

export const TRANCHES_AGE = [
  { id: 'moins-20', libelle: 'moins de 20 ans', couleur: COULEURS_AUCHAN[0] },
  { id: '20-35', libelle: '20 à 35 ans', couleur: COULEURS_AUCHAN[1] },
  { id: '36-plus', libelle: '36 ans et plus', couleur: COULEURS_AUCHAN[2] },
] as const

export function trancheAge(age: number | null | undefined) {
  if (typeof age !== 'number' || age < 16) return null
  if (age < 20) return 'moins-20'
  if (age <= 35) return '20-35'
  return '36-plus'
}

export type StatsSalon = {
  total: number
  inscrits: number
  presents: number
  annules: number
  actifs: number
  tauxPresence: number
  inscriptionsAujourdhui: number
  ageMoyen: number | null
  parProfil: { valeur: string; libelle: string; count: number }[]
  parSexe: { valeur: string; libelle: string; count: number }[]
  parDate: { jour: string; libelle: string; couleur: string; count: number }[]
  selectionsDate: number
  parAge: { id: (typeof TRANCHES_AGE)[number]['id']; libelle: string; couleur: string; count: number }[]
  agesRenseignes: number
}

export function calculerStats(participants: Participant[], jours: readonly string[] = JOURS): StatsSalon {
  const actifs = participants.filter((p) => p.statut !== 'annule')
  const inscrits = actifs.filter((p) => p.statut === 'inscrit').length
  const presents = actifs.filter((p) => p.statut === 'present').length
  const annules = participants.filter((p) => p.statut === 'annule').length
  const pointables = inscrits + presents
  const tauxPresence = pointables > 0 ? Math.round((presents / pointables) * 100) : 0
  const inscriptionsAujourdhui = actifs.filter((p) => estAujourdDhakar(p.created_at)).length

  const ages = actifs.map((p) => p.age).filter((a): a is number => typeof a === 'number' && a > 0)
  const ageMoyen = ages.length > 0 ? Math.round(ages.reduce((s, a) => s + a, 0) / ages.length) : null

  const parProfil = PROFILS.map((entree) => ({
    valeur: entree.valeur,
    libelle: entree.libelle,
    count: actifs.filter((p) => p.profil === entree.valeur).length,
  }))

  const parSexe = SEXES.map((entree) => ({
    valeur: entree.valeur,
    libelle: `${entree.code} — ${entree.libelle}`,
    count: actifs.filter((p) => p.sexe === entree.valeur).length,
  }))

  const couleursJour = COULEURS_AUCHAN
  let selectionsDate = 0
  const parDate = jours.map((jour, index) => {
    let count = 0
    for (const p of actifs) {
      const sel = p.dates?.split(',').map((d) => d.trim()) ?? []
      if (sel.includes(jour)) count += 1
    }
    selectionsDate += count
    return {
      jour,
      libelle: `${jour} novembre`,
      couleur: couleursJour[index % couleursJour.length],
      count,
    }
  })

  const compteurAge: Record<(typeof TRANCHES_AGE)[number]['id'], number> = {
    'moins-20': 0,
    '20-35': 0,
    '36-plus': 0,
  }
  let agesRenseignes = 0
  for (const p of actifs) {
    const tranche = trancheAge(p.age)
    if (!tranche) continue
    agesRenseignes += 1
    compteurAge[tranche] += 1
  }
  const parAge = TRANCHES_AGE.map((entree) => ({
    id: entree.id,
    libelle: entree.libelle,
    couleur: entree.couleur,
    count: compteurAge[entree.id],
  }))

  return {
    total: participants.length,
    inscrits,
    presents,
    annules,
    actifs: actifs.length,
    tauxPresence,
    inscriptionsAujourdhui,
    ageMoyen,
    parProfil,
    parSexe,
    parDate,
    selectionsDate,
    parAge,
    agesRenseignes,
  }
}
