import { exigerAdmin } from '../_shared/admin.ts'
import { json, preflight } from '../_shared/http.ts'

type Corps = {
  action?: string
  nom?: string
  email?: string
  password?: string
  id?: string
}

function texte(valeur: unknown, max: number) {
  return String(valeur ?? '').trim().slice(0, max)
}

Deno.serve(async (req) => {
  const refuse = preflight(req)
  if (refuse) return refuse

  const acces = await exigerAdmin(req)
  if ('erreur' in acces && acces.erreur) return acces.erreur
  const admin = acces.admin
  if (!admin || !('userId' in acces)) return json({ ok: false, message: 'Accès refusé.' }, 403)

  let corps: Corps
  try {
    corps = await req.json()
  } catch {
    return json({ ok: false, message: 'Demande illisible.' }, 400)
  }

  if (corps.action === 'creer') {
    const nom = texte(corps.nom, 80)
    const email = texte(corps.email, 160).toLowerCase()
    const password = String(corps.password ?? '')
    if (nom.length < 2) return json({ ok: false, message: 'Indiquez le nom de la personne.' })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ ok: false, message: 'Indiquez un e-mail valide.' })
    if (password.length < 8) return json({ ok: false, message: 'Le mot de passe doit contenir au moins 8 caractères.' })

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nom },
    })
    if (error || !data.user) {
      const detail = error?.message ?? ''
      const deja = /already|exists|registered/i.test(detail)
      return json({ ok: false, message: deja ? 'Cet e-mail est déjà utilisé.' : 'Le compte n’a pas pu être créé.' })
    }

    await admin.from('profiles').upsert({
      id: data.user.id,
      nom,
      email,
      role: 'admin',
    })
    return json({ ok: true, message: `${nom} peut se connecter.` })
  }

  if (corps.action === 'retirer') {
    const id = texte(corps.id, 40)
    if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ ok: false, message: 'Compte introuvable.' })
    if (id === acces.userId) return json({ ok: false, message: 'Vous ne pouvez pas retirer votre propre compte.' })
    const { error } = await admin.auth.admin.deleteUser(id)
    if (error) return json({ ok: false, message: 'Le compte n’a pas pu être retiré.' })
    return json({ ok: true, message: 'Compte retiré.' })
  }

  return json({ ok: false, message: 'Action inconnue.' }, 400)
})
