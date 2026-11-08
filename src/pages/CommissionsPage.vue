<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useData } from '@/stores/data'
import { brl, dateBR } from '@/utils/format'
import { round2 } from '@/utils/finance'
import PageHeader from '@/components/PageHeader.vue'
import StatCard from '@/components/StatCard.vue'
import StatusBadge from '@/components/StatusBadge.vue'

const data = useData(), router = useRouter()
const rows = computed(() => data.sales)
const totals = computed(() => ({
  net: round2(rows.value.filter(s => s.status !== 'cancelada').reduce((a, s) => a + s.net_commission, 0)),
  lost: round2(data.cancellations.reduce((a, c) => a + c.lost_commission, 0)),
}))
</script>
<template>
  <PageHeader title="Comissões" sub="A comissão é sua assim que a venda é cadastrada; cancelamentos saem da conta." />
  <div class="mb-4 grid gap-3 sm:grid-cols-2">
    <StatCard label="Comissão líquida (vendas não canceladas)" :value="brl(totals.net)" tone="gold" />
    <StatCard label="Perdida por cancelamentos" :value="brl(totals.lost)" tone="warn" />
  </div>
  <div class="card overflow-x-auto p-0"><table class="tbl">
    <thead><tr><th>Venda</th><th>Cliente</th><th>Produto</th><th class="text-right">Comissão líquida</th><th>Situação</th></tr></thead>
    <tbody><tr v-for="s in rows" :key="s.id" class="cursor-pointer" @click="router.push('/vendas/' + s.id)">
      <td>{{ dateBR(s.sale_date) }}</td><td>{{ s.clients?.full_name }}</td><td>{{ s.products?.name }}</td>
      <td class="num text-right" :class="s.status === 'cancelada' ? 'text-mute line-through' : ''">{{ brl(s.net_commission) }}</td>
      <td><StatusBadge :value="s.status" /></td></tr>
      <tr v-if="!rows.length"><td colspan="5" class="py-6 text-center text-mute">Nenhuma venda cadastrada.</td></tr></tbody></table></div>
</template>
