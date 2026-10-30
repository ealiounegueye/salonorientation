export type Role = 'super_admin' | 'admin' | 'hotesse'
export type StatutParticipant = 'inscrit' | 'present' | 'annule'
export type ProfilParticipant = 'professionnel' | 'etudiant' | 'chercheur' | 'visiteur'
export type SexeParticipant = 'h' | 'f'

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
  email: string | null
  telephone: string | null
  profil: ProfilParticipant | null
  dates: string | null
  age: number | null
  sexe: SexeParticipant | null
  statut: StatutParticipant
  jours_presents: string[]
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
  | { ok: true; code: string; emailEnvoye: boolean; emailMessage?: string; dejaInscrit?: false }
  | { ok: false; message: string }

export type ResultatEnvoi = {
  ok: boolean
  emailEnvoye?: boolean
  message: string
}
