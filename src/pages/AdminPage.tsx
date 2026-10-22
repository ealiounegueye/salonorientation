import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Download, ScanLine, Search, Trash2, UserPlus } from 'lucide-react'
import { AjoutParticipant } from '../components/AjoutParticipant'
import { AppHeader } from '../components/AppHeader'
import { ScanPresence } from '../components/ScanPresence'
import { useAuth } from '../context/AuthContext'
import { exporterCsv, extraireCode, filtreRecherche, formatQuand, JOURS, libelleDates, libelleProfil, LIBELLE_STATUT, nomComplet, PROFILS } from '../lib/format'
import { lireParametres } from '../lib/parametres'
import { supabase } from '../lib/supabase'
import type { Participant, StatutParticipant } from '../types'

const PAGE = 50
const FILTRES: Array<{ id: 'tous' | StatutParticipant; label: string }> = [
  { id: 'tous', label: 'Tous' },
  { id: 'inscrit', label: 'Inscrits' },
  { id: 'present', label: 'Présents' },
]

export function AdminPage() {
  const { configured } = useAuth()
  const [lignes, setLignes] = useState<Participant[]>([])
  const [total, setTotal] = useState(0)
  const [volume, setVolume] = useState(0)
  const [presents, setPresents] = useState(0)
  const [ouverts, setOuverts] = useState(true)
  const [recherche, setRecherche] = useState('')
  const [saisie, setSaisie] = useState('')
  const [filtre, setFiltre] = useState<(typeof FILTRES)[number]['id']>('tous')
  const [joursDispo, setJoursDispo] = useState<string[]>([...JOURS])
  const [jour, setJour] = useState('toutes')
  const [profil, setProfil] = useState('tous')
  const [listeEnCours, setListeEnCours] = useState(false)
  const [ajout, setAjout] = useState(false)
  const [page, setPage] = useState(0)
  const [code, setCode] = useState('')
  const [flash, setFlash] = useState<string | null>(null)
  const [flashOk, setFlashOk] = useState(true)
  const [exportEnCours, setExportEnCours] = useState(false)
  const [camera, setCamera] = useState(false)
  const recents = useRef(new Map<string, number>())
  const requeteListe = useRef(0)
  const son = useRef<AudioContext | null>(null)
  const flashTimer = useRef<number | null>(null)

  const chargerStats = useCallback(async () => {
    const [volumeRes, presentsRes, campagneRes, salon] = await Promise.all([
      supabase.from('participants').select('*', { count: 'exact', head: true }),
      supabase.from('participants').select('*', { count: 'exact', head: true }).eq('statut', 'present'),
      supabase.from('campagne').select('ouverte').eq('id', 1).maybeSingle(),
      lireParametres(true),
    ])
    setVolume(volumeRes.count ?? 0)
    setPresents(presentsRes.count ?? 0)
    if (campagneRes.data) setOuverts(Boolean(campagneRes.data.ouverte))
    setJoursDispo(salon.jours)
  }, [])

  const charger = useCallback(async () => {
    const ticket = ++requeteListe.current
    setListeEnCours(true)
    const filtreTexte = filtreRecherche(recherche)
    let liste = supabase
      .from('participants')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
    if (filtre !== 'tous') liste = liste.eq('statut', filtre)
    if (profil !== 'tous') liste = liste.eq('profil', profil)
    if (jour !== 'toutes') liste = liste.contains('jours_sel', [jour])
    if (filtreTexte) liste = liste.or(filtreTexte)

    const { data, count } = await liste.range(page * PAGE, page * PAGE + PAGE - 1)
    if (ticket !== requeteListe.current) return
    setLignes((data ?? []) as Participant[])
    setTotal(count ?? 0)
    setListeEnCours(false)
  }, [filtre, jour, page, profil, recherche])

  useEffect(() => {
    if (!configured) return
    void chargerStats()
  }, [chargerStats, configured])

  useEffect(() => {
    if (configured) void charger()
  }, [charger, configured])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(0)
      setRecherche(saisie)
    }, 250)
    return () => window.clearTimeout(timer)
  }, [saisie])

  function preparerSon() {
    son.current ??= new AudioContext()
    void son.current.resume()
  }

  function bip(ok: boolean) {
    const ctx = son.current
    if (!ctx) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = ok ? 880 : 220
    gain.gain.value = 0.06
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + (ok ? 0.12 : 0.18))
  }

  function signaler(ok: boolean, texte: string) {
    setFlashOk(ok)
    setFlash(texte)
    if (flashTimer.current) window.clearTimeout(flashTimer.current)
    flashTimer.current = window.setTimeout(() => setFlash(null), ok ? 1100 : 1800)
    bip(ok)
  }

  async function basculerCampagne() {
    const suivante = !ouverts
    const { error } = await supabase.from('campagne').update({ ouverte: suivante }).eq('id', 1)
    if (!error) setOuverts(suivante)
  }

  async function marquerPresent(brut: string) {
    const valeur = extraireCode(brut) ?? brut.trim().toUpperCase()
    if (!/^SLN-[A-Z0-9]{6}$/.test(valeur)) {
      signaler(false, 'Code introuvable.')
      return
    }
    const maintenant = Date.now()
    const precedent = recents.current.get(valeur)
    if (precedent && maintenant - precedent < 4000) return
    recents.current.set(valeur, maintenant)

    const { data } = await supabase.from('participants').select('*').eq('code', valeur).maybeSingle()
    const participant = data as Participant | null
    if (!participant) {
      signaler(false, 'Code introuvable.')
      return
    }
    if (participant.statut === 'annule') {
      signaler(false, `${nomComplet(participant)} — inscription annulée.`)
      return
    }
    if (participant.statut !== 'present') {
      const { error } = await supabase.from('participants').update({ statut: 'present' }).eq('id', participant.id)
      if (error) {
        signaler(false, 'Le pointage n’a pas abouti.')
        recents.current.delete(valeur)
        return
      }
      void charger()
    }
    signaler(true, `Scanné — ${nomComplet(participant)}`)
    navigator.vibrate?.(40)
  }

  async function pointer(event: FormEvent) {
    event.preventDefault()
    const valeur = code.trim()
    setCode('')
    if (!valeur) return
    await marquerPresent(valeur)
  }

  async function supprimer(participant: Participant) {
    const confirme = window.confirm(
      `Supprimer définitivement l’inscription de ${nomComplet(participant)} (${participant.code}) ?`,
    )
    if (!confirme) return
    const { error } = await supabase.from('participants').delete().eq('id', participant.id)
    if (error) {
      signaler(false, 'La suppression n’a pas abouti.')
      return
    }
    signaler(true, `${nomComplet(participant)} — inscription supprimée.`)
    if (lignes.length === 1 && page > 0) setPage((n) => Math.max(0, n - 1))
    else void charger()
  }

  async function exporter() {
    setExportEnCours(true)
    const toutes: Participant[] = []
    const filtreTexte = filtreRecherche(recherche)
    for (let from = 0; from < 20000; from += 1000) {
      let requete = supabase.from('participants').select('*').order('created_at', { ascending: false })
      if (filtre !== 'tous') requete = requete.eq('statut', filtre)
      if (profil !== 'tous') requete = requete.eq('profil', profil)
      if (jour !== 'toutes') requete = requete.contains('jours_sel', [jour])
      if (filtreTexte) requete = requete.or(filtreTexte)
      const { data, error } = await requete.range(from, from + 999)
      if (error || !data?.length) break
      toutes.push(...(data as Participant[]))
      if (data.length < 1000) break
    }
    exporterCsv(toutes)
    setExportEnCours(false)
  }

  const pages = Math.max(1, Math.ceil(total / PAGE))

  return (
    <div>
      <AppHeader subtitle="Participants" />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6">
        <section className="rounded-2xl border border-line bg-white p-4">
          <button
            type="button"
            onClick={() => {
              preparerSon()
              setCamera((ouvert) => !ouvert)
            }}
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-red py-5 text-lg font-semibold text-white hover:bg-red-dark"
          >
            <ScanLine className="size-6" />
            {camera ? 'Arrêter le scan' : 'Scanner un QR code'}
          </button>
          <ScanPresence actif={camera} onCode={(valeur) => void marquerPresent(valeur)} />
          {flash && (
            <p className={`mt-3 text-center text-lg font-semibold ${flashOk ? 'text-green' : 'text-red'}`} role="status">
              {flash}
            </p>
          )}
        </section>
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <article className="rounded-2xl border border-line bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Inscriptions</p>
            <p className="mt-1 text-3xl font-semibold">{volume}</p>
          </article>
          <article className="rounded-2xl border border-line bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Présents</p>
            <p className="mt-1 text-3xl font-semibold text-green">{presents}</p>
          </article>
          <article className="col-span-2 flex items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4 sm:col-span-1">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Campagne</p>
              <p className="mt-1 font-semibold">{ouverts ? 'Ouverte' : 'Fermée'}</p>
            </div>
            <button
              type="button"
              onClick={() => void basculerCampagne()}
              className="rounded-full bg-red px-4 py-2 text-sm font-semibold text-white hover:bg-red-dark"
            >
              {ouverts ? 'Fermer' : 'Ouvrir'}
            </button>
          </article>
        </section>

        <form onSubmit={(event) => void pointer(event)} className="rounded-2xl border border-line bg-white p-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Ou saisir le code</span>
            <input
              value={code}
              onChange={(event) => {
                const valeur = event.target.value.toUpperCase()
                setCode(valeur)
                const lu = extraireCode(valeur)
                if (!lu) return
                setCode('')
                void marquerPresent(lu)
              }}
              placeholder="SLN-XXXXXX"
              autoComplete="off"
              onFocus={preparerSon}
              className="w-full rounded-2xl border border-line bg-paper px-4 py-3 font-semibold tracking-[0.14em] outline-none ring-red/20 focus:ring-4"
            />
          </label>
        </form>

        <section className="rounded-2xl border border-line bg-white">
          <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
              <input
                value={saisie}
                onChange={(event) => setSaisie(event.target.value)}
                placeholder="Nom, e-mail, code"
                className="w-full rounded-full border border-line bg-paper py-2.5 pr-4 pl-9 outline-none ring-red/20 focus:ring-4"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {FILTRES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setPage(0)
                    setFiltre(item.id)
                  }}
                  className={
                    filtre === item.id
                      ? 'rounded-full bg-red px-3 py-1.5 text-sm font-medium text-white'
                      : 'rounded-full border border-line px-3 py-1.5 text-sm font-medium'
                  }
                >
                  {item.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setAjout((ouvert) => !ouvert)}
                className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-sm font-medium hover:border-red/40"
              >
                <UserPlus className="size-4" />
                Ajouter
              </button>
              <button
                type="button"
                onClick={() => void exporter()}
                disabled={exportEnCours}
                className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-sm font-medium hover:border-red/40 disabled:opacity-60"
              >
                <Download className="size-4" />
                {exportEnCours ? 'Export…' : 'Excel'}
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 border-b border-line px-4 py-3">
            <span className="self-center text-xs font-semibold uppercase tracking-[0.14em] text-muted">Date</span>
            <button
              type="button"
              onClick={() => {
                setPage(0)
                setJour('toutes')
              }}
              className={
                jour === 'toutes'
                  ? 'rounded-full bg-ink px-3 py-1.5 text-sm font-medium text-white'
                  : 'rounded-full border border-line px-3 py-1.5 text-sm font-medium'
              }
            >
              Toutes
            </button>
            {joursDispo.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setPage(0)
                  setJour(item)
                }}
                className={
                  jour === item
                    ? 'rounded-full bg-ink px-3 py-1.5 text-sm font-medium text-white'
                    : 'rounded-full border border-line px-3 py-1.5 text-sm font-medium'
                }
              >
                {item}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 border-b border-line px-4 py-3">
            <span className="self-center text-xs font-semibold uppercase tracking-[0.14em] text-muted">Profil</span>
            <button
              type="button"
              onClick={() => {
                setPage(0)
                setProfil('tous')
              }}
              className={
                profil === 'tous'
                  ? 'rounded-full bg-ink px-3 py-1.5 text-sm font-medium text-white'
                  : 'rounded-full border border-line px-3 py-1.5 text-sm font-medium'
              }
            >
              Tous
            </button>
            {PROFILS.map((entree) => (
              <button
                key={entree.valeur}
                type="button"
                onClick={() => {
                  setPage(0)
                  setProfil(entree.valeur)
                }}
                className={
                  profil === entree.valeur
                    ? 'rounded-full bg-ink px-3 py-1.5 text-sm font-medium text-white'
                    : 'rounded-full border border-line px-3 py-1.5 text-sm font-medium'
                }
              >
                {entree.libelle}
              </button>
            ))}
          </div>
          {ajout && (
            <div className="border-b border-line p-4">
              <AjoutParticipant
                onCree={() => {
                  void charger()
                  void chargerStats()
                }}
              />
            </div>
          )}

          <div className={`overflow-x-auto ${listeEnCours ? 'opacity-60' : ''}`}>
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.14em] text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Code</th>
                  <th className="px-4 py-3 font-semibold">Participant</th>
                  <th className="px-4 py-3 font-semibold">Contact</th>
                  <th className="px-4 py-3 font-semibold">Statut</th>
                  <th className="px-4 py-3 font-semibold">Inscrit le</th>
                  <th className="px-4 py-3 font-semibold">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((ligne) => (
                  <tr key={ligne.id} className="border-t border-line hover:bg-paper">
                    <td className="px-4 py-3 font-semibold tracking-wide">
                      <Link to={`/admin/participants/${ligne.id}`} className="text-red">
                        {ligne.code}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{nomComplet(ligne)}</p>
                      <p className="text-muted">
                        {[libelleProfil(ligne.profil), libelleDates(ligne.dates, joursDispo)].filter(Boolean).join(' · ') ||
                          ligne.organisation ||
                          ligne.fonction ||
                          '—'}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p>{ligne.email}</p>
                      <p className="text-muted">{ligne.telephone || '—'}</p>
                    </td>
                    <td className="px-4 py-3">{LIBELLE_STATUT[ligne.statut]}</td>
                    <td className="px-4 py-3 text-muted">{formatQuand(ligne.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void supprimer(ligne)}
                        aria-label={`Supprimer ${nomComplet(ligne)}`}
                        className="rounded-full p-2 text-muted hover:bg-red/10 hover:text-red"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {lignes.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted">
                      Aucun participant.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm">
            <span className="text-muted">
              {total} inscription{total > 1 ? 's' : ''}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage((n) => Math.max(0, n - 1))}
                className="rounded-full border border-line px-3 py-1.5 disabled:opacity-40"
              >
                Précédent
              </button>
              <span>
                {page + 1} / {pages}
              </span>
              <button
                type="button"
                disabled={page + 1 >= pages}
                onClick={() => setPage((n) => n + 1)}
                className="rounded-full border border-line px-3 py-1.5 disabled:opacity-40"
              >
                Suivant
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
