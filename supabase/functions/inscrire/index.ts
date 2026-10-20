import { codeAleatoire, envoyerBadge, type Participant } from '../_shared/badge.ts'
import { clientService } from '../_shared/admin.ts'
import { json, preflight } from '../_shared/http.ts'

type Corps = {
  prenom?: string
  nom?: string
  email?: string
  telephone?: string
  organisation?: string
  fonction?: string
  website?: string
}

function texte(valeur: unknown, max: number) {
  return String(valeur ?? '').trim().slice(0, max)
}

function emailValide(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 160
}

Deno.serve(async (req) => {
  const refuse = preflight(req)
  if (refuse) return refuse

  let corps: Corps
  try {
    corps = await req.json()
  } catch {
    return json({ ok: false, message: 'Formulaire illisible.' }, 400)
  }

  if (texte(corps.website, 200)) {
    return json({ ok: false, message: 'Inscription impossible.' }, 400)
  }

  const prenom = texte(corps.prenom, 80)
  const nom = texte(corps.nom, 80)
  const email = texte(corps.email, 160).toLowerCase()
  const telephone = texte(corps.telephone, 30) || null
  const organisation = texte(corps.organisation, 120) || null
  const fonction = texte(corps.fonction, 120) || null

  if (prenom.length < 2 || nom.length < 2) {
    return json({ ok: false, message: 'Indiquez votre prénom et votre nom.' })
  }
  if (!emailValide(email)) {
    return json({ ok: false, message: 'Indiquez une adresse e-mail valide.' })
  }

  const admin = clientService()
  const { data: campagne, error: erreurCampagne } = await admin.from('campagne').select('ouverte').eq('id', 1).maybeSingle()
  if (erreurCampagne) {
    console.error(erreurCampagne)
    return json({ ok: false, message: 'L’inscription n’a pas pu être enregistrée.' }, 500)
  }
  const { data: existant } = await admin
    .from('participants')
    .select('*')
    .eq('email', email)
    .maybeSingle()

  if (existant?.statut === 'annule') {
    return json({ ok: false, message: 'Cette inscription a été annulée. Contactez l’organisation.' })
  }

  let participant = existant as Participant | null
  let dejaInscrit = Boolean(participant)

  if (!participant) {
    if (!campagne?.ouverte) {
      return json({ ok: false, message: 'Les inscriptions sont fermées.' })
    }

    const ligne = { prenom, nom, email, telephone, organisation, fonction, statut: 'inscrit' }
    for (let essai = 0; essai < 5; essai += 1) {
      const { data, error } = await admin
        .from('participants')
        .insert({ ...ligne, code: codeAleatoire() })
        .select('*')
        .single()
      if (!error && data) {
        participant = data as Participant
        break
      }
      if (error?.code === '23505') {
        const { data: course } = await admin.from('participants').select('*').eq('email', email).maybeSingle()
        if (course) {
          participant = course as Participant
          dejaInscrit = true
          break
        }
        continue
      }
      console.error(error)
      return json({ ok: false, message: 'L’inscription n’a pas pu être enregistrée.' }, 500)
    }
  }

  if (!participant) {
    return json({ ok: false, message: 'L’inscription n’a pas pu être enregistrée.' }, 500)
  }

  const envoi = await envoyerBadge(participant)
  if (envoi.emailEnvoye) {
    await admin.from('participants').update({ email_envoye_at: new Date().toISOString() }).eq('id', participant.id)
  }

  return json({
    ok: true,
    code: participant.code,
    dejaInscrit,
    emailEnvoye: envoi.emailEnvoye,
    message: envoi.emailEnvoye ? 'Badge envoyé.' : (envoi.emailErreur ?? 'Envoi impossible.'),
  })
})
