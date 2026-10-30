/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare const __SUPABASE_URL__: string
declare const __SUPABASE_ANON_KEY__: string

declare module '*.pdf?url' {
  const src: string
  export default src
}
