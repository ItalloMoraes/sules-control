<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import type { ChartConfiguration } from 'chart.js'
import { useData } from '@/stores/data'
import { brl, dateBR, monthLabel, todayISO } from '@/utils/format'
import { monthKeys, round2 } from '@/utils/finance'
import PageHeader from '@/components/PageHeader.vue'
import StatCard from '@/components/StatCard.vue'
import BaseChart from '@/components/BaseChart.vue'

const data = useData(), router = useRouter()
const k = computed(() => ({
  count: data.cancellations.length,
  lost: round2(data.cancellations.reduce((a, c) => a + c.net_at_cancellation, 0)),
  rate: data.sales.length ? data.cancellations.length / data.sales.length : 0,
}))
const evolution = computed<ChartConfiguration>(() => {
  const keys = monthKeys(new Date(Date.UTC(+todayISO().slice(0, 4), +todayISO().slice(5, 7) - 6, 1)).toISOString().slice(0, 7), 6)
  return { type: 'bar', data: { labels: keys.map(x => monthLabel(x + '-01')), datasets: [
    { label: 'Cancelamentos', data: keys.map(x => data.cancellations.filter(c => c.cancelled_at.startsWith(x)).length), backgroundColor: '#FF453A' }] } }
})
const withSale = (saleId: string) => data.sales.find(s => s.id === saleId)
</script>
<template>
  <PageHeader title="Cancelamentos" sub="Cada cancelamento tira a comissão daquela venda do total." />
  <div class="mb-4 grid gap-3 sm:grid-cols-3">
    <StatCard label="Cancelamentos" :value="String(k.count)" />
    <StatCard label="Comissão descontada" :value="brl(k.lost)" tone="warn" />
    <StatCard label="Taxa de cancelamento" :value="(k.rate * 100).toFixed(1) + '%'" />
  </div>
  <div v-reveal class="card mb-4"><h2 class="mb-2 font-bold">Últimos 6 meses</h2><BaseChart :config="evolution" :height="160" /></div>
  <div v-reveal class="card overflow-x-auto p-0"><table class="tbl">
    <thead><tr><th>Cancelada em</th><th>Cliente</th><th class="text-right">Comissão descontada</th><th>Motivo</th></tr></thead>
    <tbody><tr v-for="c in data.cancellations" :key="c.id" class="cursor-pointer" @click="router.push('/vendas/' + c.sale_id)">
      <td>{{ dateBR(c.cancelled_at) }}</td><td>{{ withSale(c.sale_id)?.clients?.full_name }}</td>
      <td class="num text-right">{{ brl(c.net_at_cancellation) }}</td><td>{{ c.reason }}</td></tr>
      <tr v-if="!data.cancellations.length"><td colspan="4" class="py-6 text-center text-mute">Nenhum cancelamento.</td></tr></tbody></table></div>
</template>
