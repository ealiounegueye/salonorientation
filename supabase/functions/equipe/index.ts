import { exigerSuperAdmin } from '../_shared/admin.ts'
import { json, preflight } from '../_shared/http.ts'

type Corps = {
  action?: string
  nom?: string
  email?: string
  password?: string
  role?: string
  id?: string
}

function roleAutorise(valeur: unknown): 'admin' | 'super_admin' | 'hotesse' {
  const role = String(valeur ?? 'admin').trim()
  if (role === 'super_admin') return 'super_admin'
  if (role === 'hotesse') return 'hotesse'
  return 'admin'
}

function texte(valeur: unknown, max: number) {
  return String(valeur ?? '').trim().slice(0, max)
}

Deno.serve(async (req) => {
  const refuse = preflight(req)
  if (refuse) return refuse

  const acces = await exigerSuperAdmin(req)
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

    const role = roleAutorise(corps.role)
    await admin.from('profiles').upsert({
      id: data.user.id,
      nom,
      email,
      role,
    })
    return json({ ok: true, message: `${nom} peut se connecter.` })
  }

  if (corps.action === 'modifier') {
    const id = texte(corps.id, 40)
    const nom = texte(corps.nom, 80)
    const email = texte(corps.email, 160).toLowerCase()
    if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ ok: false, message: 'Compte introuvable.' })
    if (nom.length < 2) return json({ ok: false, message: 'Indiquez le nom de la personne.' })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ ok: false, message: 'Indiquez un e-mail valide.' })

    const { error } = await admin.auth.admin.updateUserById(id, {
      email,
      email_confirm: true,
      user_metadata: { nom },
    })
    if (error) {
      const deja = /already|exists|registered/i.test(error.message)
      return json({ ok: false, message: deja ? 'Cet e-mail est déjà utilisé.' : 'Le compte n’a pas pu être modifié.' })
    }
    const patch: { nom: string; email: string; role?: string } = { nom, email }
    if (corps.role !== undefined) patch.role = roleAutorise(corps.role)
    await admin.from('profiles').update(patch).eq('id', id)
    return json({ ok: true, message: 'Compte modifié.' })
  }

  if (corps.action === 'reinitialiser') {
    const id = texte(corps.id, 40)
    const password = String(corps.password ?? '')
    if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ ok: false, message: 'Compte introuvable.' })
    if (password.length < 8) return json({ ok: false, message: 'Le mot de passe doit contenir au moins 8 caractères.' })
    const { error } = await admin.auth.admin.updateUserById(id, { password })
    if (error) return json({ ok: false, message: 'Le mot de passe n’a pas été réinitialisé.' })
    return json({ ok: true, message: 'Mot de passe réinitialisé.' })
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
