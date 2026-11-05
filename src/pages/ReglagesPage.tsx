import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { AppHeader } from '../components/AppHeader'
import { BoiteConfirmation } from '../components/BoiteConfirmation'
import { useAuth } from '../context/AuthContext'
import { gererEquipe } from '../lib/api'
import { lireParametres, normaliserJours } from '../lib/parametres'
import { jourSalonDakar, libelleJourSalon } from '../lib/presence'
import { supabase } from '../lib/supabase'
import type { Profile, Role } from '../types'
import { libelleRole } from '../lib/permissions'
import { JOURS } from '../lib/format'

function joursSalonDepuisTexte(joursTexte: string) {
  const jours = normaliserJours(joursTexte)
  return jours.length ? jours : [...JOURS]
}

const champ =
  'w-full rounded-2xl border border-line bg-paper px-4 py-3 outline-none ring-red/20 placeholder:text-muted/70 focus:ring-4'

export function ReglagesPage() {
  const { profile, session } = useAuth()
  const [ouverte, setOuverte] = useState(true)
  const [lieu, setLieu] = useState('')
  const [horaires, setHoraires] = useState('')
  const [periode, setPeriode] = useState('')
  const [joursTexte, setJoursTexte] = useState('')
  const [pointageForce, setPointageForce] = useState(false)
  const [jourPointage, setJourPointage] = useState('')
  const [equipe, setEquipe] = useState<Profile[]>([])
  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [roleNouveau, setRoleNouveau] = useState<Role>('admin')
  const [nouveauMdp, setNouveauMdp] = useState('')
  const [edition, setEdition] = useState<string | null>(null)
  const [editNom, setEditNom] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editRole, setEditRole] = useState<Role>('admin')
  const [resetId, setResetId] = useState<string | null>(null)
  const [resetMdp, setResetMdp] = useState('')
  const [ajoutCompte, setAjoutCompte] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [messageOk, setMessageOk] = useState(true)
  const [envoi, setEnvoi] = useState(false)
  const [confirmArretCampagne, setConfirmArretCampagne] = useState(false)
  const [horloge, setHorloge] = useState(() => Date.now())

  const charger = useCallback(async () => {
    const [campagneRes, equipeRes] = await Promise.all([
      supabase
        .from('campagne')
        .select('ouverte, lieu, horaires, periode, jours, pointage_force, jour_pointage')
        .eq('id', 1)
        .maybeSingle(),
      supabase.from('profiles').select('*').order('created_at', { ascending: true }),
    ])
    if (campagneRes.data) {
      const salon = campagneRes.data
      setOuverte(Boolean(salon.ouverte))
      setLieu(String(salon.lieu ?? ''))
      setHoraires(String(salon.horaires ?? ''))
      setPeriode(String(salon.periode ?? ''))
      const jours = normaliserJours(String(salon.jours ?? ''))
      setJoursTexte(jours.join(', '))
      const force = Boolean(salon.pointage_force)
      const jour = String(salon.jour_pointage ?? '').trim()
      setPointageForce(force)
      setJourPointage(force && jour && jours.includes(jour) ? jour : jours[0] ?? '')
    }
    setEquipe((equipeRes.data ?? []) as Profile[])
  }, [])

  useEffect(() => {
    void charger()
  }, [charger])

  useEffect(() => {
    const id = window.setInterval(() => setHorloge(Date.now()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  const joursSalon = useMemo(() => joursSalonDepuisTexte(joursTexte), [joursTexte])

  const jourSalonAujourdHui = useMemo(() => {
    void horloge
    return jourSalonDakar(joursSalon)
  }, [horloge, joursSalon])

  useEffect(() => {
    if (!pointageForce) return
    setJourPointage((actuel) => (joursSalon.includes(actuel) ? actuel : joursSalon[0] ?? ''))
  }, [joursSalon, pointageForce])

  function signaler(ok: boolean, texte: string) {
    setMessageOk(ok)
    setMessage(texte)
  }

  function demanderBasculerCampagne() {
    if (ouverte) {
      setConfirmArretCampagne(true)
      return
    }
    void appliquerBasculerCampagne()
  }

  async function appliquerBasculerCampagne() {
    setConfirmArretCampagne(false)
    const suivante = !ouverte
    const { error } = await supabase.from('campagne').update({ ouverte: suivante }).eq('id', 1)
    if (error) {
      signaler(false, 'Le changement n’a pas abouti.')
      return
    }
    setOuverte(suivante)
    signaler(true, suivante ? 'Les inscriptions sont ouvertes.' : 'Les inscriptions sont arrêtées.')
  }

  async function enregistrerSalon(event: FormEvent) {
    event.preventDefault()
    const jours = normaliserJours(joursTexte)
    if (jours.length === 0 || !lieu.trim() || !horaires.trim()) {
      signaler(false, 'Indiquez le lieu, les horaires et au moins un jour.')
      return
    }
    setEnvoi(true)
    const { error } = await supabase
      .from('campagne')
      .update({
        lieu: lieu.trim(),
        horaires: horaires.trim(),
        periode: periode.trim(),
        jours: jours.join(','),
      })
      .eq('id', 1)
    setEnvoi(false)
    if (error) {
      signaler(false, 'Les paramètres n’ont pas été enregistrés.')
      return
    }
    setJoursTexte(jours.join(', '))
    await lireParametres(true)
    if (pointageForce && jourPointage && !jours.includes(jourPointage)) {
      setJourPointage(jours[0] ?? '')
    }
    signaler(true, 'Le formulaire utilise ces dates.')
  }

  async function enregistrerPointage(event: FormEvent) {
    event.preventDefault()
    const jours = joursSalonDepuisTexte(joursTexte)
    const jour = pointageForce ? jourPointage.trim() : ''
    if (pointageForce && (!jour || !jours.includes(jour))) {
      signaler(false, 'Choisissez un jour de pointage valide.')
      return
    }
    setEnvoi(true)
    const { error } = await supabase
      .from('campagne')
      .update({
        pointage_force: pointageForce,
        jour_pointage: pointageForce ? jour : null,
      })
      .eq('id', 1)
    setEnvoi(false)
    if (error) {
      signaler(false, 'Le réglage de pointage n’a pas été enregistré.')
      return
    }
    await lireParametres(true)
    signaler(
      true,
      pointageForce
        ? `Hors dates du salon, pointage sur ${libelleJourSalon(jour)} (pendant le salon : automatique Dakar).`
        : 'Pointage uniquement les jours du salon (date Dakar).',
    )
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
      role: roleNouveau,
    })
    setEnvoi(false)
    signaler(resultat.ok, resultat.message)
    if (!resultat.ok) return
    setNom('')
    setEmail('')
    setPassword('')
    setAjoutCompte(false)
    void charger()
  }

  function ouvrirEdition(membre: Profile) {
    setAjoutCompte(false)
    setResetId(null)
    setEdition(membre.id)
    setEditNom(membre.nom)
    setEditEmail(membre.email)
    setEditRole(membre.role)
  }

  async function enregistrerEdition(event: FormEvent) {
    event.preventDefault()
    if (!edition) return
    setEnvoi(true)
    const resultat = await gererEquipe({
      action: 'modifier',
      id: edition,
      nom: editNom.trim(),
      email: editEmail.trim().toLowerCase(),
      role: editRole,
    })
    setEnvoi(false)
    signaler(resultat.ok, resultat.message)
    if (!resultat.ok) return
    setEdition(null)
    void charger()
  }

  async function reinitialiser(event: FormEvent) {
    event.preventDefault()
    if (!resetId) return
    if (resetMdp.length < 8) {
      signaler(false, 'Le mot de passe doit contenir au moins 8 caractères.')
      return
    }
    setEnvoi(true)
    const resultat = await gererEquipe({ action: 'reinitialiser', id: resetId, password: resetMdp })
    setEnvoi(false)
    signaler(resultat.ok, resultat.message)
    if (!resultat.ok) return
    setResetId(null)
    setResetMdp('')
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
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-lg font-semibold">{ouverte ? 'Ouvertes' : 'Arrêtées'}</p>
            <button
              type="button"
              onClick={() => demanderBasculerCampagne()}
              className="w-full rounded-full bg-red px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-dark sm:w-auto"
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
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Pointage scan</p>
          <p className="mt-2 text-sm text-muted">
            Pendant les <strong className="font-medium text-ink">jours du salon</strong> (dates configurées ci-dessous, ex.
            18–20 nov.), le pointage est <strong className="font-medium text-ink">toujours automatique</strong> à Dakar.
            Le forçage ne s’applique qu’<strong className="font-medium text-ink">en dehors</strong> de ces dates (test,
            rattrapage), sur tous les postes.
          </p>
          <form onSubmit={(event) => void enregistrerPointage(event)} className="mt-4 space-y-3">
            <fieldset className="space-y-2">
              <legend className="sr-only">Mode de pointage</legend>
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line px-4 py-3 has-[:checked]:border-red has-[:checked]:bg-red/5">
                <input
                  type="radio"
                  name="mode-pointage"
                  checked={!pointageForce}
                  onChange={() => setPointageForce(false)}
                  className="mt-0.5 size-4 accent-red"
                />
                <span>
                  <span className="block text-sm font-semibold">Automatique</span>
                  <span className="block text-sm text-muted">Jour du salon selon la date et l’heure à Dakar.</span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line px-4 py-3 has-[:checked]:border-red has-[:checked]:bg-red/5">
                <input
                  type="radio"
                  name="mode-pointage"
                  checked={pointageForce}
                  onChange={() => {
                    setPointageForce(true)
                    setJourPointage((actuel) =>
                      joursSalon.includes(actuel) ? actuel : joursSalon[0] ?? '',
                    )
                  }}
                  className="mt-0.5 size-4 accent-red"
                />
                <span>
                  <span className="block text-sm font-semibold">Forcer un jour</span>
                  <span className="block text-sm text-muted">
                    Hors jours du salon uniquement : les scans comptent pour le jour choisi.
                  </span>
                </span>
              </label>
            </fieldset>
            {!pointageForce ? (
              <p className="rounded-2xl bg-paper px-4 py-3 text-sm text-muted">
                {jourSalonAujourdHui ? (
                  <>
                    Aujourd’hui ({libelleJourSalon(jourSalonAujourdHui)}) : le scan est{' '}
                    <strong className="font-medium text-ink">automatique</strong>. Aucune date à choisir ici.
                  </>
                ) : (
                  <>
                    Les jours du salon ({joursSalon.map((j) => libelleJourSalon(j)).join(', ')}) : le scan s’ouvre
                    automatiquement à Dakar. Aucune date à choisir en mode automatique.
                  </>
                )}
              </p>
            ) : jourSalonAujourdHui ? (
              <div className="space-y-3 rounded-2xl border border-green/30 bg-green/5 px-4 py-3">
                <p className="text-sm text-ink">
                  Aujourd’hui ({libelleJourSalon(jourSalonAujourdHui)}) : le scan reste{' '}
                  <strong className="font-semibold">automatique</strong>, même avec « Forcer un jour » enregistré.
                </p>
                <p className="text-sm text-muted">
                  Le jour forcé ci-dessous ne s’utilise qu’<strong className="font-medium text-ink">avant ou après</strong>{' '}
                  les dates du salon.
                </p>
                <details className="text-sm">
                  <summary className="cursor-pointer font-medium text-ink">
                    Jour forcé hors salon : {libelleJourSalon(jourPointage || (joursSalon[0] ?? ''))}
                  </summary>
                  <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Jour de pointage hors salon">
                    {joursSalon.map((jour) => (
                      <label
                        key={jour}
                        className="flex cursor-pointer items-center gap-2 rounded-full border border-line bg-white px-4 py-2.5 text-sm font-medium has-[:checked]:border-red has-[:checked]:bg-red/5"
                      >
                        <input
                          type="radio"
                          name="jour-pointage"
                          value={jour}
                          checked={jourPointage === jour}
                          onChange={() => setJourPointage(jour)}
                          className="size-4 shrink-0 accent-red"
                        />
                        {libelleJourSalon(jour)}
                      </label>
                    ))}
                  </div>
                </details>
              </div>
            ) : (
              <div>
                <p className="mb-2 text-sm font-medium">Jour forcé (hors dates du salon)</p>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Jour de pointage hors salon">
                  {joursSalon.map((jour) => (
                    <label
                      key={jour}
                      className="flex cursor-pointer items-center gap-2 rounded-full border border-line px-4 py-2.5 text-sm font-medium has-[:checked]:border-red has-[:checked]:bg-red/5"
                    >
                      <input
                        type="radio"
                        name="jour-pointage"
                        value={jour}
                        checked={jourPointage === jour}
                        onChange={() => setJourPointage(jour)}
                        className="size-4 shrink-0 accent-red"
                      />
                      {libelleJourSalon(jour)}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <button
              type="submit"
              disabled={envoi}
              className="rounded-full bg-red px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-dark disabled:opacity-60"
            >
              Enregistrer le pointage
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-line bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Salon</p>
          <p className="mt-2 text-sm text-muted">
            Ces informations s’affichent sous le QR code et déterminent les dates du formulaire.
          </p>
          <form onSubmit={(event) => void enregistrerSalon(event)} className="mt-4 space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Lieu</span>
              <input required value={lieu} onChange={(event) => setLieu(event.target.value)} className={champ} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Horaires</span>
              <input required value={horaires} onChange={(event) => setHoraires(event.target.value)} className={champ} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Période</span>
              <input required value={periode} onChange={(event) => setPeriode(event.target.value)} placeholder="novembre 2026" className={champ} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Jours proposés</span>
              <input required value={joursTexte} onChange={(event) => setJoursTexte(event.target.value)} placeholder="18, 19, 20" className={champ} />
            </label>
            <button
              type="submit"
              disabled={envoi}
              className="rounded-full bg-red px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-dark disabled:opacity-60"
            >
              Enregistrer
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-line bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Équipe</p>
          <p className="mt-2 text-sm text-muted">
            <strong className="font-medium text-ink">Hôtesse</strong> : participants, scan et ajout manuel — sans tableau de
            bord ni exports.{' '}
            <strong className="font-medium text-ink">Admin</strong> : tableau de bord, exports, badges — sans réglages ni
            équipe. <strong className="font-medium text-ink">Super admin</strong> : tout.
          </p>
          <ul className="mt-3 divide-y divide-line">
            {equipe.map((membre) => (
              <li key={membre.id} className="py-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {membre.nom}
                      {membre.id === profile?.id ? ' · vous' : ''}
                    </p>
                    <p className="truncate text-sm text-muted">
                      {membre.email} · {libelleRole(membre.role)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:shrink-0 sm:justify-end">
                    <button
                      type="button"
                      onClick={() => ouvrirEdition(membre)}
                      className="rounded-full border border-line px-3 py-1.5 text-sm font-medium hover:border-red/40"
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAjoutCompte(false)
                        setEdition(null)
                        setResetMdp('')
                        setResetId(resetId === membre.id ? null : membre.id)
                      }}
                      className="rounded-full border border-line px-3 py-1.5 text-sm font-medium hover:border-red/40"
                    >
                      Mot de passe
                    </button>
                    {membre.id !== profile?.id && (
                      <button
                        type="button"
                        onClick={() => void retirer(membre)}
                        className="rounded-full border border-line px-3 py-1.5 text-sm font-medium hover:border-red/40 hover:text-red"
                      >
                        Retirer
                      </button>
                    )}
                  </div>
                </div>
                {edition === membre.id && (
                  <form onSubmit={(event) => void enregistrerEdition(event)} className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium">Nom</span>
                      <input required value={editNom} onChange={(event) => setEditNom(event.target.value)} className={champ} />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium">E-mail</span>
                      <input required type="email" value={editEmail} onChange={(event) => setEditEmail(event.target.value)} className={champ} />
                    </label>
                    <label className="block sm:col-span-2">
                      <span className="mb-1.5 block text-sm font-medium">Rôle</span>
                      <select
                        value={editRole}
                        onChange={(event) => setEditRole(event.target.value as Role)}
                        className={champ}
                      >
                        <option value="hotesse">Hôtesse</option>
                        <option value="admin">Admin</option>
                        <option value="super_admin">Super admin</option>
                      </select>
                    </label>
                    <button
                      type="submit"
                      disabled={envoi}
                      className="rounded-full bg-red px-4 py-2 text-sm font-semibold text-white hover:bg-red-dark disabled:opacity-60 sm:col-span-2 sm:w-fit"
                    >
                      Enregistrer
                    </button>
                  </form>
                )}
                {resetId === membre.id && (
                  <form onSubmit={(event) => void reinitialiser(event)} className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
                    <label className="block min-w-0 flex-1">
                      <span className="mb-1.5 block text-sm font-medium">Nouveau mot de passe</span>
                      <input
                        required
                        type="password"
                        autoComplete="new-password"
                        minLength={8}
                        value={resetMdp}
                        onChange={(event) => setResetMdp(event.target.value)}
                        className={champ}
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={envoi}
                      className="rounded-full bg-red px-4 py-3 text-sm font-semibold text-white hover:bg-red-dark disabled:opacity-60"
                    >
                      Réinitialiser
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>

          <div className="mt-4 border-t border-line pt-4">
            {!ajoutCompte ? (
              <button
                type="button"
                onClick={() => {
                  setEdition(null)
                  setResetId(null)
                  setAjoutCompte(true)
                }}
                className="rounded-full bg-red px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-dark"
              >
                Ajouter un compte
              </button>
            ) : (
              <form onSubmit={(event) => void creerCompte(event)} className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">Nouveau compte</p>
                  <button
                    type="button"
                    onClick={() => {
                      setAjoutCompte(false)
                      setNom('')
                      setEmail('')
                      setPassword('')
                    }}
                    className="rounded-full border border-line px-3 py-1.5 text-sm font-medium hover:border-red/40"
                  >
                    Annuler
                  </button>
                </div>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">Nom</span>
                  <input required value={nom} onChange={(event) => setNom(event.target.value)} className={champ} />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">E-mail</span>
                  <input
                    required
                    type="email"
                    autoComplete="off"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className={champ}
                  />
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
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">Rôle</span>
                  <select
                    value={roleNouveau}
                    onChange={(event) => setRoleNouveau(event.target.value as Role)}
                    className={champ}
                  >
                    <option value="hotesse">Hôtesse</option>
                    <option value="admin">Admin</option>
                    <option value="super_admin">Super admin</option>
                  </select>
                </label>
                <button
                  type="submit"
                  disabled={envoi}
                  className="rounded-full bg-red px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-dark disabled:opacity-60"
                >
                  {envoi ? 'Création…' : 'Créer le compte'}
                </button>
              </form>
            )}
          </div>
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
      <BoiteConfirmation
        ouverte={confirmArretCampagne}
        titre="Arrêter les inscriptions ?"
        message="Le formulaire public sera masqué. Les visiteurs ne pourront plus s’inscrire en ligne."
        confirmerLabel="Arrêter"
        onConfirmer={() => void appliquerBasculerCampagne()}
        onAnnuler={() => setConfirmArretCampagne(false)}
      />
    </div>
  )
}
