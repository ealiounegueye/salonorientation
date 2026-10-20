import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { BandeauAuchan } from '../components/BandeauAuchan'
import { LogoAuchan } from '../components/LogoAuchan'
import { useAuth } from '../context/AuthContext'
import { evenement } from '../lib/evenement'

const champ =
  'w-full rounded-2xl border border-line bg-paper px-4 py-3 outline-none ring-red/20 placeholder:text-muted/70 focus:ring-4'

export function LoginPage() {
  const { loading, configured, session, profile, signIn, signOut } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center px-6">
        <p className="text-sm text-muted">Connexion…</p>
      </div>
    )
  }

  if (session && profile?.role === 'admin') {
    return <Navigate to="/admin" replace />
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    const message = await signIn(email.trim().toLowerCase(), password)
    setSubmitting(false)
    if (message) setError('E-mail ou mot de passe incorrect.')
  }

  return (
    <BandeauAuchan>
      <div className="my-auto">
        <LogoAuchan className="h-11 w-auto max-w-[12rem] object-contain object-left sm:h-12" />
        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.28em] text-red sm:text-[12px]">
          {evenement.organisation}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">{evenement.titre}</h1>
        <p className="mt-3 text-muted">Espace équipe — gestion des inscriptions.</p>

        {session && !profile && (
          <div className="mt-8 rounded-2xl border border-line bg-paper p-4 text-sm">
            <p>Ce compte n’a pas de profil admin. Exécute le schéma SQL, puis reconnecte-toi.</p>
            <button type="button" onClick={() => void signOut()} className="mt-3 font-semibold text-red">
              Se déconnecter
            </button>
          </div>
        )}

        {!configured && (
          <div className="mt-8 rounded-2xl border border-gold/30 bg-gold/10 p-4 text-sm">
            Renseigne le fichier <code className="rounded bg-card px-1">.env</code> avant de te connecter.
          </div>
        )}

        <form onSubmit={(event) => void onSubmit(event)} className="mt-8 space-y-4 rounded-2xl border border-line bg-card p-6 shadow-[0_16px_40px_rgba(224,0,26,0.08)]">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-red">Connexion</p>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">E-mail</span>
            <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className={champ} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Mot de passe</span>
            <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={champ} />
          </label>
          {error && <p className="text-sm font-medium text-red">{error}</p>}
          <button
            type="submit"
            disabled={submitting || !configured}
            className="w-full rounded-full bg-red py-3.5 text-sm font-semibold tracking-wide text-white uppercase hover:bg-red-dark disabled:opacity-60"
          >
            {submitting ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
      </div>
    </BandeauAuchan>
  )
}
