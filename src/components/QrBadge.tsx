import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

export function QrBadge({ value }: { value: string }) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void QRCode.toDataURL(value, {
      margin: 1,
      width: 320,
      color: { dark: '#1a1a1a', light: '#ffffff' },
    }).then((url) => {
      if (!cancelled) setSrc(url)
    })
    return () => {
      cancelled = true
    }
  }, [value])

  if (!src) {
    return <div className="grid size-56 place-items-center rounded-2xl bg-paper text-sm text-muted">QR code…</div>
  }

  return <img src={src} alt={`QR code ${value}`} className="size-56 rounded-2xl border border-line bg-white p-2" />
}
