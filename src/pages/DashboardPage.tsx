import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, FileSpreadsheet, FileText, ScanLine, Users } from 'lucide-react'
import { AppHeader } from '../components/AppHeader'
import { useAuth } from '../context/AuthContext'
import { calculerStats, type StatsSalon } from '../lib/stats'
import { chargerParticipants, exporterCsv, exporterExcel, exporterPdf } from '../lib/export'
import { lireParametres } from '../lib/parametres'
import { supabase } from '../lib/supabase'
function graduationsBarres(max: number) {
  if (max <= 5) return Array.from({ length: max + 1 }, (_, i) => max - i)
  const palier = Math.max(1, Math.ceil(max / 5))
  const plafond = Math.ceil(max / palier) * palier
  const ticks: number[] = []
  for (let v = plafond; v >= 0; v -= palier) ticks.push(v)
  return ticks
}

type EntreeBarres = { cle: string; libelle: string; couleur: string; count: number }

function BarresColonnes({ data }: { data: EntreeBarres[] }) {
  const max = Math.max(1, ...data.map((d) => d.count))
  const graduations = graduationsBarres(max)
  const plafond = graduations[0] ?? max
  const colonnes = Math.max(1, data.length)

  return (
    <div className="mt-4">
      <div className="flex gap-3">
        <div className="flex w-8 shrink-0 flex-col justify-between py-1 text-right text-xs text-muted">
          {graduations.map((tick) => (
            <span key={tick}>{tick}</span>
          ))}
        </div>
        <div className="relative min-h-[220px] flex-1">
          <div className="absolute inset-0 flex flex-col justify-between">
            {graduations.map((tick) => (
              <div key={tick} className="border-t border-line/80" />
            ))}
          </div>
          <div className="relative flex h-[220px] items-end justify-around gap-4 px-2">
            {data.map((entree) => {
              const hauteurPx = entree.count > 0 ? Math.max(12, Math.round((entree.count / plafond) * 180)) : 0
              return (
                <div key={entree.cle} className="flex min-w-0 flex-1 flex-col items-center justify-end">
                  <p className="mb-1 text-sm font-semibold text-ink">{entree.count}</p>
                  <div
                    className="w-full max-w-[4.5rem] rounded-t-lg transition-all"
                    style={{ height: `${hauteurPx}px`, backgroundColor: entree.couleur }}
                    title={`${entree.libelle} : ${entree.count}`}
                  />
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <div
        className="ml-11 grid gap-2 text-center text-xs text-muted"
        style={{ gridTemplateColumns: `repeat(${colonnes}, minmax(0, 1fr))` }}
      >
        {data.map((entree) => (
          <p key={entree.cle}>{entree.libelle}</p>
        ))}
      </div>
    </div>
  )
}

function Barre({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-paper">
        <div className="h-full rounded-full bg-red transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function CarteKpi({ titre, valeur, detail, accent }: { titre: string; valeur: string | number; detail?: string; accent?: boolean }) {
  return (
    <article className="rounded-2xl border border-line bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">{titre}</p>
      <p className={`mt-1 text-3xl font-semibold ${accent ? 'text-green' : ''}`}>{valeur}</p>
      {detail ? <p className="mt-1 text-xs text-muted">{detail}</p> : null}
    </article>
  )
}

export function DashboardPage() {
  const { configured } = useAuth()
  const [stats, setStats] = useState<StatsSalon | null>(null)
  const [ouverts, setOuverts] = useState(true)
  const [jours, setJours] = useState<string[]>(['18', '19', '20'])
  const [chargement, setChargement] = useState(true)
  const [exportEnCours, setExportEnCours] = useState(false)

  const charger = useCallback(async () => {
    setChargement(true)
    const [liste, salon, campagne] = await Promise.all([
      chargerParticipants(),
      lireParametres(true),
      supabase.from('campagne').select('ouverte').eq('id', 1).maybeSingle(),
    ])
    setJours(salon.jours)
    if (campagne.data) setOuverts(Boolean(campagne.data.ouverte))
    setStats(calculerStats(liste, salon.jours))
    setChargement(false)
  }, [])

  useEffect(() => {
    if (!configured) return
    void charger()
  }, [charger, configured])

  async function basculerCampagne() {
    const suivante = !ouverts
    const { error } = await supabase.from('campagne').update({ ouverte: suivante }).eq('id', 1)
    if (!error) setOuverts(suivante)
  }

  async function exportFormat(format: 'csv' | 'xlsx' | 'pdf') {
    setExportEnCours(true)
    const liste = await chargerParticipants()
    const st = calculerStats(liste, jours)
    if (format === 'csv') exporterCsv(liste)
    else if (format === 'xlsx') exporterExcel(liste)
    else exporterPdf(liste, st)
    setExportEnCours(false)
  }

  const maxProfil = stats ? Math.max(1, ...stats.parProfil.map((p) => p.count)) : 1
  const maxSexe = stats ? Math.max(1, ...stats.parSexe.map((p) => p.count)) : 1
  const maxDate = stats ? Math.max(1, ...stats.parDate.map((d) => d.count)) : 1

  return (
    <div>
      <AppHeader subtitle="Tableau de bord" />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6">
        <section className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">Exports</p>
            <p className="text-xs text-muted">Liste complète des inscriptions (Excel, PDF ou CSV).</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={exportEnCours || chargement}
              onClick={() => void exportFormat('xlsx')}
              className="inline-flex items-center gap-2 rounded-full bg-red px-4 py-2 text-sm font-semibold text-white hover:bg-red-dark disabled:opacity-60"
            >
              <FileSpreadsheet className="size-4" />
              Excel
            </button>
            <button
              type="button"
              disabled={exportEnCours || chargement}
              onClick={() => void exportFormat('pdf')}
              className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-semibold hover:border-red/40 disabled:opacity-60"
            >
              <FileText className="size-4" />
              PDF
            </button>
            <button
              type="button"
              disabled={exportEnCours || chargement}
              onClick={() => void exportFormat('csv')}
              className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-medium hover:border-red/40 disabled:opacity-60"
            >
              <Download className="size-4" />
              CSV
            </button>
          </div>
        </section>

        <section className="flex flex-col gap-3 sm:flex-row">
          <Link
            to="/admin/participants"
            className="flex flex-1 items-center gap-3 rounded-2xl border border-line bg-white p-4 hover:border-red/30"
          >
            <span className="flex size-11 items-center justify-center rounded-full bg-red/10 text-red">
              <ScanLine className="size-5" />
            </span>
            <div>
              <p className="font-semibold">Participants & scan</p>
              <p className="text-sm text-muted">Liste, QR code, ajout manuel</p>
            </div>
          </Link>
          <article className="flex flex-1 items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-full bg-green/10 text-green">
                <Users className="size-5" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Campagne</p>
                <p className="font-semibold">{ouverts ? 'Inscriptions ouvertes' : 'Inscriptions fermées'}</p>
              </div>
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

        {chargement && <p className="text-center text-sm text-muted">Chargement des indicateurs…</p>}

        {stats && !chargement && (
          <>
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <CarteKpi titre="Inscriptions actives" valeur={stats.actifs} detail={`${stats.total} au total (historique)`} />
              <CarteKpi titre="Présents" valeur={stats.presents} accent />
              <CarteKpi titre="Taux de présence" valeur={`${stats.tauxPresence}%`} detail={`${stats.inscrits} encore inscrits`} />
              <CarteKpi
                titre="Aujourd’hui"
                valeur={stats.inscriptionsAujourdhui}
                detail={stats.ageMoyen != null ? `Âge moyen : ${stats.ageMoyen} ans` : undefined}
              />
            </section>

            {stats.annules > 0 && (
              <p className="text-sm text-muted">
                {stats.annules} inscription{stats.annules > 1 ? 's' : ''} annulée{stats.annules > 1 ? 's' : ''}.
              </p>
            )}

            <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <article className="rounded-2xl border border-line bg-white p-4">
                <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">Par profil</h2>
                <div className="mt-4 space-y-3">
                  {stats.parProfil.map((entree) => (
                    <Barre key={entree.valeur} label={entree.libelle} value={entree.count} max={maxProfil} />
                  ))}
                </div>
              </article>
              <article className="rounded-2xl border border-line bg-white p-4">
                <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">Par sexe</h2>
                <div className="mt-4 space-y-3">
                  {stats.parSexe.map((entree) => (
                    <Barre key={entree.valeur} label={entree.libelle} value={entree.count} max={maxSexe} />
                  ))}
                </div>
              </article>
              <article className="rounded-2xl border border-line bg-white p-4 md:col-span-2 lg:col-span-1">
                <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">Par date de venue</h2>
                <p className="mt-1 text-xs text-muted">
                  {stats.actifs} inscription{stats.actifs > 1 ? 's' : ''} active{stats.actifs > 1 ? 's' : ''} · un
                  participant peut choisir plusieurs jours.
                </p>
                <div className="mt-4 space-y-3">
                  {stats.parDate.map((entree) => (
                    <Barre key={entree.jour} label={entree.libelle} value={entree.count} max={maxDate} />
                  ))}
                </div>
              </article>
            </section>

            <section className="rounded-2xl border border-line bg-white p-4">
              <h2 className="text-base font-semibold text-ink">Répartition par tranche d&apos;âge</h2>
              {stats.agesRenseignes === 0 ? (
                <p className="mt-3 text-sm text-muted">Aucun âge renseigné pour le moment.</p>
              ) : (
                <>
                  <BarresColonnes
                    data={stats.parAge.map((entree) => ({
                      cle: entree.id,
                      libelle: entree.libelle,
                      couleur: entree.couleur,
                      count: entree.count,
                    }))}
                  />
                  <p className="mt-2 text-xs text-muted">
                    {stats.agesRenseignes} participant{stats.agesRenseignes > 1 ? 's' : ''} avec âge renseigné
                    {stats.actifs > stats.agesRenseignes
                      ? ` · ${stats.actifs - stats.agesRenseignes} sans âge`
                      : ''}
                    .
                  </p>
                </>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  )
}
