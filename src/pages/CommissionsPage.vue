<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useData } from '@/stores/data'
import { brl, dateBR } from '@/utils/format'
import { financialStatus, pendingBalance, round2 } from '@/utils/finance'
import PageHeader from '@/components/PageHeader.vue'
import StatCard from '@/components/StatCard.vue'
import StatusBadge from '@/components/StatusBadge.vue'

const data = useData(), router = useRouter()
const status = ref('')
const rows = computed(() => data.sales.map(s => {
  const received = data.receivedBySale.get(s.id) ?? 0
  return { s, received, pending: pendingBalance(s, received), fin: financialStatus(s, received) }
}).filter(r => !status.value || r.fin === status.value))
const totals = computed(() => ({
  generated: round2(rows.value.filter(r => r.s.status !== 'cancelada').reduce((a, r) => a + r.s.net_commission, 0)),
  received: round2(rows.value.reduce((a, r) => a + r.received, 0)),
  pending: round2(rows.value.reduce((a, r) => a + r.pending, 0)),
}))
</script>
<template>
  <PageHeader title="Comissões e recebimentos" sub="Comissão gerada não é comissão recebida." />
  <div class="mb-4 grid gap-3 sm:grid-cols-3">
    <StatCard label="Comissão gerada (vendas não canceladas)" :value="brl(totals.generated)" />
    <StatCard label="Recebido" :value="brl(totals.received)" tone="pos" />
    <StatCard label="Pendente" :value="brl(totals.pending)" tone="warn" />
  </div>
  <select v-model="status" class="input mb-3 max-w-xs" aria-label="Situação financeira">
    <option value="">Todas as situações</option><option value="pendente">Pendente</option>
    <option value="parcialmente_recebido">Parcialmente recebido</option><option value="recebido">Recebido</option><option value="cancelada">Cancelada</option></select>
  <div class="card overflow-x-auto p-0"><table class="tbl">
    <thead><tr><th>Venda</th><th>Cliente</th><th class="text-right">Gerada</th><th class="text-right">Recebida</th><th class="text-right">Pendente</th><th>Situação</th></tr></thead>
    <tbody><tr v-for="r in rows" :key="r.s.id" class="cursor-pointer" @click="router.push('/vendas/' + r.s.id)">
      <td>{{ dateBR(r.s.sale_date) }}</td><td>{{ r.s.clients?.full_name }}</td>
      <td class="num text-right">{{ brl(r.s.net_commission) }}</td><td class="num text-right">{{ brl(r.received) }}</td>
      <td class="num text-right">{{ brl(r.pending) }}</td><td><StatusBadge :value="r.fin" /></td></tr>
      <tr v-if="!rows.length"><td colspan="6" class="py-6 text-center text-mute">Nada por aqui.</td></tr></tbody></table></div>
</template>
