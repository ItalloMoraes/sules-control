<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useData } from '@/stores/data'
import { brl, dateBR, monthEnd, monthLabel, monthStart, todayISO } from '@/utils/format'
import { supabase } from '@/services/supabase'
import { project } from '@/utils/projections'
import { monthKeys, monthPeriod, round2, summarize, type Period } from '@/utils/finance'
import PageHeader from '@/components/PageHeader.vue'
import StatCard from '@/components/StatCard.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import BaseChart from '@/components/BaseChart.vue'
import type { ChartConfiguration } from 'chart.js'

const data = useData()
const hour = new Date().getHours()
const greet = computed(() => `${hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'}, ${(data.settings?.broker_name ?? '').split(' ')[0]}`.replace(/, $/, '')), router = useRouter()
const today = todayISO()
const proj = computed(() => project(data.dataset, today, new Set(data.holidays)))
const f = reactive({ from: monthStart(today), to: monthEnd(today), insurer: '', product: '', origin: '', status: '' })
const period = computed<Period>(() => ({ from: f.from, to: f.to }))
const filt = computed(() => (s: typeof data.sales[number]) =>
  (!f.insurer || s.insurer_id === f.insurer) && (!f.product || s.product_id === f.product) &&
  (!f.origin || s.origin === f.origin) && (!f.status || s.status === f.status))
const sum = computed(() => summarize(data.dataset, period.value, filt.value))

// Prévia do mês: ordena por created_at DESC (independente da apuração por sale_date)
const preview = computed(() => data.sales.filter(s => filt.value(s) && s.sale_date >= f.from && s.sale_date <= f.to)
  .sort((a, b) => b.created_at.localeCompare(a.created_at)))

const keys = computed(() => monthKeys(new Date(Date.UTC(+f.to.slice(0, 4), +f.to.slice(5, 7) - 12, 1)).toISOString().slice(0, 7), 12))
const series = computed(() => keys.value.map(k => summarize(data.dataset, monthPeriod(k), filt.value)))
const labels = computed(() => keys.value.map(k => monthLabel(k + '-01')))

