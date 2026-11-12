<script setup lang="ts">
import { computed, reactive } from 'vue'
import type { ChartConfiguration } from 'chart.js'
import { useData } from '@/stores/data'
import { brl, dateBR, monthLabel } from '@/utils/format'
import { round2 } from '@/utils/finance'
import PageHeader from '@/components/PageHeader.vue'
import StatCard from '@/components/StatCard.vue'
import BaseChart from '@/components/BaseChart.vue'
import SegTabs from '@/components/SegTabs.vue'

const data = useData()
type Row = typeof data.sales[number]
const pad = (n: number) => String(n).padStart(2, '0')
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const now = new Date(), y = now.getFullYear(), mo = now.getMonth()
const monthsBack = (n: number): [string, string] => [iso(new Date(y, mo - n + 1, 1)), iso(new Date(y, mo + 1, 0))]
const PRESETS: { id: string; label: string; range: () => [string, string] }[] = [
  { id: 'mes', label: 'Este mês', range: () => monthsBack(1) },
  { id: 'passado', label: 'Mês passado', range: () => [iso(new Date(y, mo - 1, 1)), iso(new Date(y, mo, 0))] },
  { id: '3m', label: '3 meses', range: () => monthsBack(3) },
  { id: '6m', label: '6 meses', range: () => monthsBack(6) },
  { id: 'ano', label: 'Este ano', range: () => [`${y}-01-01`, `${y}-12-31`] },
]
// abre sempre no mês atual
const f = reactive({ from: PRESETS[0].range()[0], to: PRESETS[0].range()[1], insurer: '', product: '', origin: '' })
const preset = computed({
  get: () => PRESETS.find(p => { const [a, b] = p.range(); return a === f.from && b === f.to })?.id ?? 'custom',
  set: (id: string) => { const p = PRESETS.find(x => x.id === id); if (p) { const [a, b] = p.range(); f.from = a; f.to = b } },
})
const periodLabel = computed(() => PRESETS.find(p => p.id === preset.value)?.label ?? `${dateBR(f.from)} – ${dateBR(f.to)}`)

const sum = (xs: Row[], k: 'premium' | 'gross_commission' | 'net_commission') => round2(xs.reduce((a, s) => a + s[k], 0))
const ratio = (a: number, b: number) => (b ? a / b : 0)
const pc = (n: number) => (n * 100).toFixed(1) + '%'
const match = (s: Row) => (!f.insurer || s.insurer_id === f.insurer) && (!f.product || s.product_id === f.product) && (!f.origin || s.origin === f.origin)
const within = (s: Row, a: string, b: string) => (!a || s.sale_date >= a) && (!b || s.sale_date <= b)
const rows = computed(() => data.sales.filter(s => match(s) && within(s, f.from, f.to)))
const active = computed(() => rows.value.filter(s => s.status !== 'cancelada'))
const cancelled = computed(() => rows.value.filter(s => s.status === 'cancelada'))

const m = computed(() => {
  const a = active.value, premium = sum(a, 'premium'), gross = sum(a, 'gross_commission'), net = sum(a, 'net_commission')
  return { count: a.length, premium, gross, net, lost: sum(cancelled.value, 'net_commission'), cancelRate: ratio(cancelled.value.length, rows.value.length),
    ticket: round2(ratio(premium, a.length)), avgNet: round2(ratio(net, a.length)), insurerPct: ratio(gross, premium), brokerPct: ratio(net, gross), yieldPct: ratio(net, premium) }
})

// comparação com o período anterior (meses inteiros: os mesmos meses antes; senão, o mesmo número de dias)
function prevOf(from: string, to: string): [string, string] {
  const a = new Date(from + 'T12:00:00'), b = new Date(to + 'T12:00:00')
  const wholeMonths = a.getDate() === 1 && new Date(b.getFullYear(), b.getMonth() + 1, 0).getDate() === b.getDate()
  if (wholeMonths) {
    const n = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth() + 1
    return [iso(new Date(a.getFullYear(), a.getMonth() - n, 1)), iso(new Date(a.getFullYear(), a.getMonth(), 0))]
  }
  const days = Math.round((b.getTime() - a.getTime()) / 86400000) + 1, pb = new Date(a.getTime() - 86400000)
  return [iso(new Date(pb.getTime() - (days - 1) * 86400000)), iso(pb)]
}
const prevNet = computed(() => {
  if (!f.from || !f.to) return null
  const [a, b] = prevOf(f.from, f.to)
  return sum(data.sales.filter(s => s.status !== 'cancelada' && match(s) && within(s, a, b)), 'net_commission')
})
const delta = computed(() => (prevNet.value ? (m.value.net - prevNet.value) / prevNet.value : null))

