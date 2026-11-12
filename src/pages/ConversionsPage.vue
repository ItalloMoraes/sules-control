<script setup lang="ts">
import { computed, onMounted, ref, watch, watchEffect } from 'vue'
import type { ChartConfiguration } from 'chart.js'
import { supabase, fail } from '@/services/supabase'
import { useAuth } from '@/stores/auth'
import { useData } from '@/stores/data'
import { run } from '@/composables/useToast'
import { monthLabel } from '@/utils/format'
import PageHeader from '@/components/PageHeader.vue'
import BaseChart from '@/components/BaseChart.vue'

// Somente registro: os números vêm do seu CRM e são guardados como estão (sem cálculo de funil).
type Row = { id: string; reference_month: string; leads_received: number; sales_converted: number }
type In = Omit<Row, 'id'>
const auth = useAuth(), data = useData()
const goal = ref(10)
watchEffect(() => { goal.value = data.leadGoal })
const saveGoal = () => run(async () => {
  if (!(goal.value > 0)) throw new Error('Informe uma meta maior que zero.')
  fail((await supabase.from('settings').update({ lead_conversion_goal: goal.value }).eq('user_id', auth.session!.user.id)).error)
  await data.refresh()
}, 'Meta de conversão salva')
const rows = ref<Row[]>([])
const f = ref({ month: new Date().toISOString().slice(0, 7), leads: 0, sales: 0 }), paste = ref('')

async function load() {
  const { data, error } = await supabase.from('conversions').select('*').order('reference_month')
  fail(error); rows.value = (data ?? []) as Row[]
  prefill()
}
// o mês escolhido já vem com os números salvos; é só ajustar e salvar de novo (substitui o anterior)
function prefill() {
  const r = rows.value.find(x => x.reference_month.startsWith(f.value.month))
  f.value.leads = r?.leads_received ?? 0; f.value.sales = r?.sales_converted ?? 0
}
watch(() => f.value.month, prefill)
async function upsert(list: In[]) {
  fail((await supabase.from('conversions').upsert(list.map(r => ({ ...r, user_id: auth.session!.user.id })), { onConflict: 'user_id,reference_month' })).error)
  await load()
}
const saveOne = () => run(() => upsert([{ reference_month: `${f.value.month}-01`, leads_received: Math.max(0, +f.value.leads), sales_converted: Math.max(0, +f.value.sales) }]), 'Registro salvo')
const toMonth = (s: string) => /^\d{4}-\d{2}/.test(s) ? s.slice(0, 7) : (s.match(/^(\d{2})\/(\d{4})$/) ? `${s.slice(3)}-${s.slice(0, 2)}` : null)
async function importPaste() {
  await run(async () => {
    const list = paste.value.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
      const [m, a, b] = l.split(/[;\t,]\s*/), mo = toMonth(m ?? '')
      if (!mo || !/^\d+$/.test(a ?? '') || !/^\d+$/.test(b ?? '')) throw new Error(`Linha inválida: "${l}". Use mês;leads;vendas (ex.: 10/2026;120;14)`)
      return { reference_month: `${mo}-01`, leads_received: +a, sales_converted: +b }
    })
    if (!list.length) throw new Error('Cole ao menos uma linha')
    await upsert(list); paste.value = ''
  }, 'Dados importados')
}
const remove = (id: string) => run(async () => { fail((await supabase.from('conversions').delete().eq('id', id)).error); await load() }, 'Registro removido')

const col = (v: string) => `rgb(${getComputedStyle(document.documentElement).getPropertyValue(v).trim().split(/\s+/).join(',')})`
const chart = computed<ChartConfiguration>(() => ({ type: 'bar', data: { labels: rows.value.map(r => monthLabel(r.reference_month)), datasets: [
  { label: 'Leads recebidos', data: rows.value.map(r => r.leads_received), backgroundColor: col('--c-info'), borderRadius: 6 },
  { label: 'Vendas convertidas', data: rows.value.map(r => r.sales_converted), backgroundColor: col('--c-gold'), borderRadius: 6 }] } }))
onMounted(() => load().catch(e => run(() => Promise.reject(e), '')))
</script>
<template>
  <PageHeader title="Conversão de leads" sub="Registro mensal dos números do seu CRM: leads recebidos e vendas convertidas." />
  <div v-reveal class="card mb-4 flex flex-wrap items-end gap-3">
    <div><label class="label" for="mg">Meta de conversão (%)</label><MoneyInput id="mg" v-model="goal" class="input w-32" /></div>
    <button class="btn btn-primary" @click="saveGoal">Salvar meta</button>
    <p class="min-w-64 flex-1 text-xs text-mute">No dashboard, a faixa muda conforme a meta: ruim abaixo de 50% dela, moderado até 75%, bom até 100% e ótimo a partir da meta.</p>
  </div>
  <div v-reveal class="card mb-4"><BaseChart v-if="rows.length" :config="chart" /><p v-else class="py-8 text-center text-sm text-mute">Nenhum mês registrado ainda.</p></div>
  <div class="mb-4 grid gap-4 md:grid-cols-2">
    <form v-reveal class="card grid grid-cols-3 gap-2" @submit.prevent="saveOne">
      <h2 class="col-span-3 font-bold">Registrar um mês</h2>
      <div><label class="label" for="cm">Mês</label><UDate month id="cm" v-model="f.month" class="input" required /></div>
      <div><label class="label" for="cl">Leads</label><input id="cl" v-model.number="f.leads" type="number" min="0" class="input" required /></div>
      <div><label class="label" for="cv">Vendas</label><input id="cv" v-model.number="f.sales" type="number" min="0" class="input" required /></div>
      <button class="btn btn-primary col-span-3">Salvar (substitui o mês, se já existir)</button>
    </form>
    <div v-reveal class="card">
      <h2 class="mb-2 font-bold">Colar vários meses</h2>
      <textarea v-model="paste" rows="4" class="input" placeholder="10/2026;120;14&#10;09/2026;98;11" aria-label="Dados colados" />
      <button class="btn btn-primary mt-2" :disabled="!paste.trim()" @click="importPaste">Importar</button>
    </div>
  </div>
  <div v-reveal class="card overflow-x-auto p-0">
    <div class="tbl-scroll"><table class="tbl"><thead><tr><th>Mês</th><th>Leads recebidos</th><th>Vendas convertidas</th><th></th></tr></thead>
      <tbody><tr v-for="r in [...rows].reverse()" :key="r.id"><td>{{ monthLabel(r.reference_month) }}</td><td class="num">{{ r.leads_received }}</td><td class="num">{{ r.sales_converted }}</td>
        <td class="text-right"><button class="btn btn-danger" @click="remove(r.id)">Remover</button></td></tr></tbody></table></div>
  </div>
</template>
