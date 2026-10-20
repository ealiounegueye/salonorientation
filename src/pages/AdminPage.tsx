import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Download, Search } from 'lucide-react'
import { AppHeader } from '../components/AppHeader'
import { useAuth } from '../context/AuthContext'
import { exporterCsv, filtreRecherche, formatQuand, LIBELLE_STATUT, nomComplet } from '../lib/format'
import { supabase } from '../lib/supabase'
import type { Participant, StatutParticipant } from '../types'

const PAGE = 50
const FILTRES: Array<{ id: 'tous' | StatutParticipant; label: string }> = [
  { id: 'tous', label: 'Tous' },
  { id: 'inscrit', label: 'Inscrits' },
  { id: 'present', label: 'Présents' },
  { id: 'annule', label: 'Annulés' },
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
  const [page, setPage] = useState(0)
  const [code, setCode] = useState('')
  const [flash, setFlash] = useState<string | null>(null)
  const [flashOk, setFlashOk] = useState(true)
  const [exportEnCours, setExportEnCours] = useState(false)

  const charger = useCallback(async () => {
    const filtreTexte = filtreRecherche(recherche)
    let liste = supabase
      .from('participants')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
    if (filtre !== 'tous') liste = liste.eq('statut', filtre)
    if (filtreTexte) liste = liste.or(filtreTexte)

    const [pageRes, volumeRes, presentsRes, campagneRes] = await Promise.all([
      liste.range(page * PAGE, page * PAGE + PAGE - 1),
      supabase.from('participants').select('*', { count: 'exact', head: true }),
      supabase.from('participants').select('*', { count: 'exact', head: true }).eq('statut', 'present'),
      supabase.from('campagne').select('ouverte').eq('id', 1).maybeSingle(),
    ])
    setLignes((pageRes.data ?? []) as Participant[])
    setTotal(pageRes.count ?? 0)
    setVolume(volumeRes.count ?? 0)
    setPresents(presentsRes.count ?? 0)
    if (campagneRes.data) setOuverts(Boolean(campagneRes.data.ouverte))
  }, [filtre, page, recherche])

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

  async function basculerCampagne() {
    const suivante = !ouverts
    const { error } = await supabase.from('campagne').update({ ouverte: suivante }).eq('id', 1)
    if (!error) setOuverts(suivante)
  }

  async function pointer(event: FormEvent) {
    event.preventDefault()
    const valeur = code.trim().toUpperCase()
    setCode('')
    if (!valeur) return
    const { data } = await supabase.from('participants').select('*').eq('code', valeur).maybeSingle()
    const participant = data as Participant | null
    if (!participant) {
      setFlashOk(false)
      setFlash('Code introuvable.')
      return
    }
    if (participant.statut === 'annule') {
      setFlashOk(false)
      setFlash(`${nomComplet(participant)} — inscription annulée.`)
      return
    }
    if (participant.statut !== 'present') {
      await supabase.from('participants').update({ statut: 'present' }).eq('id', participant.id)
      void charger()
    }
    setFlashOk(true)
    setFlash(`${nomComplet(participant)} — présent`)
  }

  async function exporter() {
    setExportEnCours(true)
    const toutes: Participant[] = []
    const filtreTexte = filtreRecherche(recherche)
    for (let from = 0; from < 20000; from += 1000) {
      let requete = supabase.from('participants').select('*').order('created_at', { ascending: false })
      if (filtre !== 'tous') requete = requete.eq('statut', filtre)
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
        <section className="grid gap-3 sm:grid-cols-3">
          <article className="rounded-2xl border border-line bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Inscriptions</p>
            <p className="mt-1 text-3xl font-semibold">{volume}</p>
          </article>
          <article className="rounded-2xl border border-line bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Présents</p>
            <p className="mt-1 text-3xl font-semibold text-green">{presents}</p>
          </article>
          <article className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4">
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
            <span className="mb-1.5 block text-sm font-medium">Pointage — scanner ou saisir le code</span>
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="SLN-XXXXXX"
              className="w-full rounded-2xl border border-line bg-paper px-4 py-3 font-semibold tracking-[0.14em] outline-none ring-red/20 focus:ring-4"
            />
          </label>
          {flash && <p className={`mt-3 text-sm font-medium ${flashOk ? 'text-green' : 'text-red'}`}>{flash}</p>}
        </form>

        <section className="rounded-2xl border border-line bg-white">
          <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
              <input
                value={saisie}
                onChange={(event) => setSaisie(event.target.value)}
                placeholder="Nom, e-mail, code, organisation"
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
                onClick={() => void exporter()}
                disabled={exportEnCours}
                className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-sm font-medium hover:border-red/40 disabled:opacity-60"
              >
                <Download className="size-4" />
                {exportEnCours ? 'Export…' : 'Excel'}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.14em] text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Code</th>
                  <th className="px-4 py-3 font-semibold">Participant</th>
                  <th className="px-4 py-3 font-semibold">Contact</th>
                  <th className="px-4 py-3 font-semibold">Statut</th>
                  <th className="px-4 py-3 font-semibold">Inscrit le</th>
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
                      <p className="text-muted">{ligne.organisation || ligne.fonction || '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p>{ligne.email}</p>
                      <p className="text-muted">{ligne.telephone || '—'}</p>
                    </td>
                    <td className="px-4 py-3">{LIBELLE_STATUT[ligne.statut]}</td>
                    <td className="px-4 py-3 text-muted">{formatQuand(ligne.created_at)}</td>
                  </tr>
                ))}
                {lignes.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted">
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
