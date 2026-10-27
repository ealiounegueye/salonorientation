export async function demanderAccesCamera(): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!window.isSecureContext) {
    return {
      ok: false,
      message: 'La caméra ne fonctionne qu’en HTTPS. Ouvrez le site avec https:// ou depuis l’application installée.',
    }
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return {
      ok: false,
      message: 'Ce navigateur ne permet pas la caméra. Essayez Chrome ou Safari à jour.',
    }
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    })
    for (const piste of stream.getTracks()) piste.stop()
    return { ok: true }
  } catch (erreur) {
    const nom = erreur instanceof DOMException ? erreur.name : ''
    if (nom === 'NotAllowedError' || nom === 'PermissionDeniedError') {
      return {
        ok: false,
        message:
          'Accès caméra refusé. Autorisez la caméra pour ce site (icône cadenas ou réglages du navigateur), puis appuyez à nouveau sur Scanner.',
      }
    }
    if (nom === 'NotFoundError' || nom === 'DevicesNotFoundError') {
      return { ok: false, message: 'Aucune caméra détectée sur cet appareil.' }
    }
    if (nom === 'NotReadableError' || nom === 'TrackStartError') {
      return { ok: false, message: 'La caméra est déjà utilisée. Fermez l’autre application puis réessayez.' }
    }
    return { ok: false, message: 'Impossible d’ouvrir la caméra. Réessayez ou saisissez le code à la main.' }
  }
}
