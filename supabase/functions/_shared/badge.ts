import QRCode from 'https://esm.sh/qrcode@1.5.4?target=denonext'

export type Participant = {
  id: string
  code: string
  prenom: string
  nom: string
  email: string
  telephone: string | null
  organisation: string | null
  fonction: string | null
  statut: string
}

const TITRE = 'Salon des Métiers'

export function codeAleatoire() {
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  let corps = ''
  for (const byte of bytes) corps += String(byte % 10)
  return `SDM-${corps}`
}

function echapper(valeur: string) {
  return valeur
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export async function envoyerBadge(participant: Participant) {
  const apiKey = Deno.env.get('RESEND_API_KEY') ?? ''
  if (!apiKey) {
    return { emailEnvoye: false, emailErreur: 'RESEND_API_KEY manquante.' }
  }

  const from = Deno.env.get('MAIL_FROM') ?? 'Auchan Salon <onboarding@resend.dev>'
  const site = (Deno.env.get('PUBLIC_SITE_URL') ?? '').replace(/\/$/, '')
  const lien = site ? `${site}/confirmation/${participant.code}` : ''
  const dataUrl = await QRCode.toDataURL(participant.code, {
    margin: 1,
    width: 480,
    errorCorrectionLevel: 'M',
    color: { dark: '#1a1a1a', light: '#ffffff' },
  })
  const base64 = String(dataUrl).split(',')[1] ?? ''
  const prenom = echapper(participant.prenom)
  const nom = echapper(participant.nom)
  const code = echapper(participant.code)

  const html = `<!doctype html>
<html lang="fr">
  <body style="margin:0;background:#f5f5f5;font-family:Arial,sans-serif;color:#1a1a1a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f5f5;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="background:#e0001a;color:#ffffff;padding:20px 24px;font-size:13px;letter-spacing:.16em;text-transform:uppercase;font-weight:700;">
                Auchan Retail Sénégal
              </td>
            </tr>
            <tr>
              <td style="padding:28px 24px 8px;font-size:22px;font-weight:700;">Votre badge d’accès</td>
            </tr>
            <tr>
              <td style="padding:0 24px 8px;font-size:15px;line-height:1.5;">
                Bonjour ${prenom} ${nom}, votre inscription au ${TITRE} est enregistrée.
                Présentez ce QR code à l’entrée.
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:16px 24px;">
                <img src="cid:badge-qr" width="220" height="220" alt="QR code ${code}" />
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:0 24px 8px;font-size:11px;line-height:1.35;color:#6b6b6b;">
                À côté du Cinéma Pathé à Mermoz<br />
                18, 19, 20 novembre 2026 · 9h–17h
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:0 24px 8px;font-size:28px;letter-spacing:.18em;font-weight:700;">
                ${code}
              </td>
            </tr>
            ${
              lien
                ? `<tr><td align="center" style="padding:8px 24px 24px;"><a href="${echapper(lien)}" style="color:#e0001a;font-weight:700;">Ouvrir mon badge</a></td></tr>`
                : `<tr><td style="padding-bottom:24px;"></td></tr>`
            }
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`

  const reponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [participant.email],
      subject: `Votre badge d’accès — ${TITRE}`,
      html,
      attachments: [
        {
          filename: 'badge.png',
          content: base64,
          content_id: 'badge-qr',
        },
      ],
    }),
  })

  if (!reponse.ok) {
    const detail = await reponse.text()
    console.error('Resend', reponse.status, detail)
    let message = 'L’envoi de l’e-mail a échoué.'
    try {
      const parsed = JSON.parse(detail) as { message?: string }
      if (parsed.message) message = parsed.message.slice(0, 240)
    } catch {
      message = 'L’envoi de l’e-mail a échoué.'
    }
    return { emailEnvoye: false, emailErreur: message }
  }

  return { emailEnvoye: true, emailErreur: null }
}
