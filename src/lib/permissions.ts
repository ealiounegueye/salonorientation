import type { Role } from '../types'

export function normaliserRole(valeur: unknown): Role | null {
  const brut = String(valeur ?? '').trim().toLowerCase()
  if (brut === 'super_admin' || brut === 'admin' || brut === 'hotesse') return brut
  return null
}

export function estStaff(role: Role | undefined | null): boolean {
  return role === 'admin' || role === 'super_admin' || role === 'hotesse'
}

/** Accès tableau de bord, exports, ajout manuel, etc. */
export function estBackoffice(role: Role | undefined | null): boolean {
  return role === 'admin' || role === 'super_admin'
}

export function peutVoirTableauDeBord(role: Role | undefined | null): boolean {
  return estBackoffice(role)
}

export function estHotesse(role: Role | undefined | null): boolean {
  return role === 'hotesse'
}

export function estSuperAdmin(role: Role | undefined | null): boolean {
  return role === 'super_admin'
}

export function libelleRole(role: Role): string {
  if (role === 'super_admin') return 'Super admin'
  if (role === 'hotesse') return 'Hôtesse'
  return 'Admin'
}

export function peutSupprimerParticipant(role: Role | undefined | null): boolean {
  return estSuperAdmin(role)
}

export function peutAccederReglages(role: Role | undefined | null): boolean {
  return estSuperAdmin(role)
}

export function peutExporterParticipants(role: Role | undefined | null): boolean {
  return estBackoffice(role)
}

export function peutAjouterParticipant(role: Role | undefined | null): boolean {
  return estBackoffice(role)
}

export function peutGererFicheParticipant(role: Role | undefined | null): boolean {
  return estBackoffice(role)
}

export function accueilApresConnexion(role: Role): string {
  return role === 'hotesse' ? '/admin/participants' : '/admin'
}
