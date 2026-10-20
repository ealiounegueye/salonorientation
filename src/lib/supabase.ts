import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = String(__SUPABASE_URL__ || import.meta.env.VITE_SUPABASE_URL || '').trim()
const key = String(__SUPABASE_ANON_KEY__ || import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()

export const isConfigured = url.startsWith('https://') && key.length > 10

export const supabase: SupabaseClient = createClient(
  isConfigured ? url : 'https://placeholder.supabase.co',
  isConfigured ? key : 'sb_publishable_placeholder',
  {
    auth: {
      persistSession: isConfigured,
      autoRefreshToken: isConfigured,
      detectSessionInUrl: false,
    },
  },
)
