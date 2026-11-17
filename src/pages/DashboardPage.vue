<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useData } from '@/stores/data'
import { brl, dateBR, monthEnd, monthLabel, monthStart, todayISO } from '@/utils/format'
import { supabase } from '@/services/supabase'
import StateSalesCard from '@/components/StateSalesCard.vue'
import LeadGauge from '@/components/LeadGauge.vue'
import { leadMood } from '@/utils/leadMood'
import SegTabs from '@/components/SegTabs.vue'
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
const proj = computed(() => project(data.dataset, today, data.holidaySet))
const f = reactive({ from: monthStart(today), to: monthEnd(today), insurer: '', product: '', origin: '', status: '' })
const period = computed<Period>(() => ({ from: f.from, to: f.to }))
const filt = computed(() => (s: typeof data.sales[number]) =>
  (!f.insurer || s.insurer_id === f.insurer) && (!f.product || s.product_id === f.product) &&
  (!f.origin || s.origin === f.origin) && (!f.status || s.status === f.status))
const sum = computed(() => summarize(data.dataset, period.value, filt.value))

// Prévia do mês: ordena por created_at DESC (independente da apuração por sale_date)
const preview = computed(() => data.sales.filter(s => filt.value(s) && s.sale_date >= f.from && s.sale_date <= f.to)
  .sort((a, b) => b.created_at.localeCompare(a.created_at)))

