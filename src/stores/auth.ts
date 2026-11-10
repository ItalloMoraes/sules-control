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
  // Após 5 erros seguidos, o botão fica bloqueado por 1 minuto (a proteção de verdade fica no Supabase Auth).
  async function login(email: string, password: string) {
    const until = Number(localStorage.getItem('sc-login-lock') ?? 0)
    if (Date.now() < until) throw new Error(`Muitas tentativas. Aguarde ${Math.ceil((until - Date.now()) / 1000)} segundos e tente de novo.`)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (!error) { localStorage.removeItem('sc-login-fails'); return }
    const fails = Number(localStorage.getItem('sc-login-fails') ?? 0) + 1
    if (fails >= 5) { localStorage.setItem('sc-login-lock', String(Date.now() + 60_000)); localStorage.setItem('sc-login-fails', '0') }
    else localStorage.setItem('sc-login-fails', String(fails))
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
