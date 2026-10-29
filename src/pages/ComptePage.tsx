import { useState, type FormEvent } from 'react'
import { AppHeader } from '../components/AppHeader'
import { useAuth } from '../context/AuthContext'
import { libelleRole } from '../lib/permissions'
import { supabase } from '../lib/supabase'

const champ =
  'w-full rounded-2xl border border-line bg-paper px-4 py-3 outline-none ring-red/20 placeholder:text-muted/70 focus:ring-4'

export function ComptePage() {
  const { profile } = useAuth()
  const [nouveauMdp, setNouveauMdp] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [messageOk, setMessageOk] = useState(true)
  const [envoi, setEnvoi] = useState(false)

  async function changerMotDePasse(event: FormEvent) {
    event.preventDefault()
    if (nouveauMdp.length < 8) {
      setMessageOk(false)
      setMessage('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }
    setEnvoi(true)
    const { error } = await supabase.auth.updateUser({ password: nouveauMdp })
    setEnvoi(false)
    if (error) {
      setMessageOk(false)
      setMessage('Le mot de passe n’a pas été modifié.')
      return
    }
    setNouveauMdp('')
    setMessageOk(true)
    setMessage('Mot de passe modifié.')
  }

  return (
    <div>
      <AppHeader subtitle="Mon compte" />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6 sm:px-6">
        {message && <p className={`text-sm font-medium ${messageOk ? 'text-green' : 'text-red'}`}>{message}</p>}

        <section className="rounded-2xl border border-line bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Profil</p>
          <p className="mt-2 font-semibold">{profile?.nom}</p>
          <p className="text-sm text-muted">{profile?.email}</p>
          {profile && (
            <p className="mt-1 text-sm text-muted">Rôle : {libelleRole(profile.role)}</p>
          )}
        </section>

        <section className="rounded-2xl border border-line bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Mot de passe</p>
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
