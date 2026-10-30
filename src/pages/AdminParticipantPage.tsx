import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AppHeader } from '../components/AppHeader'
import { BoiteConfirmation } from '../components/BoiteConfirmation'
import { InfosLieu } from '../components/InfosLieu'
import { QrBadge } from '../components/QrBadge'
import { renvoyerBadge } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { peutGererFicheParticipant, peutSupprimerParticipant } from '../lib/permissions'
import { formatQuand, libelleDates, libelleProfil, libelleSexe, LIBELLE_STATUT, nomComplet } from '../lib/format'
import { jourSalonDakar, joursPresentsApresScan, normaliserJoursPresents } from '../lib/presence'
import { lireParametres } from '../lib/parametres'
import { supabase } from '../lib/supabase'
import type { Participant, StatutParticipant } from '../types'

export function AdminParticipantPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const peutSupprimer = peutSupprimerParticipant(profile?.role)
  const peutGerer = peutGererFicheParticipant(profile?.role)
  const [participant, setParticipant] = useState<Participant | null>(null)
  const [introuvable, setIntrouvable] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)
  const [suppression, setSuppression] = useState(false)
  const [confirmSuppression, setConfirmSuppression] = useState(false)

  useEffect(() => {
    let cancelled = false
    void supabase
      .from('participants')
      .select('*')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        if (!data) {
          setIntrouvable(true)
          return
        }
        setParticipant(data as Participant)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  async function changerStatut(statut: StatutParticipant) {
    if (!participant) return
    let patch: { statut: StatutParticipant; jours_presents?: string[] } = { statut }
    if (statut === 'present') {
      const salon = await lireParametres(true)
      const jour = jourSalonDakar(salon.jours) ?? salon.jours[0]
      if (jour) {
        patch = {
          statut: 'present',
          jours_presents: joursPresentsApresScan(participant.jours_presents, jour),
        }
      }
    } else if (statut === 'inscrit') {
      patch = { statut: 'inscrit', jours_presents: [] }
    }
    const { data } = await supabase.from('participants').update(patch).eq('id', participant.id).select('*').single()
    if (data) setParticipant(data as Participant)
  }

  async function confirmerSuppression() {
    if (!participant || suppression) return
    setConfirmSuppression(false)
    setSuppression(true)
    setMessage(null)
    const { error } = await supabase.from('participants').delete().eq('id', participant.id)
    if (error) {
      setMessage('La suppression n’a pas abouti.')
      setSuppression(false)
      return
    }
    navigate('/admin/participants', { replace: true })
  }

  async function renvoyer() {
    if (!participant) return
    setEnvoi(true)
    setMessage(null)
    const resultat = await renvoyerBadge(participant.id)
    setMessage(resultat.message)
    if (resultat.emailEnvoye) {
      setParticipant({ ...participant, email_envoye_at: new Date().toISOString() })
    }
    setEnvoi(false)
  }

  return (
    <div>
      <AppHeader subtitle="Badge" />
      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        <Link to="/admin/participants" className="text-sm font-medium text-red">
          Retour aux participants
        </Link>

        {introuvable && <p className="mt-6 text-muted">Participant introuvable.</p>}

        {participant && (
          <div className="mt-4 grid gap-4 rounded-2xl border border-line bg-white p-6 sm:grid-cols-[auto_1fr]">
            <div>
              <QrBadge value={participant.code} />
              <InfosLieu className="mt-2" />
            </div>
            <div>
              <p className="font-mono text-sm font-semibold break-all text-red">{participant.code}</p>
              <h2 className="mt-1 text-2xl font-semibold">{nomComplet(participant)}</h2>
              <dl className="mt-4 space-y-1 text-sm">
                <div>
                  <dt className="inline text-muted">E-mail : </dt>
                  <dd className="inline">{participant.email}</dd>
                </div>
                <div>
                  <dt className="inline text-muted">Téléphone : </dt>
                  <dd className="inline">{participant.telephone || '—'}</dd>
                </div>
                <div>
                  <dt className="inline text-muted">Âge : </dt>
                  <dd className="inline">{participant.age ?? '—'}</dd>
                </div>
                <div>
                  <dt className="inline text-muted">Sexe : </dt>
                  <dd className="inline">{libelleSexe(participant.sexe) || '—'}</dd>
                </div>
                <div>
                  <dt className="inline text-muted">Profil : </dt>
                  <dd className="inline">{libelleProfil(participant.profil) || '—'}</dd>
                </div>
                <div>
                  <dt className="inline text-muted">Dates : </dt>
                  <dd className="inline">{libelleDates(participant.dates) || '—'}</dd>
                </div>
                <div>
                  <dt className="inline text-muted">Présence (scan) : </dt>
                  <dd className="inline">
                    {normaliserJoursPresents(participant.jours_presents).length
                      ? libelleDates(normaliserJoursPresents(participant.jours_presents).join(','))
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="inline text-muted">Statut : </dt>
                  <dd className="inline">{LIBELLE_STATUT[participant.statut]}</dd>
                </div>
                <div>
                  <dt className="inline text-muted">Inscrit le : </dt>
                  <dd className="inline">{formatQuand(participant.created_at)}</dd>
                </div>
                <div>
                  <dt className="inline text-muted">E-mail envoyé : </dt>
                  <dd className="inline">{formatQuand(participant.email_envoye_at)}</dd>
                </div>
              </dl>
              {message && <p className="mt-4 text-sm font-medium">{message}</p>}
              {peutGerer && (
                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={envoi || participant.statut === 'annule'}
                    onClick={() => void renvoyer()}
                    className="rounded-full bg-red px-4 py-2 text-sm font-semibold text-white hover:bg-red-dark disabled:opacity-50"
                  >
                    {envoi ? 'Envoi…' : 'Renvoyer le badge'}
                  </button>
                  {participant.statut !== 'present' && participant.statut !== 'annule' && (
                    <button type="button" onClick={() => void changerStatut('present')} className="rounded-full border border-line px-4 py-2 text-sm font-medium">
                      Marquer présent
                    </button>
                  )}
                  {participant.statut === 'present' && (
                    <button type="button" onClick={() => void changerStatut('inscrit')} className="rounded-full border border-line px-4 py-2 text-sm font-medium">
                      Annuler le pointage
                    </button>
                  )}
                  {participant.statut !== 'annule' ? (
                    <button type="button" onClick={() => void changerStatut('annule')} className="rounded-full border border-line px-4 py-2 text-sm font-medium">
                      Annuler l’inscription
                    </button>
                  ) : (
                    <button type="button" onClick={() => void changerStatut('inscrit')} className="rounded-full border border-line px-4 py-2 text-sm font-medium">
                      Réactiver
                    </button>
                  )}
                  {peutSupprimer && (
                    <button
                      type="button"
                      disabled={suppression}
                      onClick={() => setConfirmSuppression(true)}
                      className="rounded-full border border-red px-4 py-2 text-sm font-medium text-red hover:bg-red/5 disabled:opacity-50"
                    >
                      {suppression ? 'Suppression…' : 'Supprimer'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
      <BoiteConfirmation
        ouverte={confirmSuppression && participant !== null}
        titre="Supprimer cette inscription ?"
        message={
          participant
            ? `L’inscription de ${nomComplet(participant)} (${participant.code}) sera définitivement effacée. Cette action est irréversible.`
            : ''
        }
        confirmerLabel="Supprimer"
        onConfirmer={() => void confirmerSuppression()}
        onAnnuler={() => setConfirmSuppression(false)}
      />
    </div>
  )
}
