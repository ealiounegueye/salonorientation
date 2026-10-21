import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { BandeauAuchan } from '../components/BandeauAuchan'
import { LogoSalon } from '../components/LogoSalon'
import { inscrire, type FormulaireInscription } from '../lib/api'
import { telechargerBadge } from '../lib/badgeImage'
import { evenement } from '../lib/evenement'
import { isConfigured, supabase } from '../lib/supabase'

const champ =
  'w-full rounded-2xl border border-line bg-paper px-4 py-3 outline-none ring-red/20 placeholder:text-muted/70 focus:ring-4'

const vide: FormulaireInscription = {
  prenom: '',
  nom: '',
  email: '',
  telephone: '',
  organisation: '',
  fonction: '',
  website: '',
}

export function InscriptionPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState(vide)
  const [ouverte, setOuverte] = useState<boolean | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)

  useEffect(() => {
    if (!isConfigured) return
    void supabase.rpc('inscriptions_ouvertes').then(({ data, error }) => {
      setOuverte(error ? null : Boolean(data))
    })
  }, [])

  function maj(cle: keyof FormulaireInscription, valeur: string) {
    setForm((actuel) => ({ ...actuel, [cle]: valeur }))
  }

  function chiffres(valeur: string) {
    return valeur.replace(/\D/g, '').slice(0, 15)
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setErreur(null)
    const prenom = form.prenom.trim()
    const nom = form.nom.trim()
    const email = form.email.trim()
    const telephone = chiffres(form.telephone)
    if (prenom.length < 2 || nom.length < 2) {
      setErreur('Indiquez votre prénom et votre nom.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErreur('Indiquez une adresse e-mail valide.')
      return
    }
    if (!/^\d{8,15}$/.test(telephone)) {
      setErreur('Indiquez un numéro de téléphone, sans lettres.')
      return
    }
    setEnvoi(true)
    const resultat = await inscrire({
      ...form,
      prenom,
      nom,
      email,
      telephone,
      organisation: form.organisation.trim(),
      fonction: form.fonction.trim(),
    })
    setEnvoi(false)
    if (!resultat.ok) {
      setErreur(resultat.message)
      return
    }
    await telechargerBadge({ code: resultat.code, prenom, nom })
    try {
      sessionStorage.setItem(`badge-dl:${resultat.code}`, '1')
    } catch {
      /* navigation privée */
    }
    navigate(`/confirmation/${resultat.code}`, {
      state: {
        emailEnvoye: resultat.emailEnvoye,
        emailMessage: resultat.emailMessage,
        dejaInscrit: resultat.dejaInscrit,
        email,
        prenom,
        nom,
        telephone,
      },
    })
  }

  const formulaireBloque = !isConfigured || ouverte === false || envoi

  return (
    <BandeauAuchan>
      <h1>
        <LogoSalon className="h-auto w-full max-w-[20rem] object-contain object-left" />
      </h1>
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.28em] text-red sm:text-[12px]">
        {evenement.organisation}
      </p>
      <p className="mt-3 text-muted">{evenement.accroche}</p>

      {!isConfigured && (
        <div className="mt-8 rounded-2xl border border-gold/30 bg-gold/10 p-4 text-sm text-ink">
          Configure <code className="rounded bg-card px-1">VITE_SUPABASE_URL</code> et{' '}
          <code className="rounded bg-card px-1">VITE_SUPABASE_ANON_KEY</code> dans un fichier{' '}
          <code className="rounded bg-card px-1">.env</code>, puis relance le serveur.
        </div>
      )}

      {isConfigured && ouverte === false && (
        <div className="mt-8 rounded-2xl border border-line bg-card p-8 text-center shadow-[0_16px_40px_rgba(224,0,26,0.08)]">
          <p className="text-xl font-semibold">Les inscriptions sont arrêtées.</p>
        </div>
      )}

      {isConfigured && ouverte !== false && (
      <form onSubmit={(event) => void onSubmit(event)} className="relative mt-8 space-y-4 overflow-hidden rounded-2xl border border-line bg-card p-6 shadow-[0_16px_40px_rgba(224,0,26,0.08)]">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-red">Inscription</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Prénom</span>
            <input required minLength={2} autoComplete="given-name" value={form.prenom} onChange={(e) => maj('prenom', e.target.value)} className={champ} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Nom</span>
            <input required minLength={2} autoComplete="family-name" value={form.nom} onChange={(e) => maj('nom', e.target.value)} className={champ} />
          </label>
        </div>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">E-mail</span>
          <input required type="email" autoComplete="email" value={form.email} onChange={(e) => maj('email', e.target.value)} className={champ} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Téléphone</span>
          <input
            required
            type="text"
            inputMode="numeric"
            autoComplete="tel"
            pattern="[0-9]{8,15}"
            minLength={8}
            maxLength={15}
            value={form.telephone}
            onChange={(e) => maj('telephone', chiffres(e.target.value))}
            className={champ}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Organisation</span>
          <input autoComplete="organization" value={form.organisation} onChange={(e) => maj('organisation', e.target.value)} className={champ} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Fonction</span>
          <input autoComplete="organization-title" value={form.fonction} onChange={(e) => maj('fonction', e.target.value)} className={champ} />
        </label>
        <div className="absolute h-0 w-0 overflow-hidden" aria-hidden="true">
          <label>
            Site web
            <input tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => maj('website', e.target.value)} />
          </label>
        </div>
        {erreur && <p className="text-sm font-medium text-red">{erreur}</p>}
        <button
          type="submit"
          disabled={formulaireBloque}
          className="w-full rounded-full bg-red py-3.5 text-sm font-semibold tracking-wide text-white uppercase hover:bg-red-dark disabled:opacity-60"
        >
          {envoi ? 'Enregistrement…' : 'Recevoir mon badge'}
        </button>
      </form>
      )}
    </BandeauAuchan>
  )
}
