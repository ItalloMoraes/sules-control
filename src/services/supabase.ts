import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string
if (!url || !anon) console.error('Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (.env).')

// Somente a chave pública (anon). Segurança real = RLS no banco.
export const supabase = createClient(url, anon)

export function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message)
}
