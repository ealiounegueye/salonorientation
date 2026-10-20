import type { Participant, StatutParticipant } from '../types'

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

export function exporterCsv(lignes: Participant[]) {
  const entete = ['Code', 'Prénom', 'Nom', 'E-mail', 'Téléphone', 'Organisation', 'Fonction', 'Statut', 'Inscrit le']
  const corps = lignes.map((ligne) =>
    [
      ligne.code,
      ligne.prenom,
      ligne.nom,
      ligne.email,
      ligne.telephone ?? '',
      ligne.organisation ?? '',
      ligne.fonction ?? '',
      LIBELLE_STATUT[ligne.statut],
      formatQuand(ligne.created_at),
    ]
      .map((valeur) => `"${String(valeur).replaceAll('"', '""')}"`)
      .join(';'),
  )
  const blob = new Blob([`\uFEFF${[entete.join(';'), ...corps].join('\n')}`], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const lien = document.createElement('a')
  lien.href = url
  lien.download = 'participants-salon.csv'
  lien.click()
  URL.revokeObjectURL(url)
}
