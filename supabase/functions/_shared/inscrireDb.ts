import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0'

export type ChampsInscription = {
  prenom: string
  nom: string
  email: string
  telephone: string
  website: string
  profil: string
  datesBrut: string
  age: number
  sexe: string
  admin: boolean
}

const PROFILS = new Set(['professionnel', 'etudiant', 'chercheur', 'visiteur'])

function codeBadge() {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000
  return `SDM-${String(n).padStart(6, '0')}`
}

function datesValides(brut: string, autorises: string[]) {
  const choisis = brut
    .replace(/[^0-9,]/g, '')
    .split(',')
    .map((j) => j.trim())
    .filter((j) => j && autorises.includes(j))
  const ordre = autorises.filter((j) => choisis.includes(j))
  return ordre.length > 0 ? ordre.join(',') : null
}

export async function inscrireParticipant(
  admin: SupabaseClient,
  champs: ChampsInscription,
): Promise<{ ok: true; id: string; code: string } | { ok: false; message: string }> {
  if (champs.website) return { ok: false, message: 'Inscription impossible.' }

  const prenom = champs.prenom.trim()
  const nom = champs.nom.trim()
  const email = champs.email.trim().toLowerCase()
  const telephone = champs.telephone.replace(/\D/g, '')
  const profil = champs.profil.trim().toLowerCase()
  const sexe = champs.sexe.trim().toLowerCase().slice(0, 1)

  if (prenom.length < 2 || nom.length < 2) {
    return { ok: false, message: 'Indiquez votre prénom et votre nom.' }
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, message: 'Indiquez une adresse e-mail valide.' }
  }
  if (!/^\d{8,15}$/.test(telephone)) {
    return { ok: false, message: 'Indiquez un numéro de téléphone.' }
  }
  if (champs.age < 16 || champs.age > 110) {
    return { ok: false, message: 'Indiquez votre âge.' }
  }
  if (sexe !== 'h' && sexe !== 'f') {
    return { ok: false, message: 'Indiquez votre sexe.' }
  }
  if (!PROFILS.has(profil)) {
    return { ok: false, message: 'Choisissez votre profil.' }
  }

  const { data: campagne, error: errCampagne } = await admin
    .from('campagne')
    .select('ouverte, jours')
    .eq('id', 1)
    .maybeSingle()
  if (errCampagne) {
    console.error(errCampagne)
    return { ok: false, message: 'L’inscription n’a pas pu être enregistrée.' }
  }

  const joursAutorises = (campagne?.jours ?? '18,19,20')
    .split(',')
    .map((j) => j.trim())
    .filter(Boolean)
  const dates = datesValides(champs.datesBrut, joursAutorises)
  if (!dates) return { ok: false, message: 'Choisissez au moins une date.' }

  const { data: parEmail } = await admin.from('participants').select('statut').ilike('email', email).maybeSingle()
  if (parEmail) {
    if (parEmail.statut === 'annule') {
      return { ok: false, message: 'Cette inscription a été annulée. Contactez l’organisation.' }
    }
    return { ok: false, message: 'Cette adresse e-mail est déjà utilisée.' }
  }

  const { data: parTel } = await admin
    .from('participants')
    .select('id')
    .eq('telephone', telephone)
    .neq('statut', 'annule')
    .maybeSingle()
  if (parTel) {
    return { ok: false, message: 'Ce numéro de téléphone est déjà utilisé.' }
  }

  if (!campagne?.ouverte && !champs.admin) {
    return { ok: false, message: 'Les inscriptions sont fermées.' }
  }

  const ligne = {
    prenom: prenom.slice(0, 80),
    nom: nom.slice(0, 80),
    email: email.slice(0, 160),
    telephone,
    profil,
    dates,
    age: champs.age,
    sexe,
    statut: 'inscrit' as const,
  }

  for (let essai = 0; essai < 5; essai += 1) {
    const { data, error } = await admin
      .from('participants')
      .insert({ ...ligne, code: codeBadge() })
      .select('id, code')
      .single()

    if (!error && data) {
      return { ok: true, id: data.id as string, code: data.code as string }
    }

    if (error?.code === '23505') {
      const { data: doublonEmail } = await admin.from('participants').select('statut').ilike('email', email).maybeSingle()
      if (doublonEmail?.statut === 'annule') {
        return { ok: false, message: 'Cette inscription a été annulée. Contactez l’organisation.' }
      }
      if (doublonEmail) {
        return { ok: false, message: 'Cette adresse e-mail est déjà utilisée.' }
      }
      const { data: doublonTel } = await admin
        .from('participants')
        .select('id')
        .eq('telephone', telephone)
        .neq('statut', 'annule')
        .maybeSingle()
      if (doublonTel) {
        return { ok: false, message: 'Ce numéro de téléphone est déjà utilisé.' }
      }
    }
    const msg = `${error?.message ?? ''} ${error?.details ?? ''}`.toLowerCase()
    if (msg.includes('age') || msg.includes('sexe') || msg.includes('column')) {
      return {
        ok: false,
        message:
          'Colonnes manquantes en base : exécutez supabase/hotfix-prod.sql dans Supabase (SQL Editor), puis réessayez.',
      }
    }
    console.error('insert participant', error)
  }

  return { ok: false, message: 'L’inscription n’a pas pu être enregistrée.' }
}
