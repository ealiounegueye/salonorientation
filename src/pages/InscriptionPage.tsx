import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { BandeauAuchan } from '../components/BandeauAuchan'
import { LogoSalon } from '../components/LogoSalon'
import { inscrire, type FormulaireInscription } from '../lib/api'
import { telechargerBadge } from '../lib/badgeImage'
import { evenement } from '../lib/evenement'
import { isConfigured, supabase } from '../lib/supabase'

const champ =
  'w-full rounded-2xl border border-line bg-white px-4 py-3.5 outline-none ring-red/20 placeholder:text-muted/70 focus:border-red/40 focus:ring-4'

function etiquette(texte: string, obligatoire = false) {
  return (
    <span className="mb-1.5 block text-sm font-medium">
      {texte}
      {obligatoire ? <span className="text-red"> *</span> : null}
    </span>
  )
}

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
    <BandeauAuchan fond="bg-[linear-gradient(180deg,#ffffff_0%,#fff6f6_46%,#f4fbf7_100%)]">
      <header className="text-center">
        <h1 className="flex justify-center">
          <LogoSalon className="h-auto w-full max-w-[18.5rem] sm:max-w-[22rem]" />
        </h1>
        <div className="mx-auto mt-4 flex h-1 w-24 overflow-hidden rounded-full" aria-hidden="true">
          <span className="w-2/3 bg-red" />
          <span className="w-1/3 bg-green" />
        </div>
        <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.28em] text-red sm:text-[12px]">
          {evenement.organisation}
        </p>
        <p className="mx-auto mt-3 max-w-sm text-xl font-semibold leading-snug tracking-tight text-ink sm:text-2xl">
          {evenement.accroche}
        </p>
      </header>

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
      <form onSubmit={(event) => void onSubmit(event)} className="relative mt-8 space-y-4 overflow-hidden rounded-[1.75rem] border border-line bg-white p-6 shadow-[0_22px_50px_rgba(224,0,26,0.1)] sm:p-8">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-red" aria-hidden="true" />
        <div className="pt-1">
          <p className="text-lg font-semibold tracking-tight">Inscription</p>
          <p className="mt-1 text-sm text-muted">Les champs marqués d’une * sont obligatoires.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            {etiquette('Prénom', true)}
            <input required minLength={2} autoComplete="given-name" value={form.prenom} onChange={(e) => maj('prenom', e.target.value)} className={champ} />
          </label>
          <label className="block">
            {etiquette('Nom', true)}
            <input required minLength={2} autoComplete="family-name" value={form.nom} onChange={(e) => maj('nom', e.target.value)} className={champ} />
          </label>
        </div>
        <label className="block">
          {etiquette('E-mail', true)}
          <input required type="email" autoComplete="email" value={form.email} onChange={(e) => maj('email', e.target.value)} className={champ} />
        </label>
        <label className="block">
          {etiquette('Téléphone', true)}
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
          {etiquette('Organisation')}
          <input autoComplete="organization" value={form.organisation} onChange={(e) => maj('organisation', e.target.value)} className={champ} />
        </label>
        <label className="block">
          {etiquette('Fonction')}
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
          className="mt-2 w-full rounded-full bg-red py-4 text-sm font-semibold tracking-wide text-white uppercase shadow-[0_12px_24px_rgba(224,0,26,0.28)] hover:bg-red-dark disabled:opacity-60"
        >
          {envoi ? 'Enregistrement…' : 'Recevoir mon badge'}
        </button>
        <p className="text-center text-xs leading-relaxed text-muted">Le badge se télécharge juste après l’inscription.</p>
      </form>
      )}
    </BandeauAuchan>
  )
}
