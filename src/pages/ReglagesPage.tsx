import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { AppHeader } from '../components/AppHeader'
import { useAuth } from '../context/AuthContext'
import { gererEquipe } from '../lib/api'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types'

const champ =
  'w-full rounded-2xl border border-line bg-paper px-4 py-3 outline-none ring-red/20 placeholder:text-muted/70 focus:ring-4'

export function ReglagesPage() {
  const { profile, session } = useAuth()
  const [ouverte, setOuverte] = useState(true)
  const [equipe, setEquipe] = useState<Profile[]>([])
  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nouveauMdp, setNouveauMdp] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [messageOk, setMessageOk] = useState(true)
  const [envoi, setEnvoi] = useState(false)

  const charger = useCallback(async () => {
    const [campagneRes, equipeRes] = await Promise.all([
      supabase.from('campagne').select('ouverte').eq('id', 1).maybeSingle(),
      supabase.from('profiles').select('*').order('created_at', { ascending: true }),
    ])
    if (campagneRes.data) setOuverte(Boolean(campagneRes.data.ouverte))
    setEquipe((equipeRes.data ?? []) as Profile[])
  }, [])

  useEffect(() => {
    void charger()
  }, [charger])

  function signaler(ok: boolean, texte: string) {
    setMessageOk(ok)
    setMessage(texte)
  }

  async function basculerCampagne() {
    const suivante = !ouverte
    const { error } = await supabase.from('campagne').update({ ouverte: suivante }).eq('id', 1)
    if (error) {
      signaler(false, 'Le changement n’a pas abouti.')
      return
    }
    setOuverte(suivante)
    signaler(true, suivante ? 'Les inscriptions sont ouvertes.' : 'Les inscriptions sont arrêtées.')
  }

  async function creerCompte(event: FormEvent) {
    event.preventDefault()
    setEnvoi(true)
    setMessage(null)
    const resultat = await gererEquipe({
      action: 'creer',
      nom: nom.trim(),
      email: email.trim().toLowerCase(),
      password,
    })
    setEnvoi(false)
    signaler(resultat.ok, resultat.message)
    if (!resultat.ok) return
    setNom('')
    setEmail('')
    setPassword('')
    void charger()
  }

  async function retirer(membre: Profile) {
    if (membre.id === session?.user.id) return
    const confirme = window.confirm(`Retirer l’accès de ${membre.nom} ?`)
    if (!confirme) return
    const resultat = await gererEquipe({ action: 'retirer', id: membre.id })
    signaler(resultat.ok, resultat.message)
    if (resultat.ok) void charger()
  }

  async function changerMotDePasse(event: FormEvent) {
    event.preventDefault()
    if (nouveauMdp.length < 8) {
      signaler(false, 'Le mot de passe doit contenir au moins 8 caractères.')
      return
    }
    setEnvoi(true)
    const { error } = await supabase.auth.updateUser({ password: nouveauMdp })
    setEnvoi(false)
    if (error) {
      signaler(false, 'Le mot de passe n’a pas été modifié.')
      return
    }
    setNouveauMdp('')
    signaler(true, 'Mot de passe modifié.')
  }

  return (
    <div>
      <AppHeader subtitle="Réglages" />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6 sm:px-6">
        {message && <p className={`text-sm font-medium ${messageOk ? 'text-green' : 'text-red'}`}>{message}</p>}

        <section className="rounded-2xl border border-line bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Inscriptions</p>
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-lg font-semibold">{ouverte ? 'Ouvertes' : 'Arrêtées'}</p>
            <button
              type="button"
              onClick={() => void basculerCampagne()}
              className="rounded-full bg-red px-4 py-2 text-sm font-semibold text-white hover:bg-red-dark"
            >
              {ouverte ? 'Arrêter' : 'Ouvrir'}
            </button>
          </div>
          <p className="mt-2 text-sm text-muted">
            {ouverte
              ? 'Le formulaire public est visible.'
              : 'Le formulaire public est masqué.'}
          </p>
        </section>

        <section className="rounded-2xl border border-line bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Équipe</p>
          <ul className="mt-3 divide-y divide-line">
            {equipe.map((membre) => (
              <li key={membre.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {membre.nom}
                    {membre.id === profile?.id ? ' · vous' : ''}
                  </p>
                  <p className="truncate text-sm text-muted">{membre.email}</p>
                </div>
                {membre.id !== profile?.id && (
                  <button
                    type="button"
                    onClick={() => void retirer(membre)}
                    className="shrink-0 rounded-full border border-line px-3 py-1.5 text-sm font-medium hover:border-red/40 hover:text-red"
                  >
                    Retirer
                  </button>
                )}
              </li>
            ))}
          </ul>

          <form onSubmit={(event) => void creerCompte(event)} className="mt-4 space-y-3 border-t border-line pt-4">
            <p className="text-sm font-semibold">Ajouter un compte</p>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Nom</span>
              <input required value={nom} onChange={(event) => setNom(event.target.value)} className={champ} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">E-mail</span>
              <input required type="email" autoComplete="off" value={email} onChange={(event) => setEmail(event.target.value)} className={champ} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Mot de passe</span>
              <input
                required
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={champ}
              />
            </label>
            <button
              type="submit"
              disabled={envoi}
              className="rounded-full bg-red px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-dark disabled:opacity-60"
            >
              {envoi ? 'Création…' : 'Ajouter'}
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-line bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Mon mot de passe</p>
          <form onSubmit={(event) => void changerMotDePasse(event)} className="mt-3 space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Nouveau mot de passe</span>
              <input
                required
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={nouveauMdp}
                onChange={(event) => setNouveauMdp(event.target.value)}
                className={champ}
              />
            </label>
            <button
              type="submit"
              disabled={envoi}
              className="rounded-full border border-line px-4 py-2.5 text-sm font-semibold hover:border-red/40 disabled:opacity-60"
            >
              Modifier
            </button>
          </form>
        </section>
      </main>
    </div>
  )
}
