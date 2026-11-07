import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string
if (!url || !anon) console.error('Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (.env).')

// Somente a chave pública (anon). Segurança real = RLS no banco.
/** Sem .env o createClient lançaria erro e a tela ficaria branca; o App.vue mostra um aviso no lugar. */
export const envMissing = !url || !anon
export const supabase = createClient(url || 'http://env-ausente.invalid', anon || 'env-ausente')

export function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message)
}
