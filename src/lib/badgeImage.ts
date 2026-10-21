import QRCode from 'qrcode'

function chargerImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('QR illisible'))
    image.src = src
  })
}

export async function telechargerBadge(opts: { code: string; prenom: string; nom: string }) {
  const dataUrl = await QRCode.toDataURL(opts.code, {
    margin: 1,
    width: 640,
    errorCorrectionLevel: 'M',
    color: { dark: '#1a1a1a', light: '#ffffff' },
  })
  const image = await chargerImage(dataUrl)
  const canvas = document.createElement('canvas')
  canvas.width = 800
  canvas.height = 1040
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#e0001a'
  ctx.fillRect(0, 0, canvas.width, 18)
  ctx.fillStyle = '#1a1a1a'
  ctx.textAlign = 'center'
  ctx.font = '600 28px Figtree, sans-serif'
  ctx.fillText('Auchan Retail Sénégal', 400, 88)
  ctx.font = '700 42px Figtree, sans-serif'
  ctx.fillText('Salon de Métier', 400, 148)
  ctx.drawImage(image, 120, 190, 560, 560)
  ctx.font = '700 52px Figtree, sans-serif'
  ctx.fillText(opts.code, 400, 830)
  const nom = [opts.prenom, opts.nom].filter(Boolean).join(' ').trim()
  if (nom) {
    ctx.font = '500 32px Figtree, sans-serif'
    ctx.fillText(nom, 400, 886)
  }
  ctx.fillStyle = '#6b6b6b'
  ctx.font = '500 26px Figtree, sans-serif'
  ctx.fillText('Présentez ce QR code à l’entrée.', 400, 970)

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) return
  const url = URL.createObjectURL(blob)
  const lien = document.createElement('a')
  lien.href = url
  lien.download = `badge-${opts.code}.png`
  lien.rel = 'noopener'
  lien.style.display = 'none'
  document.body.appendChild(lien)
  lien.click()
  window.setTimeout(() => {
    lien.remove()
    URL.revokeObjectURL(url)
  }, 60_000)
}
