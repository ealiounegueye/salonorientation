export type Role = 'admin'
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
  email: string
  telephone: string | null
  profil: ProfilParticipant | null
  dates: string | null
  age: number | null
  sexe: SexeParticipant | null
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
  | { ok: true; dejaInscrit: false; code: string; emailEnvoye: boolean; emailMessage?: string }
  | { ok: true; dejaInscrit: true; emailEnvoye: boolean; message: string }
  | { ok: false; message: string }

export type ResultatEnvoi = {
  ok: boolean
  emailEnvoye?: boolean
  message: string
}
