import { exigerAdmin } from '../_shared/admin.ts'
import { envoyerBadge, type Participant } from '../_shared/badge.ts'
import { json, preflight } from '../_shared/http.ts'

Deno.serve(async (req) => {
  const refuse = preflight(req)
  if (refuse) return refuse

  const acces = await exigerAdmin(req)
  if ('erreur' in acces && acces.erreur) return acces.erreur
  const admin = acces.admin
  if (!admin) return json({ ok: false, message: 'Accès refusé.' }, 403)

  let id = ''
  try {
    const corps = await req.json()
    id = String(corps?.id ?? '')
  } catch {
    return json({ ok: false, message: 'Demande illisible.' }, 400)
  }

  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return json({ ok: false, message: 'Participant introuvable.' }, 404)
  }

  const { data } = await admin.from('participants').select('*').eq('id', id).maybeSingle()
  const participant = data as Participant | null
  if (!participant) return json({ ok: false, message: 'Participant introuvable.' }, 404)
  if (participant.statut === 'annule') {
    return json({ ok: false, message: 'Cette inscription est annulée.' })
  }

  const envoi = await envoyerBadge(participant)
  if (envoi.emailEnvoye) {
    await admin.from('participants').update({ email_envoye_at: new Date().toISOString() }).eq('id', participant.id)
  }

  return json({
    ok: envoi.emailEnvoye,
    emailEnvoye: envoi.emailEnvoye,
    message: envoi.emailEnvoye ? 'Badge renvoyé.' : (envoi.emailErreur ?? 'Envoi impossible.'),
  })
})