const chartSpan = ref('6')   // meses mostrados nos gráficos de evolução
const keys = computed(() => monthKeys(new Date(Date.UTC(+f.to.slice(0, 4), +f.to.slice(5, 7) - +chartSpan.value, 1)).toISOString().slice(0, 7), +chartSpan.value))
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
// vendas ativas do período, por estado e cidade do cliente (pelo CEP)
const geoSales = computed(() => data.sales.filter(s => s.status !== 'cancelada' && (!f.from || s.sale_date >= f.from) && (!f.to || s.sale_date <= f.to)))
// barra da projeção: já gerado (sólido), faixa conservador-otimista (clara) e marca do provável
const projScale = computed(() => Math.max(proj.value.scenarios.otimista.net, proj.value.generatedSoFar, 1) * 1.05)
const projPos = (v: number) => Math.min(100, Math.max(0, (v / projScale.value) * 100))
// números do mês mais recente e variação sobre o mês anterior, para o topo de cada gráfico
const kpi = computed(() => {
  const x = series.value, a = x[x.length - 1], b = x[x.length - 2]
  const d = (v?: number, w?: number) => (w ? (v ?? 0) / w - 1 : null)
  return { label: labels.value[labels.value.length - 1] ?? '', sales: a?.issuedCount ?? 0, salesD: d(a?.issuedCount, b?.issuedCount), premium: a?.premium ?? 0, premiumD: d(a?.premium, b?.premium), net: a?.net ?? 0, netD: d(a?.net, b?.net) }
})
const C = { gold: '#1E8A44', pos: '#34C759', neg: '#FF453A', info: '#8FD6B0', warn: '#FF9F0A' }
const leadState = computed(() => leadMood(leadPct.value, data.leadGoal))
const line = (title: string, vals: number[], color: string): ChartConfiguration => ({ type: 'line', data: { labels: labels.value, datasets: [{ label: title, data: vals, borderColor: color, backgroundColor: color + '33', tension: .3, fill: true }] } })
const charts = computed(() => ({
  sales: { type: 'line', data: { labels: labels.value, datasets: [{ label: 'Vendas', data: series.value.map(s => s.issuedCount), borderColor: C.warn, fill: true }] } } as ChartConfiguration,
  premium: { type: 'bar', data: { labels: labels.value, datasets: [{ label: 'Prêmios (R$)', data: series.value.map(s => s.premium), backgroundColor: C.info, fmt: 'brl', maxBarThickness: 30 }] } } as unknown as ChartConfiguration,
  // bruta larga e clara ao fundo; líquida mais estreita, forte e na frente
  commissions: { type: 'bar', data: { labels: labels.value, datasets: [
    { label: 'Bruta', data: series.value.map(s => s.gross), backgroundColor: C.info, grouped: false, order: 2, barPercentage: 1, maxBarThickness: 46 },
    { label: 'Líquida', data: series.value.map(s => s.net), backgroundColor: C.pos, grouped: false, order: 1, barPercentage: 0.5, maxBarThickness: 22 }] } } as ChartConfiguration,
  cancel: { type: 'bar', data: { labels: labels.value, datasets: [
    { label: 'Comissão perdida (R$)', data: keys.value.map(k => round2(data.cancellations.filter(c => c.cancelled_at.startsWith(k)).reduce((a, c) => a + c.net_at_cancellation, 0))), backgroundColor: C.warn, fmt: 'brl' }] } } as unknown as ChartConfiguration,
  origin: { type: 'doughnut', data: { labels: ['Digital Suhai', 'Venda própria'], datasets: [{ backgroundColor: [C.info, C.gold], data: ['digital_suhai', 'venda_propria'].map(o =>
    round2(data.sales.filter(s => s.origin === o && s.status !== 'cancelada' && s.sale_date >= f.from && s.sale_date <= f.to).reduce((a, s) => a + s.net_commission, 0))) }] } } as ChartConfiguration,
  product: { type: 'doughnut', data: { labels: data.products.map(p => p.name), datasets: [{ backgroundColor: [C.gold, C.info, C.pos, C.warn, C.neg], data: data.products.map(p =>
    data.sales.filter(s => s.product_id === p.id && s.status !== 'cancelada' && s.sale_date >= f.from && s.sale_date <= f.to).length) }] } } as ChartConfiguration,
}))
</script>
<template>
  <PageHeader :title="greet" sub="Apuração pela data da venda; a prévia lista pelos cadastros mais recentes." />
    <div v-if="needBackup" v-reveal class="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm">
    <span>{{ backupDays === null ? 'Você ainda não baixou um backup.' : `Faz ${backupDays} dias do último backup.` }} Baixe uma cópia dos seus dados.</span>
    <router-link to="/relatorios" class="btn">Ir para o backup</router-link>
  </div>
  <div class="mb-4 flex flex-wrap items-center justify-end gap-2">
    <router-link :to="{ path: '/vendas', query: { novo: '1' } }" class="btn btn-primary">Nova venda</router-link>
    <UDateRange v-model:from="f.from" v-model:to="f.to" class="input w-72 max-w-full" aria-label="Período" />
  </div>
  <div class="mb-6 grid gap-4 lg:grid-cols-3">
    <StatCard label="Comissão líquida" :value="brl(sum.net)" tone="gold" :hint="`${sum.issuedCount} vendas ativas · já sem as canceladas`" />
    <div v-reveal class="card">
      <div class="flex items-start justify-between gap-2">
        <div><div class="text-xs text-mute">Projeção do mês · provável</div><div class="num font-display text-3xl font-semibold text-gold">{{ brl(proj.scenarios.provavel.net) }}</div></div>
        <router-link to="/desempenho" class="text-xs text-gold hover:underline">ver mais</router-link>
      </div>
      <div class="relative mt-4 h-3 rounded-full bg-raise" role="img" :aria-label="`Já gerado ${brl(proj.generatedSoFar)}; projeção entre ${brl(proj.scenarios.conservador.net)} e ${brl(proj.scenarios.otimista.net)}`">
        <div class="absolute inset-y-0 rounded-full bg-gold/25" :style="{ left: projPos(proj.scenarios.conservador.net) + '%', width: projPos(proj.scenarios.otimista.net) - projPos(proj.scenarios.conservador.net) + '%' }" />
        <div class="absolute inset-y-0 left-0 rounded-full bg-gold transition-[width] duration-500" :style="{ width: projPos(proj.generatedSoFar) + '%' }" />
        <div class="absolute top-1/2 h-5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-text" :style="{ left: projPos(proj.scenarios.provavel.net) + '%' }" />
      </div>
      <div class="num mt-2 flex justify-between text-xs text-mute"><span>Conservador <b class="text-text">{{ brl(proj.scenarios.conservador.net) }}</b></span><span>Otimista <b class="text-text">{{ brl(proj.scenarios.otimista.net) }}</b></span></div>
      <div class="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-3">
        <div><div class="text-xs text-mute">Já gerado</div><div class="num text-sm font-semibold">{{ brl(proj.generatedSoFar) }}</div></div>
        <div><div class="text-xs text-mute">Dias úteis restantes</div><div class="num text-sm font-semibold">{{ proj.remainingBizDays }}</div></div>
      </div>
    </div>
    <div v-reveal class="card flex items-center gap-4">
      <LeadGauge :pct="leadPct" :goal="data.leadGoal" />
      <div v-if="lead"><div class="text-xs text-mute">Conversão de leads · {{ monthLabel(lead.reference_month) }}</div>
        <div class="num font-display text-3xl font-semibold">{{ leadPct }}%<span class="ml-2 text-sm font-normal text-mute">meta {{ data.leadGoal }}%</span></div>
        <div class="mt-0.5 text-xs font-semibold" :style="{ color: leadState.color }">{{ leadState.label }}</div>
        <div class="text-xs text-mute">{{ lead.sales_converted }} vendas de {{ lead.leads_received }} leads</div></div>
      <div v-else><div class="text-xs text-mute">Conversão de leads · meta {{ data.leadGoal }}%</div><router-link to="/desempenho?tab=conversao" class="text-sm text-gold hover:underline">Registrar números</router-link></div>
    </div>
  </div>
  <SegTabs v-model="chartSpan" :tabs="[{ id: '3', label: '3 meses' }, { id: '6', label: '6 meses' }, { id: '12', label: '12 meses' }]" />
  <div class="mb-6 grid gap-4 lg:grid-cols-3">
    <div v-reveal class="card">
      <div class="mb-2 flex items-start justify-between gap-2">
        <div><div class="text-xs text-mute">Vendas · {{ kpi.label }}</div><div class="num font-display text-2xl font-semibold">{{ kpi.sales }}</div></div>
        <span v-if="kpi.salesD !== null" class="rounded-full px-2 py-0.5 text-xs font-semibold" :class="kpi.salesD >= 0 ? 'bg-pos/10 text-pos' : 'bg-neg/10 text-neg'">{{ kpi.salesD >= 0 ? '▲' : '▼' }} {{ Math.abs(kpi.salesD * 100).toFixed(0) }}%</span>
      </div>
      <BaseChart :config="charts.sales" :height="190" />
    </div>
    <div v-reveal class="card">
      <div class="mb-2 flex items-start justify-between gap-2">
        <div><div class="text-xs text-mute">Prêmios · {{ kpi.label }}</div><div class="num font-display text-2xl font-semibold">{{ brl(kpi.premium) }}</div></div>
        <span v-if="kpi.premiumD !== null" class="rounded-full px-2 py-0.5 text-xs font-semibold" :class="kpi.premiumD >= 0 ? 'bg-pos/10 text-pos' : 'bg-neg/10 text-neg'">{{ kpi.premiumD >= 0 ? '▲' : '▼' }} {{ Math.abs(kpi.premiumD * 100).toFixed(0) }}%</span>
      </div>
      <BaseChart :config="charts.premium" :height="190" />
    </div>
    <div v-reveal class="card">
      <div class="mb-2 flex items-start justify-between gap-2">
        <div><div class="text-xs text-mute">Comissão líquida · {{ kpi.label }}</div><div class="num font-display text-2xl font-semibold">{{ brl(kpi.net) }}</div></div>
        <span v-if="kpi.netD !== null" class="rounded-full px-2 py-0.5 text-xs font-semibold" :class="kpi.netD >= 0 ? 'bg-pos/10 text-pos' : 'bg-neg/10 text-neg'">{{ kpi.netD >= 0 ? '▲' : '▼' }} {{ Math.abs(kpi.netD * 100).toFixed(0) }}%</span>
      </div>
      <BaseChart :config="charts.commissions" :height="190" />
    </div>
  </div>
  <div class="mb-6 grid gap-4 lg:grid-cols-3">
    <div v-reveal class="card lg:col-span-2">
      <div class="grid gap-4 sm:grid-cols-2">
        <div><h2 class="mb-1 text-sm font-bold">Digital Suhai × Venda própria</h2><BaseChart :config="charts.origin" :height="210" /></div>
        <div><h2 class="mb-1 text-sm font-bold">Por produto</h2><BaseChart :config="charts.product" :height="210" /></div>
      </div>
    </div>
    <div v-reveal class="card"><h2 class="mb-1 text-sm font-bold">Cancelamentos (R$)</h2><BaseChart :config="charts.cancel" :height="210" /></div>
  </div>
  <StateSalesCard :sales="geoSales" class="mb-6" />
  <div v-reveal class="card overflow-x-auto p-0"><h2 class="p-4 pb-0 font-bold">Cadastros do período (mais recentes primeiro)</h2>
    <div class="tbl-scroll"><table class="tbl"><thead><tr><th>Cadastrada em</th><th>Data da venda</th><th>Cliente</th><th>Produto</th><th class="text-right">Prêmio</th><th class="text-right">Líquida</th><th>Status</th></tr></thead>
      <tbody><tr v-for="s in preview" :key="s.id" class="cursor-pointer" @click="router.push('/vendas/' + s.id)">
        <td>{{ new Date(s.created_at).toLocaleString('pt-BR', { timeZone: 'America/Recife' }) }}</td><td>{{ dateBR(s.sale_date) }}</td>
        <td>{{ s.clients?.full_name }}</td><td>{{ s.products?.name }}</td><td class="num text-right">{{ brl(s.premium) }}</td>
        <td class="num text-right">{{ brl(s.net_commission) }}</td><td><StatusBadge :value="s.status" /></td></tr>
        <tr v-if="!preview.length"><td colspan="7" class="py-6 text-center text-mute">Nenhuma venda neste período.</td></tr></tbody></table></div></div>
</template>
