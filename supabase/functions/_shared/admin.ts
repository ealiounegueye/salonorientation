import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0'
import { json } from './http.ts'

export type RoleStaff = 'admin' | 'super_admin'

export function clientService(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  return createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function exigerStaff(req: Request) {
  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const authHeader = req.headers.get('Authorization') ?? ''
  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data } = await userClient.auth.getUser()
  if (!data.user) {
    return { erreur: json({ ok: false, message: 'Connexion requise.' }, 401) }
  }

  const admin = clientService()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', data.user.id).maybeSingle()
  const role = profile?.role
  if (role !== 'admin' && role !== 'super_admin') {
    return { erreur: json({ ok: false, message: 'Accès refusé.' }, 403) }
  }

  return { admin, userId: data.user.id, role: role as RoleStaff }
}

/** @deprecated Utiliser exigerStaff */
export async function exigerAdmin(req: Request) {
  return exigerStaff(req)
}

export async function exigerSuperAdmin(req: Request) {
  const acces = await exigerStaff(req)
  if ('erreur' in acces && acces.erreur) return acces
  if (!('role' in acces) || acces.role !== 'super_admin') {
    return { erreur: json({ ok: false, message: 'Réservé au super admin.' }, 403) }
  }
  return acces
}

export async function sessionEstAdmin(req: Request) {
  const acces = await exigerStaff(req)
  return Boolean('admin' in acces && acces.admin)
}
