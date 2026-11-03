import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, FileSpreadsheet, FileText, ScanLine, Search, Trash2, UserPlus, Users } from 'lucide-react'
import { AjoutParticipant } from '../components/AjoutParticipant'
import { AppHeader } from '../components/AppHeader'
import { BoiteConfirmation } from '../components/BoiteConfirmation'
import { ScanPresence } from '../components/ScanPresence'
import { useAuth } from '../context/AuthContext'
import {
  estBackoffice,
  peutAjouterParticipant,
  peutExporterParticipants,
  peutSupprimerParticipant,
} from '../lib/permissions'
import { chargerParticipants, exporterExcel, exporterPdf } from '../lib/export'
import { calculerStats } from '../lib/stats'
import {
  extraireCode,
  filtreRecherche,
  formatQuand,
  formatQuandCourt,
  JOURS,
  libelleDates,
  libelleProfil,
  libelleStatutParticipant,
  nomComplet,
  PROFILS,
} from '../lib/format'
import { demanderAccesCamera } from '../lib/camera'
import {
  jourPointageScan,
  joursPresentsApresScan,
  libelleJourSalon,
  normaliserJoursPresents,
} from '../lib/presence'
import { lireParametres } from '../lib/parametres'
import { supabase } from '../lib/supabase'
import type { Participant, StatutParticipant } from '../types'

const PAGE = 10
type FiltreListe = 'tous' | StatutParticipant | 'sur_place'
const FILTRES: Array<{ id: FiltreListe; label: string; court?: string }> = [
  { id: 'tous', label: 'Tous' },
  { id: 'inscrit', label: 'Inscrits' },
  { id: 'present', label: 'Présents' },
  { id: 'sur_place', label: 'Enregistrés sur place', court: 'Sur place' },
]

const puceFiltre = (actif: boolean) =>
  actif
    ? 'shrink-0 whitespace-nowrap rounded-full bg-red px-2.5 py-1.5 text-xs font-medium text-white sm:px-3 sm:py-2 sm:text-sm'
    : 'shrink-0 whitespace-nowrap rounded-full border border-line px-2.5 py-1.5 text-xs font-medium sm:px-3 sm:py-2 sm:text-sm'

const puceFiltreDate = (actif: boolean) =>
  actif
    ? 'shrink-0 whitespace-nowrap rounded-full bg-ink px-2.5 py-1.5 text-xs font-medium text-white sm:px-3 sm:py-2 sm:text-sm'
    : 'shrink-0 whitespace-nowrap rounded-full border border-line px-2.5 py-1.5 text-xs font-medium sm:px-3 sm:py-2 sm:text-sm'

const PROFIL_FILTRE_COURT: Record<string, string> = {
  professionnel: 'Pro',
  etudiant: 'Étud.',
  chercheur: 'Emploi',
  visiteur: 'Visiteur',
}

