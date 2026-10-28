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
  parDate: { jour: string; count: number }[]
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

  const parDate = jours.map((jour) => {
    let count = 0
    for (const p of actifs) {
      const sel = p.dates?.split(',').map((d) => d.trim()) ?? []
      if (sel.includes(jour)) count += 1
    }
    return { jour, count }
  })

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
  }
}