const clientOf = computed(() => new Map(data.clients.map(c => [c.id, c])))
function group(xs: Row[], key: (s: Row) => string) {
  const map = new Map<string, Row[]>()
  for (const s of xs) { const k = key(s) || '—'; const l = map.get(k) ?? []; l.push(s); map.set(k, l) }
  return [...map].map(([label, list]) => ({ label, count: list.length, premium: sum(list, 'premium'), net: sum(list, 'net_commission') })).sort((x, y2) => y2.net - x.net)
}
const sections = computed(() => [
  ['Por produto', group(active.value, s => s.products?.name ?? '')],
  ['Por origem', group(active.value, s => (s.origin === 'digital_suhai' ? 'Digital Suhai' : 'Venda própria'))],
  ['Por seguradora', group(active.value, s => s.insurers?.name ?? '')],
  ['Por estado', group(active.value, s => clientOf.value.get(s.client_id)?.state ?? 'Sem CEP')],
  ['Por cidade', group(active.value, s => { const c = clientOf.value.get(s.client_id); return c?.city ? `${c.city}/${c.state}` : 'Sem CEP' })],
] as const)
const byClient = computed(() => group(active.value, s => s.clients?.full_name ?? '').slice(0, 10))
const byMonth = computed(() => {
  const keys = [...new Set(rows.value.map(s => s.sale_date.slice(0, 7)))].sort()
  return keys.map(k => {
    const all = rows.value.filter(s => s.sale_date.startsWith(k)), a = all.filter(s => s.status !== 'cancelada')
    return { key: k, count: a.length, canceled: all.length - a.length, premium: sum(a, 'premium'), gross: sum(a, 'gross_commission'), net: sum(a, 'net_commission') }
  })
})
const best = computed(() => ({
  sale: [...active.value].sort((x, y2) => y2.net_commission - x.net_commission)[0],
  month: [...byMonth.value].sort((x, y2) => y2.net - x.net)[0],
}))
const WEEK = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const weekCounts = computed(() => WEEK.map((_, d) => active.value.filter(s => new Date(s.sale_date + 'T12:00:00').getDay() === d).length))
const bestDay = computed(() => (Math.max(...weekCounts.value) > 0 ? WEEK[weekCounts.value.indexOf(Math.max(...weekCounts.value))] : '—'))
const weekChart = computed<ChartConfiguration>(() => ({ type: 'bar', data: { labels: WEEK, datasets: [{ label: 'Vendas', data: weekCounts.value, backgroundColor: '#34C759', highlightLast: false }] } } as unknown as ChartConfiguration))
</script>
<template>
  <PageHeader title="Comissões" sub="Seus números detalhados. A comissão vale desde o cadastro; vendas canceladas ficam de fora." />

  <div class="mb-3 flex flex-wrap items-center gap-3">
    <SegTabs v-model="preset" :tabs="PRESETS.map(p => ({ id: p.id, label: p.label }))" class="!mb-0" />
    <UDateRange v-model:from="f.from" v-model:to="f.to" class="input w-64" aria-label="Período personalizado" />
  </div>
  <div class="mb-5 flex flex-wrap gap-2">
    <USelect v-model="f.insurer" class="input w-52" aria-label="Seguradora"><option value="">Todas as seguradoras</option><option v-for="i in data.insurers" :key="i.id" :value="i.id">{{ i.name }}</option></USelect>
    <USelect v-model="f.product" class="input w-52" aria-label="Produto"><option value="">Todos os produtos</option><option v-for="p in data.products" :key="p.id" :value="p.id">{{ p.name }}</option></USelect>
    <USelect v-model="f.origin" class="input w-52" aria-label="Origem"><option value="">Todas as origens</option><option value="digital_suhai">Digital Suhai</option><option value="venda_propria">Venda própria</option></USelect>
  </div>

  <div class="mb-4 grid gap-4 lg:grid-cols-3">
    <div v-reveal class="card !border-gold !bg-gold text-white dark:text-[#04210f] lg:col-span-2">
      <div class="text-sm opacity-80">Comissão líquida · {{ periodLabel }}</div>
      <div class="num mt-1 font-display text-5xl font-semibold tracking-tight">{{ brl(m.net) }}</div>
      <div v-if="delta !== null" class="mt-1 text-sm opacity-90">{{ delta >= 0 ? '▲' : '▼' }} {{ pc(Math.abs(delta)) }} em relação ao período anterior ({{ brl(prevNet ?? 0) }})</div>
      <dl class="num mt-5 grid grid-cols-2 gap-4 border-t border-current/20 pt-4 sm:grid-cols-4">
        <div><dt class="text-xs opacity-75">Vendas ativas</dt><dd class="text-xl font-semibold">{{ m.count }}</dd></div>
        <div><dt class="text-xs opacity-75">Comissão bruta</dt><dd class="text-xl font-semibold">{{ brl(m.gross) }}</dd></div>
        <div><dt class="text-xs opacity-75">Prêmios</dt><dd class="text-xl font-semibold">{{ brl(m.premium) }}</dd></div>
        <div><dt class="text-xs opacity-75">Canceladas ({{ cancelled.length }})</dt><dd class="text-xl font-semibold">{{ brl(m.lost) }}</dd></div>
      </dl>
    </div>
    <div v-reveal class="card">
      <h2 class="mb-3 text-sm font-semibold">Eficiência</h2>
      <dl class="num space-y-2.5 text-sm">
        <div class="flex justify-between"><dt class="text-mute">Prêmio médio por venda</dt><dd class="font-semibold">{{ brl(m.ticket) }}</dd></div>
        <div class="flex justify-between"><dt class="text-mute">Líquida média por venda</dt><dd class="font-semibold">{{ brl(m.avgNet) }}</dd></div>
        <div class="flex justify-between"><dt class="text-mute">% médio da seguradora</dt><dd class="font-semibold">{{ pc(m.insurerPct) }}</dd></div>
        <div class="flex justify-between"><dt class="text-mute">Sua parte sobre a bruta</dt><dd class="font-semibold">{{ pc(m.brokerPct) }}</dd></div>
        <div class="flex justify-between"><dt class="text-mute">Líquida sobre o prêmio</dt><dd class="font-semibold">{{ pc(m.yieldPct) }}</dd></div>
        <div class="flex justify-between"><dt class="text-mute">Taxa de cancelamento</dt><dd class="font-semibold">{{ pc(m.cancelRate) }}</dd></div>
      </dl>
    </div>
  </div>

  <div class="mb-4 grid gap-3 sm:grid-cols-3">
    <StatCard label="Maior comissão em uma venda" :value="best.sale ? brl(best.sale.net_commission) : '—'" :hint="best.sale ? `${best.sale.clients?.full_name ?? ''} · ${dateBR(best.sale.sale_date)}` : ''" />
    <StatCard label="Melhor mês" :value="best.month ? monthLabel(best.month.key + '-01') : '—'" :hint="best.month ? brl(best.month.net) : ''" />
    <StatCard label="Dia da semana que mais vende" :value="bestDay" />
  </div>

  <div v-if="byMonth.length > 1" v-reveal class="card mb-4 overflow-x-auto p-0"><h2 class="p-4 pb-0 font-bold">Mês a mês</h2>
    <div class="tbl-scroll"><table class="tbl"><thead><tr><th>Mês</th><th class="text-right">Vendas</th><th class="text-right">Canceladas</th><th class="text-right">Prêmio</th><th class="text-right">Bruta</th><th class="text-right">Líquida</th><th class="text-right">Líquida média</th></tr></thead>
      <tbody><tr v-for="r in byMonth" :key="r.key"><td>{{ monthLabel(r.key + '-01') }}</td><td class="num text-right">{{ r.count }}</td><td class="num text-right">{{ r.canceled }}</td>
        <td class="num text-right">{{ brl(r.premium) }}</td><td class="num text-right">{{ brl(r.gross) }}</td><td class="num text-right font-semibold text-gold">{{ brl(r.net) }}</td><td class="num text-right">{{ brl(r.count ? r.net / r.count : 0) }}</td></tr></tbody></table></div></div>

  <div class="mb-4 grid gap-4 lg:grid-cols-2">
    <div v-for="[title, list] in sections" :key="title" v-reveal class="card overflow-x-auto p-0">
      <h2 class="p-4 pb-0 font-bold">{{ title }}</h2>
      <div class="tbl-scroll"><table class="tbl"><thead><tr><th>Nome</th><th class="text-right">Vendas</th><th class="text-right">Líquida</th><th>Participação</th></tr></thead>
        <tbody><tr v-for="r in list" :key="r.label"><td>{{ r.label }}</td><td class="num text-right">{{ r.count }}</td><td class="num text-right font-semibold text-gold">{{ brl(r.net) }}</td>
          <td><div class="flex items-center gap-2"><div class="h-1.5 w-20 rounded-full bg-raise"><div class="h-1.5 rounded-full bg-gold" :style="{ width: Math.max(3, ratio(r.net, m.net) * 100) + '%' }" /></div><span class="num text-xs text-mute">{{ pc(ratio(r.net, m.net)) }}</span></div></td></tr>
          <tr v-if="!list.length"><td colspan="4" class="py-4 text-center text-mute">Sem dados.</td></tr></tbody></table></div>
    </div>
    <div v-reveal class="card"><h2 class="mb-1 font-bold">Vendas por dia da semana</h2><p class="mb-2 text-xs text-mute">Quantas vendas ativas em cada dia</p><BaseChart :config="weekChart" :height="190" /></div>
    <div v-reveal class="card overflow-x-auto p-0"><h2 class="p-4 pb-0 font-bold">10 clientes com mais comissão</h2>
      <div class="tbl-scroll"><table class="tbl"><thead><tr><th>Cliente</th><th class="text-right">Vendas</th><th class="text-right">Líquida</th></tr></thead>
        <tbody><tr v-for="r in byClient" :key="r.label"><td>{{ r.label }}</td><td class="num text-right">{{ r.count }}</td><td class="num text-right font-semibold text-gold">{{ brl(r.net) }}</td></tr>
          <tr v-if="!byClient.length"><td colspan="3" class="py-4 text-center text-mute">Sem dados.</td></tr></tbody></table></div></div>
  </div>
</template>
