import { useEffect, useRef, useState } from 'react'
import { extraireCode } from '../lib/format'

export function ScanPresence({ actif, onCode }: { actif: boolean; onCode: (code: string) => void }) {
  const [erreur, setErreur] = useState<string | null>(null)
  const onCodeRef = useRef(onCode)
  const generation = useRef(0)
  onCodeRef.current = onCode

  useEffect(() => {
    if (!actif) return
    const tour = ++generation.current
    setErreur(null)
    let instance: { stop: () => Promise<void>; clear: () => void; isScanning: boolean } | null = null

    ;(async () => {
      const { Html5Qrcode } = await import('html5-qrcode')
      if (generation.current !== tour) return
      const scanner = new Html5Qrcode('lecteur-presence', false)
      instance = scanner
      try {
        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 8,
            qrbox: (largeur, hauteur) => {
              const bord = Math.floor(Math.min(largeur, hauteur) * 0.72)
              return { width: bord, height: bord }
            },
          },
          (texte) => {
            const code = extraireCode(texte)
            if (code) onCodeRef.current(code)
          },
          () => {},
        )
        if (generation.current !== tour) {
          await scanner.stop().catch(() => {})
          scanner.clear()
        }
      } catch {
        try {
          scanner.clear()
        } catch {
          /* le lecteur n’était pas démarré */
        }
        if (generation.current === tour) {
          setErreur('Impossible d’ouvrir la caméra. Autorisez-la dans le navigateur, ou saisissez le code.')
        }
      }
    })()

    return () => {
      generation.current += 1
      if (!instance?.isScanning) return
      void instance.stop().then(() => instance?.clear()).catch(() => {})
    }
  }, [actif])

  if (!actif) return null

  return (
    <div className="mt-3">
      <div id="lecteur-presence" className="min-h-64 overflow-hidden rounded-2xl bg-ink" />
      {erreur ? (
        <p className="mt-2 text-sm font-medium text-red">{erreur}</p>
      ) : (
        <p className="mt-2 text-sm text-muted">Cadrez le QR code du badge. La présence est enregistrée dès la lecture.</p>
      )}
    </div>
  )
}
