import { supabase } from './supabase'
import type { ResultatEnvoi, ResultatInscription } from '../types'

export type FormulaireInscription = {
  prenom: string
  nom: string
  email: string
  telephone: string
  organisation: string
  fonction: string
  website: string
}

type ReponseInscrire = {
  ok?: boolean
  message?: string
  code?: string
  deja_inscrit?: boolean
}

export async function inscrire(formulaire: FormulaireInscription): Promise<ResultatInscription> {
  const { data, error } = await supabase.rpc('inscrire', {
    p_prenom: formulaire.prenom,
    p_nom: formulaire.nom,
    p_email: formulaire.email,
    p_telephone: formulaire.telephone,
    p_organisation: formulaire.organisation,
    p_fonction: formulaire.fonction,
    p_website: formulaire.website,
  })

  if (error || !data) {
    return { ok: false, message: 'L’inscription n’a pas pu être enregistrée. Réessayez dans un instant.' }
  }

  const reponse = data as ReponseInscrire
  if (!reponse.ok || !reponse.code) {
    return { ok: false, message: reponse.message ?? 'L’inscription n’a pas pu être enregistrée.' }
  }

  let emailEnvoye = false
  let emailMessage = ''
  const envoi = await supabase.functions.invoke('inscrire', { body: formulaire })
  const corps = envoi.data as { emailEnvoye?: boolean; message?: string } | null
  if (!envoi.error && corps?.emailEnvoye) emailEnvoye = true
  if (!emailEnvoye && corps?.message) emailMessage = corps.message

  return {
    ok: true,
    code: reponse.code,
    dejaInscrit: Boolean(reponse.deja_inscrit),
    emailEnvoye,
    emailMessage,
  }
}

export async function renvoyerBadge(id: string): Promise<ResultatEnvoi> {
  const { data, error } = await supabase.functions.invoke('renvoyer-badge', { body: { id } })
  if (error || !data) {
    return { ok: false, message: 'Le renvoi n’a pas abouti.' }
  }
  return data as ResultatEnvoi
}
