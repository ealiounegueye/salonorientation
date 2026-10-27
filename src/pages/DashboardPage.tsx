import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, FileSpreadsheet, FileText, ScanLine, Users } from 'lucide-react'
import { AppHeader } from '../components/AppHeader'
import { useAuth } from '../context/AuthContext'
import { calculerStats, type StatsSalon } from '../lib/stats'
import { chargerParticipants, exporterCsv, exporterExcel, exporterPdf } from '../lib/export'
import { lireParametres } from '../lib/parametres'
import { supabase } from '../lib/supabase'
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

            <section className="grid gap-4 md:grid-cols-2">
              <article className="rounded-2xl border border-line bg-white p-4">
                <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">Par profil</h2>
                <div className="mt-4 space-y-3">
                  {stats.parProfil.map((entree) => (
                    <Barre key={entree.valeur} label={entree.libelle} value={entree.count} max={maxProfil} />
                  ))}
                </div>
              </article>
              <article className="rounded-2xl border border-line bg-white p-4">
                <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">Par date de venue</h2>
                <div className="mt-4 space-y-3">
                  {stats.parDate.map((entree) => (
                    <Barre key={entree.jour} label={`${entree.jour} novembre`} value={entree.count} max={maxDate} />
                  ))}
                </div>
              </article>
            </section>
          </>
        )}
      </main>
    </div>
  )
}
