import { useEffect } from 'react'

type Props = {
  ouverte: boolean
  titre: string
  message: string
  confirmerLabel?: string
  annulerLabel?: string
  onConfirmer: () => void
  onAnnuler: () => void
}

export function BoiteConfirmation({
  ouverte,
  titre,
  message,
  confirmerLabel = 'Confirmer',
  annulerLabel = 'Annuler',
  onConfirmer,
  onAnnuler,
}: Props) {
  useEffect(() => {
    if (!ouverte) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onAnnuler()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ouverte, onAnnuler])

  if (!ouverte) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-titre"
      onClick={onAnnuler}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-line bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <p id="confirm-titre" className="text-lg font-semibold text-ink">
          {titre}
        </p>
        <p className="mt-2 text-sm text-muted">{message}</p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onAnnuler}
            className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:border-red/40"
          >
            {annulerLabel}
          </button>
          <button
            type="button"
            onClick={onConfirmer}
            className="rounded-full bg-red px-4 py-2 text-sm font-semibold text-white hover:bg-red-dark"
          >
            {confirmerLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
