import { clientService, sessionEstAdmin } from '../_shared/admin.ts'
import { envoyerBadge, type Participant } from '../_shared/badge.ts'
import { json, preflight } from '../_shared/http.ts'
import { inscrireParticipant } from '../_shared/inscrireDb.ts'

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

const FENETRE_MS = 10 * 60 * 1000
const PLAFOND_PUBLIC = 30
const PLAFOND_ADMIN = 120
const RENVOI_MS = 15 * 60 * 1000
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
    console.error('inscription_tentatives', insertion.error)
    return { bloque: false, message: '' }
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
  const age = Number.isFinite(ageBrut) ? ageBrut : 0
  const admin = clientService()

  const resultat = await inscrireParticipant(admin, {
    prenom: texte(corps.prenom, 80),
    nom: texte(corps.nom, 80),
    email,
    telephone: texte(corps.telephone, 30),
    website: texte(corps.website, 200),
    profil: texte(corps.profil, 40),
    datesBrut: texte(corps.dates, 20),
    age,
    sexe: texte(corps.sexe, 1),
    admin: adminConnecte,
  })

  if (!resultat.ok) {
    return json({ ok: false, message: resultat.message })
  }

  const { data: ligne } = await admin.from('participants').select('*').eq('id', resultat.id).maybeSingle()
  const participant = ligne as Participant | null
  if (!participant) {
    return json({ ok: false, message: 'L’inscription n’a pas pu être enregistrée.' })
  }

  const recent = Boolean(
    participant.email_envoye_at &&
      Date.now() - new Date(participant.email_envoye_at).getTime() < RENVOI_MS,
  )
  const aEmail = Boolean(participant.email?.trim())
  let emailEnvoye = recent
  let emailMessage = recent ? 'Le badge a déjà été envoyé par e-mail.' : ''
  if (!aEmail) {
    emailEnvoye = false
    emailMessage = ''
  } else if (!recent) {
    try {
      const envoi = await envoyerBadge(participant)
      emailEnvoye = envoi.emailEnvoye
      emailMessage = envoi.emailEnvoye ? 'Badge envoyé.' : (envoi.emailErreur ?? 'Envoi impossible.')
      if (envoi.emailEnvoye) {
        await admin.from('participants').update({ email_envoye_at: new Date().toISOString() }).eq('id', participant.id)
      }
    } catch (erreurEnvoi) {
      console.error('envoyerBadge', erreurEnvoi)
      emailMessage =
        'Inscription enregistrée. L’e-mail n’a pas pu être envoyé pour le moment (domaine Resend ou clé API).'
    }
  }

  return json({
    ok: true,
    code: participant.code,
    dejaInscrit: false,
    emailEnvoye,
    message: emailMessage,
  })
})
