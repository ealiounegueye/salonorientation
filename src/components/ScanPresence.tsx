import { useEffect, useRef, useState } from 'react'
import { extraireCode } from '../lib/format'

type CameraConfig = string | { facingMode: string }

async function attendreCadre() {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
}

async function configsCamera(Html5Qrcode: typeof import('html5-qrcode').Html5Qrcode): Promise<CameraConfig[]> {
  const configs: CameraConfig[] = [{ facingMode: 'environment' }, { facingMode: 'user' }]
  const cameras = await Html5Qrcode.getCameras().catch(() => [])
  const arriere = cameras.find((camera) => /back|rear|arri|environment|wide/i.test(camera.label))
  if (arriere?.id) configs.unshift(arriere.id)
  else if (cameras.at(-1)?.id) configs.unshift(cameras.at(-1)!.id)
  return configs
}

function messageErreurScan(erreur: unknown) {
  const nom = erreur instanceof DOMException ? erreur.name : ''
  if (nom === 'NotAllowedError' || nom === 'PermissionDeniedError') {
    return 'Caméra refusée. Autorisez l’accès dans les réglages du navigateur, puis relancez le scan.'
  }
  if (nom === 'NotFoundError') return 'Aucune caméra disponible.'
  if (nom === 'NotReadableError') return 'La caméra est occupée par une autre application.'
  return 'Impossible d’ouvrir la caméra. Autorisez-la dans le navigateur, ou saisissez le code.'
}

export function ScanPresence({ actif, onCode }: { actif: boolean; onCode: (code: string) => void }) {
  const [erreur, setErreur] = useState<string | null>(null)
  const [demarrage, setDemarrage] = useState(false)
  const onCodeRef = useRef(onCode)
  const generation = useRef(0)
  onCodeRef.current = onCode

  useEffect(() => {
    if (!actif) {
      setDemarrage(false)
      return
    }
    const tour = ++generation.current
    setErreur(null)
    setDemarrage(true)
    let scanner: import('html5-qrcode').Html5Qrcode | null = null

    ;(async () => {
      const { Html5Qrcode } = await import('html5-qrcode')
      if (generation.current !== tour) return
      await attendreCadre()
      if (generation.current !== tour) return

      scanner = new Html5Qrcode('lecteur-presence', false)
      const options = {
        fps: 10,
        aspectRatio: 1,
        qrbox: { width: 230, height: 230 },
      }
      const configs = await configsCamera(Html5Qrcode)
      let derniereErreur: unknown = null

      for (const config of configs) {
        if (generation.current !== tour) return
        try {
          await scanner.start(
            config,
            options,
            (texte) => {
              const code = extraireCode(texte)
              if (code) onCodeRef.current(code)
            },
            () => {},
          )
          if (generation.current === tour) setDemarrage(false)
          return
        } catch (erreur) {
          derniereErreur = erreur
          if (scanner.isScanning) {
            await scanner.stop().catch(() => {})
          }
          scanner.clear()
        }
      }

      if (generation.current === tour) {
        setDemarrage(false)
        setErreur(messageErreurScan(derniereErreur))
      }
    })()

    return () => {
      generation.current += 1
      if (!scanner?.isScanning) return
      void scanner
        .stop()
        .then(() => scanner?.clear())
        .catch(() => {})
    }
  }, [actif])

  if (!actif) return null

  return (
    <div className="mt-3">
      <div id="lecteur-presence" />
      {demarrage && !erreur && <p className="mt-2 text-sm text-muted">Ouverture de la caméra…</p>}
      {erreur ? (
        <p className="mt-2 text-sm font-medium text-red">{erreur}</p>
      ) : (
        !demarrage && (
          <p className="mt-2 text-sm text-muted">Cadrez le QR code du badge. La présence est enregistrée dès la lecture.</p>
        )
      )}
    </div>
  )
}
