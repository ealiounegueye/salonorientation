import type { ProfilParticipant, StatutParticipant } from '../types'

export const JOURS = ['18', '19', '20'] as const

export const PROFILS: { valeur: ProfilParticipant; libelle: string }[] = [
  { valeur: 'professionnel', libelle: 'Professionnel' },
  { valeur: 'etudiant', libelle: 'Étudiant' },
  { valeur: 'chercheur', libelle: 'Chercheur d’emploi' },
  { valeur: 'visiteur', libelle: 'Visiteur' },
]

export function libelleProfil(profil: string | null | undefined) {
  return PROFILS.find((entree) => entree.valeur === profil)?.libelle ?? ''
}

export function libelleDates(dates: string | null | undefined, tousLesJours: readonly string[] = JOURS) {
  if (!dates) return ''
  const jours = dates.split(',').map((jour) => jour.trim()).filter(Boolean)
  if (tousLesJours.length > 0 && tousLesJours.every((jour) => jours.includes(jour))) return 'Toutes les dates'
  return jours.join(', ')
}

const dateur = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Africa/Dakar',
})

export function formatQuand(iso: string | null) {
  if (!iso) return '—'
  return dateur.format(new Date(iso))
}

export function nomComplet(personne: { prenom: string; nom: string }) {
  return `${personne.prenom} ${personne.nom}`
}

export function extraireCode(valeur: string) {
  const match = valeur.toUpperCase().match(/SDM-\d{6}|SLN-[A-Z0-9]{6}/)
  return match?.[0] ?? null
}

export const LIBELLE_STATUT: Record<StatutParticipant, string> = {
  inscrit: 'Inscrit',
  present: 'Présent',
  annule: 'Annulé',
}

export function filtreRecherche(saisie: string) {
  const safe = saisie.trim().replace(/[%_,]/g, '')
  if (safe.length < 1) return null
  return [
    `nom.ilike.%${safe}%`,
    `prenom.ilike.%${safe}%`,
    `email.ilike.%${safe}%`,
    `code.ilike.%${safe}%`,
    `organisation.ilike.%${safe}%`,
    `telephone.ilike.%${safe}%`,
  ].join(',')
}

