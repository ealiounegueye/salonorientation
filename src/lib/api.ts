import { supabase } from './supabase'
import type { ResultatEnvoi, ResultatInscription } from '../types'

export type FormulaireInscription = {
  prenom: string
  nom: string
  email: string
  telephone: string
  profil: string
  dates: string
  age: string
  sexe: string
  website: string
}

type ReponseInscrire = {
  ok?: boolean
  message?: string
  code?: string
  dejaInscrit?: boolean
  emailEnvoye?: boolean
}

export async function inscrire(formulaire: FormulaireInscription): Promise<ResultatInscription> {
  const { data, error } = await supabase.functions.invoke('inscrire', { body: formulaire })
  const reponse = data as ReponseInscrire | null

  if (reponse?.ok && reponse.dejaInscrit) {
    return {
      ok: true,
      dejaInscrit: true,
      emailEnvoye: Boolean(reponse.emailEnvoye),
      message: reponse.message || 'Si cette adresse est déjà inscrite, le badge a été renvoyé par e-mail.',
    }
  }

  if (reponse?.ok && reponse.code) {
    return {
      ok: true,
      dejaInscrit: false,
      code: reponse.code,
      emailEnvoye: Boolean(reponse.emailEnvoye),
      emailMessage: reponse.emailEnvoye ? undefined : reponse.message,
    }
  }

  if (reponse?.message) return { ok: false, message: reponse.message }
  if (error) return { ok: false, message: 'L’inscription n’a pas pu être enregistrée. Réessayez dans un instant.' }
  return { ok: false, message: 'L’inscription n’a pas pu être enregistrée. Réessayez dans un instant.' }
}

export async function gererEquipe(
  corps:
    | { action: 'creer'; nom: string; email: string; password: string }
    | { action: 'modifier'; id: string; nom: string; email: string }
    | { action: 'reinitialiser'; id: string; password: string }
    | { action: 'retirer'; id: string },
): Promise<{ ok: boolean; message: string }> {
  const { data, error } = await supabase.functions.invoke('equipe', { body: corps })
  const reponse = data as { ok?: boolean; message?: string } | null
  if (reponse?.message) return { ok: Boolean(reponse.ok), message: reponse.message }
  if (error) return { ok: false, message: 'Le réglage n’a pas abouti.' }
  return { ok: false, message: 'Le réglage n’a pas abouti.' }
}

export async function renvoyerBadge(id: string): Promise<ResultatEnvoi> {
  const { data, error } = await supabase.functions.invoke('renvoyer-badge', { body: { id } })
  if (error || !data) {
    return { ok: false, message: 'Le renvoi n’a pas abouti.' }
  }
  return data as ResultatEnvoi
}
