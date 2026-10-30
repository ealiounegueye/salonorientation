/** Jour du mois (ex. « 19 ») à Dakar, s’il fait partie des jours du salon. */
export function jourSalonDakar(joursSalon: readonly string[]): string | null {
  const brut = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Dakar',
    day: 'numeric',
  }).format(new Date())
  const jour = String(Number.parseInt(brut, 10))
  if (!Number.isFinite(Number(jour))) return null
  return joursSalon.includes(jour) ? jour : null
}

export function normaliserJoursPresents(valeur: string[] | null | undefined): string[] {
  if (!valeur?.length) return []
  const uniques = [...new Set(valeur.map((j) => j.trim()).filter(Boolean))]
  return uniques.sort((a, b) => Number(a) - Number(b))
}

export function joursPresentsApresScan(actuels: string[] | null | undefined, jour: string): string[] {
  const base = normaliserJoursPresents(actuels)
  if (base.includes(jour)) return base
  return normaliserJoursPresents([...base, jour])
}

export function joursPourStatsPresence(participant: { statut: string; jours_presents?: string[] | null }): string[] {
  if (participant.statut !== 'present') return []
  return normaliserJoursPresents(participant.jours_presents)
}
