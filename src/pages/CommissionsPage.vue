<script setup lang="ts">
import { computed, reactive } from 'vue'
import type { ChartConfiguration } from 'chart.js'
import { useData } from '@/stores/data'
import { brl, dateBR, monthEnd, monthLabel, todayISO } from '@/utils/format'
import { round2 } from '@/utils/finance'
import PageHeader from '@/components/PageHeader.vue'
import StatCard from '@/components/StatCard.vue'
import BaseChart from '@/components/BaseChart.vue'

const data = useData()
type Row = typeof data.sales[number]
const today = todayISO()
const f = reactive({ from: new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 6, 1)).toISOString().slice(0, 10), to: monthEnd(today) })
const rows = computed(() => data.sales.filter(s => (!f.from || s.sale_date >= f.from) && (!f.to || s.sale_date <= f.to)))
const active = computed(() => rows.value.filter(s => s.status !== 'cancelada'))
const cancelled = computed(() => rows.value.filter(s => s.status === 'cancelada'))
const sum = (xs: Row[], k: 'premium' | 'gross_commission' | 'net_commission') => round2(xs.reduce((a, s) => a + s[k], 0))
const ratio = (a: number, b: number) => (b ? a / b : 0)
const pc = (n: number) => (n * 100).toFixed(1) + '%'

const m = computed(() => {
  const a = active.value, premium = sum(a, 'premium'), gross = sum(a, 'gross_commission'), net = sum(a, 'net_commission')
  return { count: a.length, premium, gross, net, lost: sum(cancelled.value, 'net_commission'), cancelRate: ratio(cancelled.value.length, rows.value.length),
    ticket: round2(ratio(premium, a.length)), avgNet: round2(ratio(net, a.length)), avgGross: round2(ratio(gross, a.length)),
    insurerPct: ratio(gross, premium), brokerPct: ratio(net, gross), yieldPct: ratio(net, premium) }
})

