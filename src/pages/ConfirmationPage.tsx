import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { BandeauAuchan } from '../components/BandeauAuchan'
import { LogoSalon } from '../components/LogoSalon'
import { InfosLieu } from '../components/InfosLieu'
import { QrBadge } from '../components/QrBadge'
import { telechargerBadge } from '../lib/badgeImage'
import { evenement } from '../lib/evenement'
import { nomComplet } from '../lib/format'
import { isConfigured, supabase } from '../lib/supabase'
import type { BadgePublic } from '../types'

type EtatNavigation = {
  emailEnvoye?: boolean
  emailMessage?: string
  dejaInscrit?: boolean
  email?: string
  prenom?: string
  nom?: string
  telephone?: string
}

export function ConfirmationPage() {
  const { code = '' } = useParams()
  const location = useLocation()
  const etat = (location.state ?? {}) as EtatNavigation
  const [badge, setBadge] = useState<BadgePublic | null>(null)
  const [introuvable, setIntrouvable] = useState(false)
  const [telechargement, setTelechargement] = useState(false)
  const vientDeSinscrire = Boolean(etat.prenom && etat.nom)
  const codeAffiche = (badge?.code ?? (vientDeSinscrire ? code : '')).toUpperCase()
  const nomAffiche = badge ? nomComplet(badge) : [etat.prenom, etat.nom].filter(Boolean).join(' ')

  useEffect(() => {
    if (!vientDeSinscrire) return
    const cle = `badge-dl:${code}`
    try {
      if (sessionStorage.getItem(cle)) return
      sessionStorage.setItem(cle, '1')
    } catch {
      return
    }
    void telechargerBadge({
      code: code.toUpperCase(),
      prenom: etat.prenom ?? '',
      nom: etat.nom ?? '',
    })
  }, [vientDeSinscrire, code, etat.prenom, etat.nom])

  useEffect(() => {
    if (!isConfigured) return
    let cancelled = false
    void supabase.rpc('badge_public', { p_code: code }).then(({ data, error }) => {
      if (cancelled) return
      const ligne = Array.isArray(data) ? data[0] : data
      if (error || !ligne) {
        setIntrouvable(true)
        return
      }
      setBadge(ligne as BadgePublic)
    })
    return () => {
      cancelled = true
    }
  }, [code])

  async function telecharger() {
    if (!codeAffiche || telechargement) return
    setTelechargement(true)
    await telechargerBadge({
      code: codeAffiche,
      prenom: badge?.prenom ?? etat.prenom ?? '',
      nom: badge?.nom ?? etat.nom ?? '',
    })
    setTelechargement(false)
  }

  return (
    <BandeauAuchan>
      <LogoSalon className="block h-auto w-full object-contain" />
      <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.28em] text-red">{evenement.organisation}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        {etat.dejaInscrit ? 'Vous êtes déjà inscrit' : 'Inscription enregistrée'}
      </h1>

      {!isConfigured && (
        <p className="mt-4 text-muted">Le badge s’affiche une fois Supabase configuré.</p>
      )}

      {introuvable && !codeAffiche && (
        <p className="mt-4 text-muted">Ce badge est introuvable ou a été annulé.</p>
      )}

      {codeAffiche && (
        <div className="mt-8 flex flex-col items-center rounded-2xl border border-line bg-card p-6 text-center shadow-[0_16px_40px_rgba(224,0,26,0.08)]">
          <QrBadge value={codeAffiche} />
          <InfosLieu className="mt-2" />
          <p className={`mt-4 font-semibold break-all ${codeAffiche.length > 16 ? 'font-mono text-sm' : 'text-2xl tracking-[0.18em]'}`}>{codeAffiche}</p>
          {nomAffiche && <p className="mt-2 text-lg">{nomAffiche}</p>}
          <p className="mt-4 text-sm font-medium text-ink">
            {vientDeSinscrire
              ? 'Votre badge a été téléchargé. Présentez ce QR code à l’entrée.'
              : 'Présentez ce QR code à l’entrée.'}
          </p>
          {etat.emailEnvoye && (
            <p className="mt-2 text-sm text-muted">
              Une copie a aussi été envoyée{etat.email ? ` à ${etat.email}` : ''}.
            </p>
          )}
          <button
            type="button"
            disabled={telechargement}
            onClick={() => void telecharger()}
            className="mt-5 w-full rounded-full bg-red py-3 text-sm font-semibold text-white hover:bg-red-dark disabled:opacity-60"
          >
            {telechargement ? 'Téléchargement…' : 'Télécharger mon badge'}
          </button>
        </div>
      )}

      {isConfigured && !codeAffiche && !introuvable && <p className="mt-6 text-sm text-muted">Chargement du badge…</p>}

      <p className="mt-6 text-sm">
        <Link to="/" className="font-medium text-ink underline-offset-4 hover:underline">
          Nouvelle inscription
        </Link>
      </p>
    </BandeauAuchan>
  )
}
