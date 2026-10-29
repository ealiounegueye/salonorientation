import type { Role } from '../types'

/** Droits réservés au super admin (gestion plateforme). */
export const SUPER_ADMIN_ONLY = {
  reglages: true,
  campagne: true,
  equipe: true,
  supprimerParticipant: true,
} as const

export function estStaff(role: Role | undefined | null): boolean {
  return role === 'admin' || role === 'super_admin'
}

export function estSuperAdmin(role: Role | undefined | null): boolean {
  return role === 'super_admin'
}

export function libelleRole(role: Role): string {
  return role === 'super_admin' ? 'Super admin' : 'Admin'
}

export function peutSupprimerParticipant(role: Role | undefined | null): boolean {
  return estSuperAdmin(role)
}

export function peutAccederReglages(role: Role | undefined | null): boolean {
  return estSuperAdmin(role)
}