export function AdminPage() {
  const { configured, profile } = useAuth()
  const peutSupprimer = peutSupprimerParticipant(profile?.role)
  const peutExporter = peutExporterParticipants(profile?.role)
  const peutAjouter = peutAjouterParticipant(profile?.role)
  const peutForcerJourPointage = estBackoffice(profile?.role)
  const [lignes, setLignes] = useState<Participant[]>([])
  const [total, setTotal] = useState(0)
  const [recherche, setRecherche] = useState('')
  const [saisie, setSaisie] = useState('')
  const [filtre, setFiltre] = useState<FiltreListe>('tous')
  const [joursDispo, setJoursDispo] = useState<string[]>([...JOURS])
  const [correctionJour, setCorrectionJour] = useState(false)
  const [jourScanManuel, setJourScanManuel] = useState('')
  const [horloge, setHorloge] = useState(() => Date.now())
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
  const [demandeCamera, setDemandeCamera] = useState(false)
  const recents = useRef(new Map<string, number>())
  const requeteListe = useRef(0)
  const son = useRef<AudioContext | null>(null)
  const flashTimer = useRef<number | null>(null)
  const [aSupprimer, setASupprimer] = useState<Participant | null>(null)

  useEffect(() => {
    if (!configured) return
    void lireParametres(true).then((salon) => {
      setJoursDispo(salon.jours)
      setJourScanManuel(salon.jours[0] ?? '')
    })
  }, [configured])

  useEffect(() => {
    const id = window.setInterval(() => setHorloge(Date.now()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  const jourPointage = useMemo(() => {
    void horloge
    const override = correctionJour && peutForcerJourPointage ? jourScanManuel : null
    return jourPointageScan(joursDispo, override)
  }, [correctionJour, horloge, jourScanManuel, joursDispo, peutForcerJourPointage])

  const charger = useCallback(async () => {
    const ticket = ++requeteListe.current
    setListeEnCours(true)
    const filtreTexte = filtreRecherche(recherche)
    let liste = supabase
      .from('participants')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
    if (filtre === 'sur_place') liste = liste.eq('sur_place', true)
    else if (filtre !== 'tous') liste = liste.eq('statut', filtre)
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

  async function marquerPresent(brut: string) {
    const valeur = extraireCode(brut)
    if (!valeur) {
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
    const jourCourant = jourPointageScan(joursDispo, correctionJour && peutForcerJourPointage ? jourScanManuel : null)
    if (!jourCourant) {
      signaler(false, 'Pointage impossible : aujourd’hui n’est pas un jour du salon (heure Dakar).')
      recents.current.delete(valeur)
      return
    }
    const jourPointage = jourCourant

    const avant = normaliserJoursPresents(participant.jours_presents)
    const dejaCeJour = avant.includes(jourPointage)
    const joursPresents = joursPresentsApresScan(avant, jourPointage)

    if (!dejaCeJour || participant.statut !== 'present') {
      const { error } = await supabase
        .from('participants')
        .update({ statut: 'present', jours_presents: joursPresents })
        .eq('id', participant.id)
      if (error) {
        signaler(false, 'Le pointage n’a pas abouti.')
        recents.current.delete(valeur)
        return
      }
      void charger()
    }

    const suffixeJour = ` · ${jourPointage} nov.`
    signaler(true, dejaCeJour ? `Déjà pointé${suffixeJour} — ${nomComplet(participant)}` : `Scanné${suffixeJour} — ${nomComplet(participant)}`)
    navigator.vibrate?.(40)
  }

  async function pointer(event: FormEvent) {
    event.preventDefault()
    const valeur = code.trim()
    setCode('')
    if (!valeur) return
    await marquerPresent(valeur)
  }

  async function confirmerSuppression() {
    const participant = aSupprimer
    if (!participant) return
    setASupprimer(null)
    const { error } = await supabase.from('participants').delete().eq('id', participant.id)
    if (error) {
      signaler(false, 'La suppression n’a pas abouti.')
      return
    }
    signaler(true, `${nomComplet(participant)} — inscription supprimée.`)
    if (lignes.length === 1 && page > 0) setPage((n) => Math.max(0, n - 1))
    else void charger()
  }

  async function exporter(format: 'xlsx' | 'pdf') {
    setExportEnCours(true)
    const toutes = await chargerParticipants({
      statut: filtre === 'sur_place' ? 'tous' : filtre,
      surPlace: filtre === 'sur_place',
      profil,
      jour,
      recherche,
    })
    const stats = calculerStats(toutes, joursDispo)
    if (format === 'xlsx') exporterExcel(toutes)
    else exporterPdf(toutes, stats)
    setExportEnCours(false)
  }

  const pages = Math.max(1, Math.ceil(total / PAGE))

  return (
    <div>
      <AppHeader subtitle="Participants" />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-3 py-4 sm:px-6 sm:py-6">
        <section className="rounded-2xl border border-line bg-white p-4">
          <div className="mb-3 rounded-2xl border border-line bg-paper/80 px-4 py-3">
            <p className="text-sm font-medium text-ink">Jour de pointage</p>
            {jourPointage ? (
              <p className="mt-1 text-lg font-semibold text-red">
                {libelleJourSalon(jourPointage)}
                {!correctionJour || !peutForcerJourPointage ? (
                  <span className="ml-2 text-sm font-normal text-muted">(automatique · Dakar)</span>
                ) : (
                  <span className="ml-2 text-sm font-normal text-muted">(correction admin)</span>
                )}
              </p>
            ) : (
              <p className="mt-1 text-sm font-medium text-red">
                Aujourd’hui n’est pas un jour du salon — scan indisponible (heure Dakar).
              </p>
            )}
            <p className="mt-1 text-xs text-muted">Chaque scan enregistre la présence pour ce jour uniquement.</p>
            {peutForcerJourPointage && (
              <div className="mt-3 border-t border-line pt-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={correctionJour}
                    onChange={(event) => setCorrectionJour(event.target.checked)}
                    className="size-4 accent-red"
                  />
                  Forcer un autre jour (admin)
                </label>
                {correctionJour && (
                  <select
                    value={jourScanManuel}
                    onChange={(event) => setJourScanManuel(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-2.5 text-sm font-medium outline-none ring-red/20 focus:ring-4 sm:max-w-xs"
                  >
                    {joursDispo.map((item) => (
                      <option key={item} value={item}>
                        {libelleJourSalon(item)}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            disabled={demandeCamera || !jourPointage}
            onClick={() => {
              preparerSon()
              if (camera) {
                setCamera(false)
                return
              }
              setDemandeCamera(true)
              void demanderAccesCamera().then((acces) => {
                setDemandeCamera(false)
                if (!acces.ok) {
                  signaler(false, acces.message)
                  return
                }
                setCamera(true)
              })
            }}
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-red py-4 text-base font-semibold text-white hover:bg-red-dark disabled:opacity-70 sm:py-5 sm:text-lg"
          >
            <ScanLine className="size-6" />
            {demandeCamera ? 'Autorisation caméra…' : camera ? 'Arrêter le scan' : 'Scanner un QR code'}
          </button>
          <ScanPresence actif={camera} onCode={(valeur) => void marquerPresent(valeur)} />
          {flash && (
            <p
              className={`mt-3 text-balance text-center text-base font-semibold break-words sm:text-lg ${flashOk ? 'text-green' : 'text-red'}`}
              role="status"
            >
              {flash}
            </p>
          )}
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
              placeholder="Code du badge"
              autoComplete="off"
              onFocus={preparerSon}
              className="w-full rounded-2xl border border-line bg-paper px-4 py-3 font-mono text-sm font-semibold outline-none ring-red/20 focus:ring-4"
            />
          </label>
        </form>

        <section className="overflow-hidden rounded-2xl border border-line bg-white">
          <div className="flex flex-col gap-3 border-b border-line p-3 sm:p-4">
            <div className="relative min-w-0 w-full">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
              <input
                value={saisie}
                onChange={(event) => setSaisie(event.target.value)}
                placeholder="Nom, e-mail, code"
                className="w-full rounded-full border border-line bg-paper py-2.5 pr-4 pl-9 outline-none ring-red/20 focus:ring-4"
              />
            </div>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
              <div className="flex flex-wrap items-center gap-2">
                {FILTRES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setPage(0)
                      setFiltre(item.id)
                    }}
                    className={puceFiltre(filtre === item.id)}
                  >
                    {item.court ? (
                      <>
                        <span className="md:hidden">{item.court}</span>
                        <span className="hidden md:inline">{item.label}</span>
                      </>
                    ) : (
                      item.label
                    )}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2 md:shrink-0 md:justify-end">
                {peutAjouter && (
                  <button
                    type="button"
                    onClick={() => setAjout((ouvert) => !ouvert)}
                    className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-line px-3 py-2 text-sm font-medium hover:border-red/40"
                  >
                    <UserPlus className="size-4" />
                    Ajouter
                  </button>
                )}
                {peutExporter && (
                  <>
                    <button
                      type="button"
                      onClick={() => void exporter('xlsx')}
                      disabled={exportEnCours}
                      className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-line px-3 py-2 text-sm font-medium hover:border-red/40 disabled:opacity-60"
                    >
                      <FileSpreadsheet className="size-4" />
                      {exportEnCours ? 'Export…' : 'Excel'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void exporter('pdf')}
                      disabled={exportEnCours}
                      className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-line px-3 py-2 text-sm font-medium hover:border-red/40 disabled:opacity-60"
                    >
                      <FileText className="size-4" />
                      PDF
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="border-b border-line px-3 py-3 sm:px-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-line bg-paper px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted sm:px-3 sm:text-xs sm:tracking-[0.14em]">
                <CalendarDays className="size-3.5 shrink-0 text-red sm:size-4" aria-hidden />
                Date
              </span>
              <button
                type="button"
                onClick={() => {
                  setPage(0)
                  setJour('toutes')
                }}
                className={puceFiltreDate(jour === 'toutes')}
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
                  className={puceFiltreDate(jour === item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div className="border-b border-line px-3 py-3 sm:px-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex w-full shrink-0 items-center gap-2 rounded-full border border-line bg-paper px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted sm:w-auto sm:px-3 sm:text-xs sm:tracking-[0.14em]">
                <Users className="size-3.5 shrink-0 text-green sm:size-4" aria-hidden />
                Profils
              </span>
              <button
                type="button"
                onClick={() => {
                  setPage(0)
                  setProfil('tous')
                }}
                className={puceFiltreDate(profil === 'tous')}
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
                  className={puceFiltreDate(profil === entree.valeur)}
                >
                  <span className="sm:hidden">{PROFIL_FILTRE_COURT[entree.valeur] ?? entree.libelle}</span>
                  <span className="hidden sm:inline">{entree.libelle}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="h-0.5 bg-green" role="presentation" aria-hidden />
          {ajout && (
            <div className="border-b border-line p-4">
              <AjoutParticipant
                onCree={() => void charger()}
              />
            </div>
          )}

          <div className={`min-w-0 overflow-x-auto ${listeEnCours ? 'opacity-60' : ''}`}>
            <table className="w-full table-fixed text-left text-xs sm:text-sm">
              <thead className="text-[9px] uppercase tracking-[0.1em] text-muted sm:text-xs sm:tracking-[0.14em]">
                <tr className="border-b border-line">
                  <th className="w-[24%] px-1 py-2 font-semibold md:w-[6.5rem] sm:px-4 sm:py-3">Code</th>
                  <th className="w-[27%] min-w-0 px-1 py-2 font-semibold md:w-auto sm:px-4 sm:py-3">Participant</th>
                  <th className="hidden w-[18%] px-4 py-3 font-semibold md:table-cell">Contact</th>
                  <th className="w-[15%] px-0.5 py-2 font-semibold md:w-[7rem] sm:px-4 sm:py-3">Statut</th>
                  <th className="w-[26%] px-0.5 py-2 font-semibold leading-tight md:w-auto sm:px-4 sm:py-3">Inscrit le</th>
                  <th className="w-[8%] px-0 py-2 sm:w-12 sm:px-4 sm:py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((ligne) => (
                  <tr key={ligne.id} className="border-t border-line hover:bg-paper">
                    <td className="px-1 py-2 align-top sm:px-4 sm:py-3">
                      <Link
                        to={`/admin/participants/${ligne.id}`}
                        className="block break-all font-mono text-[10px] leading-tight font-semibold text-red sm:text-xs"
                        title={ligne.code}
                      >
                        {ligne.code}
                      </Link>
                    </td>
                    <td className="px-1.5 py-2 align-top sm:px-4 sm:py-3">
                      <Link to={`/admin/participants/${ligne.id}`} className="block min-w-0">
                        <p className="truncate font-medium leading-snug" title={nomComplet(ligne)}>
                          {nomComplet(ligne)}
                        </p>
                        <div className="mt-1 space-y-0.5 text-[10px] leading-snug text-muted sm:text-[11px]">
                          {libelleProfil(ligne.profil) ? (
                            <p className="flex min-w-0 items-center gap-1">
                              <Users className="size-3 shrink-0 text-green" aria-hidden />
                              <span className="truncate">{libelleProfil(ligne.profil)}</span>
                            </p>
                          ) : null}
                          {libelleDates(ligne.dates, joursDispo) ? (
                            <p className="flex min-w-0 items-center gap-1">
                              <CalendarDays className="size-3 shrink-0 text-red" aria-hidden />
                              <span className="truncate">{libelleDates(ligne.dates, joursDispo)}</span>
                            </p>
                          ) : null}
                        </div>
                      </Link>
                    </td>
                    <td className="hidden px-4 py-3 align-top md:table-cell">
                      <p className="truncate">{ligne.email}</p>
                      <p className="truncate text-muted">{ligne.telephone || '—'}</p>
                    </td>
                    <td className="px-0.5 py-2 align-top sm:px-4 sm:py-3">
                      <span
                        className="line-clamp-4 text-[9px] font-medium leading-snug sm:line-clamp-3 sm:text-sm"
                        title={libelleStatutParticipant(ligne, joursDispo)}
                      >
                        {libelleStatutParticipant(ligne, joursDispo)}
                      </span>
                    </td>
                    <td className="px-0.5 py-2 align-top sm:px-4 sm:py-3">
                      <span
                        className="line-clamp-4 text-[9px] leading-snug text-muted sm:line-clamp-2 sm:text-sm"
                        title={formatQuand(ligne.created_at)}
                      >
                        <span className="md:hidden">{formatQuandCourt(ligne.created_at)}</span>
                        <span className="hidden md:inline">{formatQuand(ligne.created_at)}</span>
                      </span>
                    </td>
                    <td className="px-1 py-2 text-right align-top sm:px-4 sm:py-3">
                      {peutSupprimer && (
                        <button
                          type="button"
                          onClick={() => setASupprimer(ligne)}
                          aria-label={`Supprimer ${nomComplet(ligne)}`}
                          className="rounded-full p-1 text-muted hover:bg-red/10 hover:text-red sm:p-2"
                        >
                          <Trash2 className="size-3.5 sm:size-4" />
                        </button>
                      )}
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

          <div className="flex flex-col gap-3 border-t border-line px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-4">
            <span className="text-center text-muted sm:text-left">
              {total} inscription{total > 1 ? 's' : ''}
            </span>
            <div className="flex items-center justify-center gap-2 sm:justify-end">
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
      <BoiteConfirmation
        ouverte={aSupprimer !== null}
        titre="Supprimer cette inscription ?"
        message={
          aSupprimer
            ? `L’inscription de ${nomComplet(aSupprimer)} (${aSupprimer.code}) sera définitivement effacée. Cette action est irréversible.`
            : ''
        }
        confirmerLabel="Supprimer"
        onConfirmer={() => void confirmerSuppression()}
        onAnnuler={() => setASupprimer(null)}
      />
    </div>
  )
}
