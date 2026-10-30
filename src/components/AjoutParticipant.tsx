import { useEffect, useState, type FormEvent } from 'react'
import { inscrire } from '../lib/api'
import { JOURS, PROFILS, SEXES } from '../lib/format'
import { lireParametres } from '../lib/parametres'

const champ =
  'w-full rounded-2xl border border-line bg-paper px-4 py-3 outline-none ring-red/20 focus:ring-4'

export function AjoutParticipant({ onCree }: { onCree: () => void }) {
  const [prenom, setPrenom] = useState('')
  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  const [telephone, setTelephone] = useState('')
  const [age, setAge] = useState('')
  const [sexe, setSexe] = useState('')
  const [profil, setProfil] = useState('')
  const [joursDispo, setJoursDispo] = useState<string[]>([...JOURS])
  const [jours, setJours] = useState<string[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const [envoi, setEnvoi] = useState(false)
  const toutes = joursDispo.length > 0 && joursDispo.every((jour) => jours.includes(jour))

  useEffect(() => {
    void lireParametres().then((salon) => setJoursDispo(salon.jours))
  }, [])

  function basculerJour(jour: string) {
    setJours((actuel) => {
      const suite = actuel.includes(jour) ? actuel.filter((valeur) => valeur !== jour) : [...actuel, jour]
      return joursDispo.filter((valeur) => suite.includes(valeur))
    })
  }

  async function soumettre(event: FormEvent) {
    event.preventDefault()
    setMessage(null)
    const tel = telephone.replace(/\D/g, '').slice(0, 15)
    if (prenom.trim().length < 2 || nom.trim().length < 2) {
      setOk(false)
      setMessage('Indiquez le prénom et le nom.')
      return
    }
    const mail = email.trim()
    if (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
      setOk(false)
      setMessage('Indiquez un e-mail valide ou laissez le champ vide.')
      return
    }
    if (tel && !/^\d{8,15}$/.test(tel)) {
      setOk(false)
      setMessage('Indiquez un numéro valide ou laissez le champ vide.')
      return
    }
    const ageNum = Number.parseInt(age, 10)
    if (!Number.isFinite(ageNum) || ageNum < 16 || ageNum > 110) {
      setOk(false)
      setMessage('Indiquez l’âge (16–110 ans).')
      return
    }
    if (sexe !== 'h' && sexe !== 'f') {
      setOk(false)
      setMessage('Indiquez le sexe (M ou F).')
      return
    }
    if (!PROFILS.some((entree) => entree.valeur === profil) || jours.length === 0) {
      setOk(false)
      setMessage('Choisissez le profil et au moins une date.')
      return
    }
    setEnvoi(true)
    const resultat = await inscrire({
      prenom: prenom.trim(),
      nom: nom.trim(),
      email: mail,
      telephone: tel,
      profil,
      dates: jours.join(','),
      age: String(ageNum),
      sexe,
      website: '',
    })
    setEnvoi(false)
    setOk(resultat.ok)
    if (!resultat.ok) {
      setMessage(resultat.message)
      return
    }
    setMessage(`Participant ajouté — ${resultat.code}`)
    setPrenom('')
    setNom('')
    setEmail('')
    setTelephone('')
    setAge('')
    setSexe('')
    setProfil('')
    setJours([])
    onCree()
  }

  return (
    <form onSubmit={(event) => void soumettre(event)} className="grid gap-3 rounded-2xl border border-line bg-white p-4 sm:grid-cols-2">
      <p className="text-sm font-semibold sm:col-span-2">Nouveau participant</p>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Prénom</span>
        <input required value={prenom} onChange={(event) => setPrenom(event.target.value)} className={champ} />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Nom</span>
        <input required value={nom} onChange={(event) => setNom(event.target.value)} className={champ} />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">E-mail</span>
        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className={champ} />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Téléphone</span>
        <input
          inputMode="numeric"
          value={telephone}
          onChange={(event) => setTelephone(event.target.value.replace(/\D/g, '').slice(0, 15))}
          className={champ}
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Âge</span>
        <input
          required
          inputMode="numeric"
          value={age}
          onChange={(event) => setAge(event.target.value.replace(/\D/g, '').slice(0, 3))}
          className={champ}
        />
      </label>
      <fieldset className="min-w-0">
        <legend className="mb-1.5 text-sm font-medium">Sexe</legend>
        <div className="grid grid-cols-2 gap-2">
          {SEXES.map((entree) => (
            <label
              key={entree.valeur}
              className="flex cursor-pointer items-center justify-center gap-1.5 rounded-2xl border border-line px-2 py-3 text-sm font-semibold has-[:checked]:border-red has-[:checked]:bg-red/5"
            >
              <input
                type="radio"
                name="sexe-admin"
                required
                value={entree.valeur}
                checked={sexe === entree.valeur}
                onChange={() => setSexe(entree.valeur)}
                className="size-4 shrink-0 accent-red"
              />
              {entree.code}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block sm:col-span-2">
        <span className="mb-1.5 block text-sm font-medium">Profil</span>
        <select required value={profil} onChange={(event) => setProfil(event.target.value)} className={champ}>
          <option value="">Choisir</option>
          {PROFILS.map((entree) => (
            <option key={entree.valeur} value={entree.valeur}>
              {entree.libelle}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="sm:col-span-2">
        <legend className="mb-1.5 text-sm font-medium">Dates</legend>
        <div className="flex flex-wrap gap-2">
          {joursDispo.map((jour) => (
            <label key={jour} className="flex cursor-pointer items-center gap-2 rounded-full border border-line px-3 py-2 text-sm has-[:checked]:border-red has-[:checked]:bg-red/5">
              <input type="checkbox" checked={jours.includes(jour)} onChange={() => basculerJour(jour)} className="size-4 accent-red" />
              {jour}
            </label>
          ))}
          <label className="flex cursor-pointer items-center gap-2 rounded-full border border-line px-3 py-2 text-sm has-[:checked]:border-red has-[:checked]:bg-red/5">
            <input
              type="checkbox"
              checked={toutes}
              onChange={() => setJours(toutes ? [] : [...joursDispo])}
              className="size-4 accent-red"
            />
            Toutes les dates
          </label>
        </div>
      </fieldset>
      {message && <p className={`text-sm font-medium sm:col-span-2 ${ok ? 'text-green' : 'text-red'}`}>{message}</p>}
      <button
        type="submit"
        disabled={envoi}
        className="rounded-full bg-red px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-dark disabled:opacity-60 sm:col-span-2 sm:w-fit"
      >
        {envoi ? 'Ajout…' : 'Enregistrer'}
      </button>
    </form>
  )
}
