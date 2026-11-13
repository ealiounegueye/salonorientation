export type EtatListeParticipants = {
  page: number
  filtre: string
  jour: string
  profil: string
  recherche: string
}

const STORAGE_KEY = 'salon.admin.participants.liste'

export function sauverEtatListeParticipants(etat: EtatListeParticipants) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(etat))
  } catch {
  }
}

export function lireEtatListeParticipants(): EtatListeParticipants | null {
  try {
    const brut = sessionStorage.getItem(STORAGE_KEY)
    if (!brut) return null
    const data = JSON.parse(brut) as EtatListeParticipants
    if (typeof data.page !== 'number') return null
    return data
  } catch {
    return null
  }
}

/** Priorité à l’URL si elle contient des paramètres, sinon dernière liste en session. */
export function etatDepartListeParticipants(paramsBrut: string): EtatListeParticipants {
  const depuisUrl = parseParticipantsListeSearch(paramsBrut)
  if (paramsBrut.trim()) return depuisUrl
  return lireEtatListeParticipants() ?? depuisUrl
}

const FILTRES_LISTE = new Set(['tous', 'inscrit', 'present', 'sur_place'])

export function participantsListeSearch(etat: EtatListeParticipants): string {
  const params = new URLSearchParams()
  if (etat.page > 0) params.set('p', String(etat.page + 1))
  if (etat.filtre !== 'tous' && FILTRES_LISTE.has(etat.filtre)) params.set('f', etat.filtre)
  if (etat.jour !== 'toutes') params.set('j', etat.jour)
  if (etat.profil !== 'tous') params.set('pr', etat.profil)
  const q = etat.recherche.trim()
  if (q) params.set('q', q)
  const texte = params.toString()
  return texte ? `?${texte}` : ''
}

export function parseParticipantsListeSearch(raw: string): EtatListeParticipants {
  const params = new URLSearchParams(raw.startsWith('?') ? raw.slice(1) : raw)
  const pageBrute = Number.parseInt(params.get('p') ?? '1', 10)
  const page = Number.isFinite(pageBrute) && pageBrute > 1 ? pageBrute - 1 : 0
  const filtreBrut = params.get('f') ?? 'tous'
  const filtre = FILTRES_LISTE.has(filtreBrut) ? filtreBrut : 'tous'
  return {
    page: Math.max(0, page),
    filtre,
    jour: params.get('j') ?? 'toutes',
    profil: params.get('pr') ?? 'tous',
    recherche: params.get('q') ?? '',
  }
}
