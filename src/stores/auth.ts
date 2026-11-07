import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/services/supabase'

export const useAuth = defineStore('auth', () => {
  const session = ref<Session | null>(null)
  const ready = ref(false)

  async function init() {
    const { data } = await supabase.auth.getSession()
    session.value = data.session
    supabase.auth.onAuthStateChange((_e, s) => { session.value = s })
    ready.value = true
  }
  async function login(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      const m = error.message
      if (/invalid login credentials/i.test(m)) throw new Error('E-mail ou senha incorretos (confira se o usuário existe no Supabase).')
      if (/not confirmed/i.test(m)) throw new Error('E-mail ainda não confirmado: no Supabase, confirme o usuário em Authentication > Users.')
      throw new Error(`Não foi possível entrar: ${m}`) // mostra o motivo real (chave inválida, rede, etc.)
    }
  }
  async function logout() { await supabase.auth.signOut() }
  return { session, ready, init, login, logout }
})
