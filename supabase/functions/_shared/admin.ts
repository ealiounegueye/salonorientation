import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0'
import { json } from './http.ts'

export function clientService(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  return createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function exigerAdmin(req: Request) {
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
  if (profile?.role !== 'admin') {
    return { erreur: json({ ok: false, message: 'Accès refusé.' }, 403) }
  }

  return { admin }
}