function group(xs: Row[], key: (s: Row) => string) {
  const map = new Map<string, Row[]>()
  for (const s of xs) { const k = key(s) || '—'; const l = map.get(k) ?? []; l.push(s); map.set(k, l) }
  return [...map].map(([label, list]) => ({ label, count: list.length, premium: sum(list, 'premium'), gross: sum(list, 'gross_commission'), net: sum(list, 'net_commission') })).sort((x, y) => y.net - x.net)
}
const byProduct = computed(() => group(active.value, s => s.products?.name ?? ''))
const byInsurer = computed(() => group(active.value, s => s.insurers?.name ?? ''))
const byOrigin = computed(() => group(active.value, s => (s.origin === 'digital_suhai' ? 'Digital Suhai' : 'Venda própria')))
const sections = computed(() => [['Por produto', byProduct.value], ['Por origem', byOrigin.value], ['Por seguradora', byInsurer.value]] as const)
const byClient = computed(() => group(active.value, s => s.clients?.full_name ?? '').slice(0, 10))
const byMonth = computed(() => {
  const keys = [...new Set(rows.value.map(s => s.sale_date.slice(0, 7)))].sort()
  return keys.map(k => {
    const all = rows.value.filter(s => s.sale_date.startsWith(k)), a = all.filter(s => s.status !== 'cancelada')
    return { key: k, count: a.length, canceled: all.length - a.length, premium: sum(a, 'premium'), gross: sum(a, 'gross_commission'), net: sum(a, 'net_commission') }
  })
})
const best = computed(() => {
  const sale = [...active.value].sort((x, y) => y.net_commission - x.net_commission)[0]
  const month = [...byMonth.value].sort((x, y) => y.net - x.net)[0]
  return { sale, month }
})
const WEEK = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const weekCounts = computed(() => WEEK.map((_, d) => active.value.filter(s => new Date(s.sale_date + 'T12:00:00').getDay() === d).length))
const bestDay = computed(() => (Math.max(...weekCounts.value) > 0 ? WEEK[weekCounts.value.indexOf(Math.max(...weekCounts.value))] : '—'))
const weekChart = computed<ChartConfiguration>(() => ({ type: 'bar', data: { labels: WEEK, datasets: [{ label: 'Vendas', data: weekCounts.value, backgroundColor: '#34C759' }] } }))
</script>
<template>
  <PageHeader title="Comissões" sub="Seus números detalhados. A comissão vale desde o cadastro; vendas canceladas ficam de fora." />
  <div class="card mb-4 filters"><UDateRange v-model:from="f.from" v-model:to="f.to" class="input" aria-label="Período" /></div>

  <div class="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    <StatCard label="Comissão líquida" :value="brl(m.net)" tone="gold" :hint="`${m.count} vendas ativas`" />
    <StatCard label="Comissão bruta" :value="brl(m.gross)" hint="Prêmio × % da seguradora" />
    <StatCard label="Prêmios totais" :value="brl(m.premium)" />
    <StatCard label="Comissão das vendas canceladas" :value="brl(m.lost)" tone="warn" :hint="`${cancelled.length} canceladas`" />
    <StatCard label="Prêmio médio por venda" :value="brl(m.ticket)" />
    <StatCard label="Comissão líquida média por venda" :value="brl(m.avgNet)" />
    <StatCard label="% médio da seguradora" :value="pc(m.insurerPct)" hint="Bruta ÷ prêmio" />
    <StatCard label="Sua parte sobre a bruta" :value="pc(m.brokerPct)" hint="Líquida ÷ bruta" />
    <StatCard label="Líquida sobre o prêmio" :value="pc(m.yieldPct)" />
    <StatCard label="Taxa de cancelamento" :value="pc(m.cancelRate)" />
    <StatCard label="Melhor mês" :value="best.month ? monthLabel(best.month.key + '-01') : '—'" :hint="best.month ? brl(best.month.net) : ''" />
    <StatCard label="Maior comissão em uma venda" :value="best.sale ? brl(best.sale.net_commission) : '—'" :hint="best.sale ? `${best.sale.clients?.full_name ?? ''} · ${dateBR(best.sale.sale_date)}` : ''" />
  </div>

  <div v-reveal class="card mb-4 overflow-x-auto p-0"><h2 class="p-4 pb-0 font-bold">Mês a mês</h2>
    <div class="overflow-x-auto"><table class="tbl"><thead><tr><th>Mês</th><th class="text-right">Vendas</th><th class="text-right">Canceladas</th><th class="text-right">Prêmio</th><th class="text-right">Bruta</th><th class="text-right">Líquida</th><th class="text-right">Líquida média</th></tr></thead>
      <tbody><tr v-for="r in byMonth" :key="r.key"><td>{{ monthLabel(r.key + '-01') }}</td><td class="num text-right">{{ r.count }}</td><td class="num text-right">{{ r.canceled }}</td>
        <td class="num text-right">{{ brl(r.premium) }}</td><td class="num text-right">{{ brl(r.gross) }}</td><td class="num text-right font-semibold text-gold">{{ brl(r.net) }}</td><td class="num text-right">{{ brl(r.count ? r.net / r.count : 0) }}</td></tr>
        <tr v-if="!byMonth.length"><td colspan="7" class="py-6 text-center text-mute">Sem vendas no período.</td></tr></tbody></table></div></div>

  <div class="mb-4 grid gap-4 lg:grid-cols-2">
    <div v-for="[title, list] in sections" :key="title" v-reveal class="card overflow-x-auto p-0">
      <h2 class="p-4 pb-0 font-bold">{{ title }}</h2>
      <div class="overflow-x-auto"><table class="tbl"><thead><tr><th>Nome</th><th class="text-right">Vendas</th><th class="text-right">Prêmio</th><th class="text-right">Líquida</th><th class="text-right">% da líquida</th></tr></thead>
        <tbody><tr v-for="r in list" :key="r.label"><td>{{ r.label }}</td><td class="num text-right">{{ r.count }}</td><td class="num text-right">{{ brl(r.premium) }}</td>
          <td class="num text-right font-semibold text-gold">{{ brl(r.net) }}</td><td class="num text-right">{{ pc(ratio(r.net, m.net)) }}</td></tr>
          <tr v-if="!list.length"><td colspan="5" class="py-4 text-center text-mute">Sem dados.</td></tr></tbody></table></div>
    </div>
    <div v-reveal class="card"><h2 class="mb-1 font-bold">Vendas por dia da semana</h2><p class="mb-2 text-xs text-mute">Dia com mais vendas: {{ bestDay }}</p><BaseChart :config="weekChart" :height="180" /></div>
  </div>

  <div v-reveal class="card overflow-x-auto p-0"><h2 class="p-4 pb-0 font-bold">10 clientes com mais comissão</h2>
    <div class="overflow-x-auto"><table class="tbl"><thead><tr><th>Cliente</th><th class="text-right">Vendas</th><th class="text-right">Prêmio</th><th class="text-right">Líquida</th></tr></thead>
      <tbody><tr v-for="r in byClient" :key="r.label"><td>{{ r.label }}</td><td class="num text-right">{{ r.count }}</td><td class="num text-right">{{ brl(r.premium) }}</td><td class="num text-right font-semibold text-gold">{{ brl(r.net) }}</td></tr>
        <tr v-if="!byClient.length"><td colspan="4" class="py-4 text-center text-mute">Sem dados.</td></tr></tbody></table></div></div>
</template>
