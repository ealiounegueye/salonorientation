import { useEffect, useState, type FormEvent } from 'react'
import { CalendarDays, Cake, Mail, Phone, User, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { BandeauAuchan } from '../components/BandeauAuchan'
import { LogoSalon } from '../components/LogoSalon'
import { inscrire, type FormulaireInscription } from '../lib/api'
import { telechargerBadge } from '../lib/badgeImage'
import { evenement } from '../lib/evenement'
import { JOURS, PROFILS, SEXES } from '../lib/format'
import { lireParametres } from '../lib/parametres'
import { isConfigured } from '../lib/supabase'

const champ =
  'w-full rounded-2xl border border-line bg-white px-4 py-3.5 outline-none ring-red/20 placeholder:text-muted/70 focus:border-red/40 focus:ring-4'

function etiquette(
  texte: string,
  obligatoire = false,
  Icone?: typeof User,
  couleurIcone = 'text-red',
) {
  return (
    <span className="mb-1.5 flex items-center gap-2 text-sm font-medium">
      {Icone ? <Icone className={`size-4 shrink-0 ${couleurIcone}`} aria-hidden /> : null}
      <span>
        {texte}
        {obligatoire ? <span className="text-red"> *</span> : null}
      </span>
    </span>
  )
}

const vide: FormulaireInscription = {
  prenom: '',
  nom: '',
  email: '',
  telephone: '',
  profil: '',
  dates: '',
  age: '',
  sexe: '',
  website: '',
}

export function InscriptionPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState(vide)
  const [ouverte, setOuverte] = useState<boolean | null>(null)
  const [joursDispo, setJoursDispo] = useState<string[]>([...JOURS])
  const [jours, setJours] = useState<string[]>([])
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)
  const toutes = joursDispo.length > 0 && joursDispo.every((jour) => jours.includes(jour))

  useEffect(() => {
    if (!isConfigured) return
    void lireParametres().then((salon) => {
      setOuverte(salon.ouverte)
      setJoursDispo(salon.jours)
    })
  }, [])

  function maj(cle: keyof FormulaireInscription, valeur: string) {
    setForm((actuel) => ({ ...actuel, [cle]: valeur }))
  }

  function chiffres(valeur: string) {
    return valeur.replace(/\D/g, '').slice(0, 15)
  }

  function basculerJour(jour: string) {
    setJours((actuel) => {
      const suite = actuel.includes(jour) ? actuel.filter((valeur) => valeur !== jour) : [...actuel, jour]
      return joursDispo.filter((valeur) => suite.includes(valeur))
    })
  }

  function basculerToutes() {
    setJours(toutes ? [] : [...joursDispo])
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
    const age = Number.parseInt(form.age, 10)
    if (!Number.isFinite(age) || age < 16 || age > 110) {
      setErreur('Indiquez votre âge (entre 16 et 110 ans).')
      return
    }
    if (form.sexe !== 'h' && form.sexe !== 'f') {
      setErreur('Indiquez votre sexe.')
      return
    }
    if (!PROFILS.some((entree) => entree.valeur === form.profil)) {
      setErreur('Choisissez votre profil.')
      return
    }
    if (jours.length === 0) {
      setErreur('Choisissez au moins une date.')
      return
    }
    const dates = jours.join(',')
    setEnvoi(true)
    const resultat = await inscrire({
      ...form,
      prenom,
      nom,
      email,
      telephone,
      profil: form.profil,
      dates,
      age: String(age),
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
        profil: form.profil,
        dates,
      },
    })
  }

  const formulaireBloque = !isConfigured || ouverte === false || envoi

  return (
    <BandeauAuchan fond="bg-[linear-gradient(180deg,#ffffff_0%,#fff6f6_46%,#f4fbf7_100%)]">
      <header className="w-full min-w-0 text-center">
        <h1 className="w-full min-w-0">
          <LogoSalon className="mx-auto block h-auto w-full" />
        </h1>
        <div className="mx-auto mt-4 flex h-1 w-24 overflow-hidden rounded-full" aria-hidden="true">
          <span className="w-2/3 bg-red" />
          <span className="w-1/3 bg-green" />
        </div>
        <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.28em] text-red sm:text-[12px]">
          {evenement.organisation}
        </p>
        <p className="mt-3 text-xs font-semibold tracking-tight text-ink sm:whitespace-nowrap sm:text-sm">
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
            {etiquette('Prénom', true, User)}
            <input required minLength={2} autoComplete="given-name" value={form.prenom} onChange={(e) => maj('prenom', e.target.value)} className={champ} />
          </label>
          <label className="block">
            {etiquette('Nom', true, User)}
            <input required minLength={2} autoComplete="family-name" value={form.nom} onChange={(e) => maj('nom', e.target.value)} className={champ} />
          </label>
        </div>
        <label className="block">
          {etiquette('E-mail', true, Mail)}
          <input required type="email" autoComplete="email" value={form.email} onChange={(e) => maj('email', e.target.value)} className={champ} />
        </label>
        <label className="block">
          {etiquette('Téléphone', true, Phone)}
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
        <div className="grid grid-cols-2 gap-4">
          <label className="block min-w-0">
            {etiquette('Âge', true, Cake)}
            <input
              required
              type="text"
              inputMode="numeric"
              minLength={2}
              maxLength={3}
              pattern="[0-9]{2,3}"
              value={form.age}
              onChange={(e) => maj('age', e.target.value.replace(/\D/g, '').slice(0, 3))}
              className={champ}
            />
          </label>
          <fieldset className="min-w-0">
            <legend className="mb-1.5 flex items-center gap-2 text-sm font-medium">
              <Users className="size-4 shrink-0 text-green" aria-hidden />
              <span>
                Sexe <span className="text-red">*</span>
              </span>
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {SEXES.map((entree) => (
                <label
                  key={entree.valeur}
                  className="flex cursor-pointer items-center justify-center gap-1.5 rounded-2xl border border-line px-2 py-3.5 text-sm font-semibold tracking-wide has-[:checked]:border-red has-[:checked]:bg-red/5"
                >
                  <input
                    type="radio"
                    name="sexe"
                    required
                    value={entree.valeur}
                    checked={form.sexe === entree.valeur}
                    onChange={() => maj('sexe', entree.valeur)}
                    className="size-4 shrink-0 accent-red"
                  />
                  {entree.code}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        <label className="block">
          {etiquette('Vous êtes', true, Users, 'text-green')}
          <select required value={form.profil} onChange={(e) => maj('profil', e.target.value)} className={champ}>
            <option value="">Choisir</option>
            {PROFILS.map((entree) => (
              <option key={entree.valeur} value={entree.valeur}>
                {entree.libelle}
              </option>
            ))}
          </select>
        </label>
        <fieldset>
          <legend className="mb-1.5 flex items-center gap-2 text-sm font-medium">
            <CalendarDays className="size-4 shrink-0 text-red" aria-hidden />
            <span>
              Dates <span className="text-red">*</span>
            </span>
          </legend>
          <div className="grid grid-cols-3 gap-2">
            {joursDispo.map((jour) => (
              <label key={jour} className="flex min-w-0 cursor-pointer items-center justify-center gap-1.5 rounded-2xl border border-line px-2 py-3 text-sm font-medium has-[:checked]:border-red has-[:checked]:bg-red/5">
                <input
                  type="checkbox"
                  checked={jours.includes(jour)}
                  onChange={() => basculerJour(jour)}
                  className="size-4 accent-red"
                />
                {jour}
              </label>
            ))}
          </div>
          <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-2xl border border-line px-3 py-3 text-sm font-medium has-[:checked]:border-red has-[:checked]:bg-red/5">
            <input type="checkbox" checked={toutes} onChange={basculerToutes} className="size-4 accent-red" />
            Toutes les dates
          </label>
        </fieldset>
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
