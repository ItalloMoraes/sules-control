import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { nationalHolidays } from '@/utils/holidays'
import { supabase, fail } from '@/services/supabase'
import type { Cancellation, Client, Goal, Insurer, Product, Receipt, Reversal, Sale, Settings } from '@/types'
import type { Dataset } from '@/utils/finance'

/** Conta individual: o volume cabe em memória; os cálculos ficam em utils/ (testáveis). */
export const useData = defineStore('data', () => {
  const settings = ref<Settings | null>(null)
  const insurers = ref<Insurer[]>([])
  const products = ref<Product[]>([])
  const clients = ref<Client[]>([])
  const sales = ref<Sale[]>([])
  const receipts = ref<Receipt[]>([])
  const cancellations = ref<Cancellation[]>([])
  const reversals = ref<Reversal[]>([])
  const goals = ref<Goal[]>([])
  const holidays = ref<string[]>([])
  // feriados cadastrados + nacionais (ano passado até 2 anos à frente), usados nos dias úteis da projeção
  const holidaySet = computed(() => { const s = new Set(holidays.value); const y = new Date().getFullYear(); for (let k = y - 1; k <= y + 2; k++) nationalHolidays(k).forEach(d => s.add(d)); return s })
  const loaded = ref(false)
  const needsBootstrap = ref(false)

  async function refresh() {
    const q = await Promise.all([
      supabase.from('settings').select('*').maybeSingle(),
      supabase.from('insurers').select('*').order('name'),
      supabase.from('products').select('*').order('name'),
      supabase.from('clients').select('*').order('full_name'),
      supabase.from('sales').select('*, clients(full_name, cpf), insurers(name), products(name)').order('created_at', { ascending: false }),
      supabase.from('commission_receipts').select('*').order('received_at', { ascending: false }),
      supabase.from('cancellations').select('*'),
      supabase.from('reversal_transactions').select('*').order('created_at', { ascending: false }),
      supabase.from('goals').select('*').order('month'),
      supabase.from('holidays').select('day'),
    ])
    q.forEach(r => fail(r.error))
    settings.value = q[0].data as Settings | null
    needsBootstrap.value = !settings.value
    insurers.value = (q[1].data ?? []) as Insurer[]
    products.value = (q[2].data ?? []) as Product[]
    clients.value = (q[3].data ?? []) as Client[]
    sales.value = (q[4].data ?? []) as Sale[]
    receipts.value = (q[5].data ?? []) as Receipt[]
    cancellations.value = (q[6].data ?? []) as Cancellation[]
    reversals.value = (q[7].data ?? []) as Reversal[]
    goals.value = (q[8].data ?? []) as Goal[]
    holidays.value = (q[9].data ?? []).map((h: { day: string }) => h.day)
    loaded.value = true
  }
  async function bootstrap(name: string, email = '') {
    fail((await supabase.rpc('bootstrap_account', { p_name: name })).error)
    if (email) fail((await supabase.from('settings').update({ broker_email: email }).eq('user_id', (await supabase.auth.getUser()).data.user!.id)).error)
    await refresh()
  }

  const dataset = computed<Dataset>(() => ({
    sales: sales.value, receipts: receipts.value, cancellations: cancellations.value, reversals: reversals.value,
  }))
  const receivedBySale = computed(() => {
    const m = new Map<string, number>()
    for (const s of sales.value) if (s.status !== 'cancelada') m.set(s.id, s.net_commission) // recebida = líquida
    return m
  })
  const clientName = (id: string) => clients.value.find(c => c.id === id)?.full_name ?? '—'

  return {
    settings, insurers, products, clients, sales, receipts, cancellations, reversals, goals, holidays, holidaySet,
    loaded, needsBootstrap, refresh, bootstrap, dataset, receivedBySale, clientName,
  }
})