type Lead = { reference_month: string; leads_received: number; sales_converted: number }
const backupDays = (() => { const v = localStorage.getItem('sc-last-backup'); return v ? Math.floor((Date.now() - new Date(v + 'T12:00:00').getTime()) / 86400000) : null })()
const needBackup = backupDays === null || backupDays >= 5
const lead = ref<Lead | null>(null)
onMounted(async () => {
  const { data: l } = await supabase.from('conversions').select('*').order('reference_month', { ascending: false }).limit(1)
  lead.value = (l?.[0] as Lead | undefined) ?? null
})
const leadPct = computed(() => lead.value && lead.value.leads_received ? Math.min(100, Math.round((lead.value.sales_converted / lead.value.leads_received) * 1000) / 10) : 0)
const C = { gold: '#1E8A44', pos: '#34C759', neg: '#FF453A', info: '#8FD6B0', warn: '#FF9F0A' }
const line = (title: string, vals: number[], color: string): ChartConfiguration => ({ type: 'line', data: { labels: labels.value, datasets: [{ label: title, data: vals, borderColor: color, backgroundColor: color + '33', tension: .3, fill: true }] } })
const charts = computed(() => ({
  sales: line('Vendas', series.value.map(s => s.issuedCount), C.info),
  commissions: { type: 'bar', data: { labels: labels.value, datasets: [
    { label: 'Bruta', data: series.value.map(s => s.gross), backgroundColor: C.info },
    { label: 'Líquida', data: series.value.map(s => s.net), backgroundColor: C.gold }] } } as ChartConfiguration,
  premium: line('Prêmios', series.value.map(s => s.premium), C.pos),
  cancel: { type: 'bar', data: { labels: labels.value, datasets: [
    { label: 'Comissão perdida', data: series.value.map(s => s.lostCommission), backgroundColor: C.warn },
    { label: 'Estornos efetivados', data: series.value.map(s => s.reversalsEffective), backgroundColor: C.neg }] } } as ChartConfiguration,
  origin: { type: 'doughnut', data: { labels: ['Digital Suhai', 'Venda própria'], datasets: [{ backgroundColor: [C.info, C.gold], data: ['digital_suhai', 'venda_propria'].map(o =>
    round2(data.sales.filter(s => s.origin === o && s.status === 'emitida' && s.sale_date >= f.from && s.sale_date <= f.to).reduce((a, s) => a + s.net_commission, 0))) }] } } as ChartConfiguration,
  product: { type: 'doughnut', data: { labels: data.products.map(p => p.name), datasets: [{ backgroundColor: [C.gold, C.info, C.pos, C.warn, C.neg], data: data.products.map(p =>
    data.sales.filter(s => s.product_id === p.id && s.status === 'emitida' && s.sale_date >= f.from && s.sale_date <= f.to).length) }] } } as ChartConfiguration,
}))
</script>
<template>
  <PageHeader :title="greet" sub="Apuração pela data da venda; a prévia lista pelos cadastros mais recentes." />
    <div v-if="needBackup" v-reveal class="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm">
    <span>{{ backupDays === null ? 'Você ainda não baixou um backup.' : `Faz ${backupDays} dias do último backup.` }} Baixe uma cópia dos seus dados.</span>
    <router-link to="/relatorios" class="btn">Ir para o backup</router-link>
  </div>
  <div class="card mb-4 filters">
    <UDate v-model="f.from" class="input" aria-label="De" /><UDate v-model="f.to" class="input" aria-label="Até" />
    <USelect v-model="f.insurer" class="input" aria-label="Seguradora"><option value="">Seguradoras</option><option v-for="i in data.insurers" :key="i.id" :value="i.id">{{ i.name }}</option></USelect>
    <USelect v-model="f.product" class="input" aria-label="Produto"><option value="">Produtos</option><option v-for="p in data.products" :key="p.id" :value="p.id">{{ p.name }}</option></USelect>
    <USelect v-model="f.origin" class="input" aria-label="Origem"><option value="">Origens</option><option value="digital_suhai">Digital Suhai</option><option value="venda_propria">Venda própria</option></USelect>
    <USelect v-model="f.status" class="input" aria-label="Status"><option value="">Status</option><option value="pendente">Pendente</option><option value="emitida">Emitida</option><option value="cancelada">Cancelada</option></USelect>
  </div>
  <div class="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
    <StatCard label="Comissão líquida gerada" :value="brl(sum.net)" tone="gold" :hint="`${sum.issuedCount} vendas ativas · já sem as canceladas`" />
    <StatCard label="Comissão bruta" :value="brl(sum.gross)" hint="Prêmio × % da seguradora" />
    <StatCard label="Prêmios totais" :value="brl(sum.premium)" />
    <StatCard label="Perdida por cancelamentos" :value="brl(sum.lostCommission)" tone="warn" />
    <div v-reveal.stagger class="card flex items-center gap-3">
      <svg width="56" height="56" viewBox="0 0 36 36" class="-rotate-90 shrink-0" aria-hidden="true">
        <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" class="text-raise" stroke-width="3.4" />
        <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" class="text-gold" stroke-width="3.4" stroke-linecap="round" pathLength="100" :stroke-dasharray="`${leadPct} 100`" />
      </svg>
      <div v-if="lead"><div class="text-xs text-mute">Conversão de leads · {{ monthLabel(lead.reference_month) }}</div>
        <div class="num font-display text-2xl font-semibold">{{ leadPct }}%</div><div class="text-xs text-mute">{{ lead.sales_converted }} vendas de {{ lead.leads_received }} leads</div></div>
      <div v-else><div class="text-xs text-mute">Conversão de leads</div><router-link to="/metas" class="text-sm text-gold hover:underline">Registrar números</router-link></div>
    </div>
  </div>
  <div v-reveal class="card mb-6 flex flex-wrap items-center justify-between gap-4">
    <div><div class="text-xs text-mute">Projeção do mês (cenário provável)</div>
      <div class="num font-display text-2xl font-semibold text-gold">{{ brl(proj.scenarios.provavel.net) }}</div>
      <div class="text-xs text-mute">Entre {{ brl(proj.scenarios.conservador.net) }} e {{ brl(proj.scenarios.otimista.net) }} · {{ proj.remainingBizDays }} dias úteis restantes</div></div>
    <router-link to="/projecoes" class="btn">Ver projeções</router-link>
  </div>
  <div class="mb-6 grid gap-4 lg:grid-cols-2">
    <div v-reveal class="card"><h2 class="mb-2 font-bold">Evolução das vendas</h2><BaseChart :config="charts.sales" /></div>
    <div v-reveal class="card"><h2 class="mb-2 font-bold">Evolução das comissões</h2><BaseChart :config="charts.commissions" /></div>
    <div v-reveal class="card"><h2 class="mb-2 font-bold">Prêmios por mês</h2><BaseChart :config="charts.premium" /></div>
    <div v-reveal class="card"><h2 class="mb-2 font-bold">Cancelamentos e estornos</h2><BaseChart :config="charts.cancel" :height="160" /></div>
  </div>
  <div class="mb-6 grid gap-4 md:grid-cols-2">
    <div v-reveal class="card"><h2 class="mb-2 font-bold">Digital Suhai × Venda própria</h2><BaseChart :config="charts.origin" :height="230" /></div>
    <div v-reveal class="card"><h2 class="mb-2 font-bold">Por produto</h2><BaseChart :config="charts.product" :height="230" /></div>
  </div>
  <div v-reveal class="card overflow-x-auto p-0"><h2 class="p-4 pb-0 font-bold">Cadastros do período (mais recentes primeiro)</h2>
    <table class="tbl"><thead><tr><th>Cadastrada em</th><th>Data da venda</th><th>Cliente</th><th>Produto</th><th class="text-right">Prêmio</th><th class="text-right">Líquida</th><th>Status</th></tr></thead>
      <tbody><tr v-for="s in preview" :key="s.id" class="cursor-pointer" @click="router.push('/vendas/' + s.id)">
        <td>{{ new Date(s.created_at).toLocaleString('pt-BR', { timeZone: 'America/Recife' }) }}</td><td>{{ dateBR(s.sale_date) }}</td>
        <td>{{ s.clients?.full_name }}</td><td>{{ s.products?.name }}</td><td class="num text-right">{{ brl(s.premium) }}</td>
        <td class="num text-right">{{ brl(s.net_commission) }}</td><td><StatusBadge :value="s.status" /></td></tr>
        <tr v-if="!preview.length"><td colspan="7" class="py-6 text-center text-mute">Nenhuma venda neste período.</td></tr></tbody></table></div>
</template>
