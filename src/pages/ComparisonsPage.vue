<script setup lang="ts">
import { computed, ref } from 'vue'
import { useData } from '@/stores/data'
import { addMonths, brl, monthLabel, todayISO } from '@/utils/format'
import { monthPeriod, summarize, type Summary } from '@/utils/finance'
import PageHeader from '@/components/PageHeader.vue'

const data = useData()
const mode = ref('mes_anterior')
const cur = todayISO().slice(0, 7), curStart = cur + '-01'
const range = (n: number) => ({ from: addMonths(curStart, -(n - 1)), to: monthPeriod(cur).to })
interface Col { label: string; s: Summary }
const cols = computed<Col[]>(() => {
  const S = (label: string, from: string, to: string, f?: (s: typeof data.sales[number]) => boolean): Col => ({ label, s: summarize(data.dataset, { from, to }, f) })
  const prev = monthPeriod(addMonths(curStart, -1).slice(0, 7)), now = monthPeriod(cur)
  const r3 = range(3), r6 = range(6), r12 = range(12)
  switch (mode.value) {
    case 'mes_anterior': return [S('Mês anterior', prev.from, prev.to), S('Mês atual', now.from, now.to)]
    case '3': return [S('Últimos 3 meses', r3.from, r3.to)]
    case '6': return [S('Últimos 6 meses', r6.from, r6.to)]
    case '12': return [S('Últimos 12 meses', r12.from, r12.to)]
    case 'mesmo_mes': { const ly = monthPeriod(addMonths(curStart, -12).slice(0, 7)); return [S(monthLabel(ly.from), ly.from, ly.to), S(monthLabel(now.from), now.from, now.to)] }
    case 'origem': return ['digital_suhai', 'venda_propria'].map(o => S(o === 'digital_suhai' ? 'Digital Suhai' : 'Venda própria', r12.from, r12.to, s => s.origin === o))
    case 'seguradora': return data.insurers.map(i => S(i.name, r12.from, r12.to, s => s.insurer_id === i.id))
    case 'produto': return data.products.filter(p => /moto|auto/i.test(p.name)).map(p => S(p.name, r12.from, r12.to, s => s.product_id === p.id))
  }
  return []
})
const metrics: [string, (s: Summary) => string][] = [
  ['Vendas', s => String(s.issuedCount)], ['Prêmios', s => brl(s.premium)], ['Comissão bruta', s => brl(s.gross)],
  ['Comissão líquida', s => brl(s.net)], ['Estornos efetivados', s => brl(s.reversalsEffective)],
  ['Ticket médio (prêmio)', s => brl(s.issuedCount ? s.premium / s.issuedCount : 0)],
  ['Taxa de cancelamento', s => (s.cancellationRate * 100).toFixed(1) + '%'],
]
</script>
<template>
  <PageHeader title="Comparativos">
    <USelect v-model="mode" class="input" aria-label="Tipo de comparação">
      <option value="mes_anterior">Mês atual × mês anterior</option><option value="3">Últimos 3 meses</option><option value="6">Últimos 6 meses</option>
      <option value="12">Últimos 12 meses</option><option value="mesmo_mes">Mesmo mês em anos diferentes</option>
      <option value="origem">Digital Suhai × Venda própria (12m)</option><option value="seguradora">Seguradora × seguradora (12m)</option><option value="produto">Moto × Auto (12m)</option></USelect>
  </PageHeader>
  <div class="card overflow-x-auto p-0"><table class="tbl"><thead><tr><th>Métrica</th><th v-for="c in cols" :key="c.label" class="text-right">{{ c.label }}</th></tr></thead>
    <tbody><tr v-for="[name, fn] in metrics" :key="name"><td>{{ name }}</td><td v-for="c in cols" :key="c.label" class="num text-right">{{ fn(c.s) }}</td></tr></tbody></table></div>
</template>
