export type Role = 'admin'
export type StatutParticipant = 'inscrit' | 'present' | 'annule'
export type ProfilParticipant = 'professionnel' | 'etudiant' | 'chercheur' | 'visiteur'

export type Profile = {
  id: string
  nom: string
  email: string
  role: Role
  created_at: string
}

export type Participant = {
  id: string
  code: string
  prenom: string
  nom: string
  email: string
  telephone: string | null
  organisation: string | null
  fonction: string | null
  profil: ProfilParticipant | null
  dates: string | null
  age: number | null
  statut: StatutParticipant
  email_envoye_at: string | null
  created_at: string
}

export type BadgePublic = {
  code: string
  prenom: string
  nom: string
  statut: StatutParticipant
}

export type ResultatInscription =
  | { ok: true; code: string; dejaInscrit: boolean; emailEnvoye: boolean; emailMessage?: string }
  | { ok: false; message: string }

export type ResultatEnvoi = {
  ok: boolean
  emailEnvoye?: boolean
  message: string
}
