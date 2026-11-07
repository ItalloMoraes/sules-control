<script setup lang="ts">
import { computed, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { supabase, fail } from '@/services/supabase'
import { useData } from '@/stores/data'
import { run } from '@/composables/useToast'
import { brl, dateBR, monthLabel, todayISO } from '@/utils/format'
import { monthKeys, round2 } from '@/utils/finance'
import PageHeader from '@/components/PageHeader.vue'
import StatCard from '@/components/StatCard.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import BaseChart from '@/components/BaseChart.vue'
import ModalBox from '@/components/ModalBox.vue'

const data = useData(), router = useRouter()
const eff = reactive({ open: false, id: '', amount: 0, date: todayISO() })

const nonPending = computed(() => data.sales.filter(s => s.status !== 'pendente').length)
const k = computed(() => ({
  count: data.cancellations.length,
  lost: round2(data.cancellations.reduce((a, c) => a + c.lost_commission, 0)),
  pending: round2(data.reversals.filter(r => r.status === 'pendente').reduce((a, r) => a + r.amount, 0)),
  effective: round2(data.reversals.filter(r => r.status === 'efetivado').reduce((a, r) => a + r.amount, 0)),
  rate: nonPending.value ? data.cancellations.length / nonPending.value : 0,
}))
const evolution = computed(() => {
  const keys = monthKeys(new Date(Date.UTC(+todayISO().slice(0, 4), +todayISO().slice(5, 7) - 12, 1)).toISOString().slice(0, 7), 12)
  return {
    type: 'bar' as const,
    data: { labels: keys.map(x => monthLabel(x + '-01')), datasets: [
      { label: 'Cancelamentos', data: keys.map(x => data.cancellations.filter(c => c.cancelled_at.startsWith(x)).length), backgroundColor: '#EF6B5B' },
    ] },
  }
})
const withSale = (saleId: string) => data.sales.find(s => s.id === saleId)
function openEff(r: typeof data.reversals[number]) { Object.assign(eff, { open: true, id: r.id, amount: r.amount, date: todayISO() }) }
async function confirmEff() {
  if (await run(async () => {
    fail((await supabase.from('reversal_transactions').update({ status: 'efetivado', amount: eff.amount, reversal_date: eff.date }).eq('id', eff.id)).error)
    await data.refresh()
  }, 'Estorno efetivado. O impacto financeiro vale a partir da data do desconto.')) eff.open = false
}
async function dismiss(id: string) {
  if (!confirm_('Marcar este estorno como cancelado?')) return
  await run(async () => { fail((await supabase.from('reversal_transactions').update({ status: 'cancelado' }).eq('id', id)).error); await data.refresh() }, 'Estorno cancelado')
}
const confirm_ = (m: string) => window.confirm(m)
</script>
<template>
  <PageHeader title="Cancelamentos e estornos" sub="Nenhum histórico é apagado. Só estornos efetivados entram no resultado." />
  <div class="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
    <StatCard label="Cancelamentos" :value="String(k.count)" />
    <StatCard label="Comissão perdida (antes do recebimento)" :value="brl(k.lost)" tone="warn" />
    <StatCard label="Estornos pendentes" :value="brl(k.pending)" tone="warn" />
    <StatCard label="Estornos efetivados / total descontado" :value="brl(k.effective)" tone="neg" />
    <StatCard label="Taxa de cancelamento" :value="(k.rate * 100).toFixed(1) + '%'" />
  </div>
  <div class="card mb-4"><h2 class="mb-2 font-bold">Evolução mensal</h2><BaseChart :config="evolution" :height="200" /></div>

  <div class="card mb-4 overflow-x-auto p-0"><h2 class="p-4 pb-0 font-bold">Cancelamentos</h2><table class="tbl">
    <thead><tr><th>Data</th><th>Cliente</th><th class="text-right">Comissão original</th><th class="text-right">Recebida</th><th class="text-right">Perdida</th><th>Motivo</th></tr></thead>
    <tbody><tr v-for="c in data.cancellations" :key="c.id" class="cursor-pointer" @click="router.push('/vendas/' + c.sale_id)">
      <td>{{ dateBR(c.cancelled_at) }}</td><td>{{ withSale(c.sale_id)?.clients?.full_name }}</td>
      <td class="num text-right">{{ brl(c.net_at_cancellation) }}</td><td class="num text-right">{{ brl(c.received_at_cancellation) }}</td>
      <td class="num text-right">{{ brl(c.lost_commission) }}</td><td>{{ c.reason }}</td></tr>
      <tr v-if="!data.cancellations.length"><td colspan="6" class="py-6 text-center text-mute">Nenhum cancelamento.</td></tr></tbody></table></div>

  <div class="card overflow-x-auto p-0"><h2 class="p-4 pb-0 font-bold">Estornos</h2><table class="tbl">
    <thead><tr><th>Cliente</th><th>Data do desconto</th><th class="text-right">Valor</th><th>Status</th><th>Justificativa</th><th></th></tr></thead>
    <tbody><tr v-for="r in data.reversals" :key="r.id">
      <td>{{ withSale(r.sale_id)?.clients?.full_name }}</td><td>{{ dateBR(r.reversal_date) }}</td>
      <td class="num text-right">{{ brl(r.amount) }}</td><td><StatusBadge :value="r.status" /></td><td>{{ r.justification }}</td>
      <td class="whitespace-nowrap text-right"><template v-if="r.status === 'pendente'">
        <button class="btn" @click="openEff(r)">Efetivar</button><button class="btn ml-1" @click="dismiss(r.id)">Cancelar</button></template></td></tr>
      <tr v-if="!data.reversals.length"><td colspan="6" class="py-6 text-center text-mute">Sem estornos.</td></tr></tbody></table></div>

  <ModalBox :open="eff.open" title="Efetivar estorno" @close="eff.open = false">
    <p class="mb-3 text-sm text-mute">Informe o valor efetivamente descontado e a data em que ocorreu.</p>
    <div class="grid gap-3 sm:grid-cols-2"><div><label class="label">Valor descontado</label><input v-model.number="eff.amount" type="number" step="0.01" class="input" /></div>
      <div><label class="label">Data do desconto</label><input v-model="eff.date" type="date" class="input" /></div></div>
    <div class="mt-4 flex justify-end gap-2"><button class="btn" @click="eff.open = false">Voltar</button><button class="btn btn-primary" @click="confirmEff">Confirmar desconto</button></div>
  </ModalBox>
</template>
