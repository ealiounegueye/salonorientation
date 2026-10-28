import { clientService, sessionEstAdmin } from '../_shared/admin.ts'
import { envoyerBadge, type Participant } from '../_shared/badge.ts'
import { json, preflight } from '../_shared/http.ts'

type Corps = {
  prenom?: string
  nom?: string
  email?: string
  telephone?: string
  profil?: string
  dates?: string
  age?: number | string
  sexe?: string
  website?: string
}

type ReponseSql = {
  ok?: boolean
  message?: string
  code?: string
  id?: string
  deja_inscrit?: boolean
}

const FENETRE_MS = 10 * 60 * 1000
const PLAFOND_PUBLIC = 30
const PLAFOND_ADMIN = 120
const RENVOI_MS = 15 * 60 * 1000
const MESSAGE_DEJA =
  'Si cette adresse est déjà inscrite, le badge a été renvoyé par e-mail.'

function texte(valeur: unknown, max: number) {
  return String(valeur ?? '').trim().slice(0, max)
}

function ipClient(req: Request) {
  const hops = (req.headers.get('x-forwarded-for') ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter((part) => /^[0-9a-fA-F:.]+$/.test(part) && part.length <= 64)
  return hops[0] ?? 'inconnue'
}

async function tropDeTentatives(ip: string, plafond: number) {
  const admin = clientService()
  const depuis = new Date(Date.now() - FENETRE_MS).toISOString()
  const hier = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const insertion = await admin.from('inscription_tentatives').insert({ ip })
  if (insertion.error) {
    console.error(insertion.error)
    return { bloque: true, message: 'L’inscription n’a pas pu être enregistrée.' }
  }
  await admin.from('inscription_tentatives').delete().lt('created_at', hier)
  const { count, error } = await admin
    .from('inscription_tentatives')
    .select('id', { count: 'exact', head: true })
    .eq('ip', ip)
    .gte('created_at', depuis)
  if (error) {
    console.error(error)
    return { bloque: true, message: 'L’inscription n’a pas pu être enregistrée.' }
  }
  if ((count ?? 0) > plafond) {
    return { bloque: true, message: 'Trop de tentatives. Réessayez dans quelques minutes.' }
  }
  return { bloque: false, message: '' }
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

  const adminConnecte = await sessionEstAdmin(req)
  const limite = await tropDeTentatives(ipClient(req), adminConnecte ? PLAFOND_ADMIN : PLAFOND_PUBLIC)
  if (limite.bloque) return json({ ok: false, message: limite.message })

  const email = texte(corps.email, 160).toLowerCase()
  const ageBrut = typeof corps.age === 'number' ? corps.age : Number.parseInt(String(corps.age ?? ''), 10)
  const age = Number.isFinite(ageBrut) ? ageBrut : null
  const admin = clientService()
  const { data, error } = await admin.rpc('inscrire', {
    p_prenom: texte(corps.prenom, 80),
    p_nom: texte(corps.nom, 80),
    p_email: email,
    p_telephone: texte(corps.telephone, 30),
    p_website: texte(corps.website, 200),
    p_profil: texte(corps.profil, 40),
    p_dates: texte(corps.dates, 20),
    p_age: age,
    p_sexe: texte(corps.sexe, 1),
    p_admin: adminConnecte,
  })

  if (error || !data) {
    console.error(error)
    return json({ ok: false, message: 'L’inscription n’a pas pu être enregistrée.' }, 500)
  }

  const reponse = data as ReponseSql
  if (!reponse.ok) {
    return json({ ok: false, message: reponse.message ?? 'L’inscription n’a pas pu être enregistrée.' })
  }

  if (!reponse.id) {
    return json({ ok: false, message: 'L’inscription n’a pas pu être enregistrée.' }, 500)
  }
  const { data: ligne } = await admin.from('participants').select('*').eq('id', reponse.id).maybeSingle()
  const participant = ligne as Participant | null
  if (!participant) {
    return json({ ok: false, message: 'L’inscription n’a pas pu être enregistrée.' }, 500)
  }

  const recent = Boolean(
    participant.email_envoye_at &&
      Date.now() - new Date(participant.email_envoye_at).getTime() < RENVOI_MS,
  )
  let emailEnvoye = recent
  let emailMessage = recent ? 'Le badge a déjà été envoyé par e-mail.' : ''
  if (!recent) {
    const envoi = await envoyerBadge(participant)
    emailEnvoye = envoi.emailEnvoye
    emailMessage = envoi.emailEnvoye ? 'Badge envoyé.' : (envoi.emailErreur ?? 'Envoi impossible.')
    if (envoi.emailEnvoye) {
      await admin.from('participants').update({ email_envoye_at: new Date().toISOString() }).eq('id', participant.id)
    }
  }

  if (reponse.deja_inscrit) {
    const message = emailEnvoye
      ? (recent ? 'Si cette adresse est déjà inscrite, le badge a déjà été envoyé par e-mail.' : MESSAGE_DEJA)
      : 'Si cette adresse est déjà inscrite, le renvoi du badge n’a pas abouti. Réessayez dans un moment.'
    return json({ ok: true, dejaInscrit: true, emailEnvoye, message })
  }

  return json({
    ok: true,
    code: participant.code,
    dejaInscrit: false,
    emailEnvoye,
    message: emailMessage,
  })
})
