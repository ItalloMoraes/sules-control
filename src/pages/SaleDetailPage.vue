<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { supabase, fail } from '@/services/supabase'
import { useData } from '@/stores/data'
import { run } from '@/composables/useToast'
import { brl, dateBR, todayISO, pct } from '@/utils/format'
import { financialStatus, pendingBalance } from '@/utils/finance'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import ModalBox from '@/components/ModalBox.vue'

const data = useData(), route = useRoute()
const id = computed(() => route.params.id as string)
const sale = computed(() => data.sales.find(s => s.id === id.value))
const receipts = computed(() => data.receipts.filter(r => r.sale_id === id.value))
const received = computed(() => data.receivedBySale.get(id.value) ?? 0)
const canc = computed(() => data.cancellations.find(c => c.sale_id === id.value))
const revs = computed(() => data.reversals.filter(r => r.sale_id === id.value))
const history = ref<{ id: number; created_at: string; table_name: string; action: string; field: string | null; old_value: string | null; new_value: string | null; justification: string | null }[]>([])

async function loadHistory() {
  const { data: rows } = await supabase.from('audit_logs').select('*')
    .or(`record_id.eq.${id.value}${receipts.value.length ? ',record_id.in.(' + receipts.value.map(r => r.id).join(',') + ')' : ''}`)
    .order('created_at', { ascending: false }).limit(100)
  history.value = (rows ?? []) as typeof history.value
}
onMounted(loadHistory)

const rec = reactive({ open: false, amount: 0, received_at: todayISO(), reference: '', notes: '', over: '' })
const cancel = reactive({ open: false, cancelled_at: todayISO(), reason: '', notes: '' })
const rev = reactive({ open: false, amount: 0, justification: '', status: 'pendente', reversal_date: '' })

async function addReceipt() {
  if (!(rec.amount > 0)) return
  if (await run(async () => {
    fail((await supabase.from('commission_receipts').insert({ sale_id: id.value, amount: rec.amount, received_at: rec.received_at,
      reference: rec.reference || null, notes: rec.notes || null, over_limit_justification: rec.over || null })).error)
    await data.refresh(); await loadHistory()
  }, 'Recebimento registrado')) { rec.open = false; rec.amount = 0; rec.over = '' }
}
async function cancelSale() {
  if (await run(async () => {
    fail((await supabase.from('cancellations').insert({ sale_id: id.value, cancelled_at: cancel.cancelled_at, reason: cancel.reason || null, notes: cancel.notes || null })).error)
    await data.refresh(); await loadHistory()
  }, received.value > 0 ? 'Cancelamento registrado. Recebimentos preservados.' : 'Cancelamento registrado como comissão perdida (sem estorno).')) cancel.open = false
}
async function addReversal() {
  if (!canc.value || !(rev.amount > 0) || !rev.justification.trim()) return alert('Informe valor e justificativa.')
  if (rev.status === 'efetivado' && !rev.reversal_date) return alert('Estorno efetivado exige a data do desconto/devolução.')
  if (await run(async () => {
    fail((await supabase.from('reversal_transactions').insert({ cancellation_id: canc.value!.id, sale_id: id.value, amount: rev.amount,
      status: rev.status, reversal_date: rev.reversal_date || null, justification: rev.justification })).error)
    await data.refresh(); await loadHistory()
  }, 'Estorno registrado')) { rev.open = false; rev.amount = 0; rev.justification = '' }
}
</script>
<template>
  <div v-if="sale">
    <PageHeader :title="sale.clients?.full_name ?? 'Venda'" :sub="`${sale.products?.name} · ${sale.insurers?.name} · ${dateBR(sale.sale_date)}`">
      <button v-if="sale.status !== 'cancelada'" class="btn" @click="rec.open = true">Registrar recebimento</button>
      <button v-if="sale.status !== 'cancelada'" class="btn btn-danger" @click="cancel.open = true">Cancelar venda</button>
      <button v-if="canc && received > 0" class="btn" @click="rev.open = true">Registrar estorno</button>
    </PageHeader>
    <div class="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <div class="card"><div class="text-xs text-mute">Prêmio</div><div class="num font-bold">{{ brl(sale.premium) }}</div></div>
      <div class="card"><div class="text-xs text-mute">Bruta ({{ pct(sale.insurer_percent, 2) }})</div><div class="num font-bold">{{ brl(sale.gross_commission) }}</div></div>
      <div class="card"><div class="text-xs text-mute">Líquida ({{ pct(sale.broker_percent, 2) }})</div><div class="num font-bold text-gold">{{ brl(sale.net_commission) }}</div></div>
      <div class="card"><div class="text-xs text-mute">Recebido</div><div class="num font-bold text-pos">{{ brl(received) }}</div></div>
      <div class="card"><div class="text-xs text-mute">Saldo pendente</div><div class="num font-bold">{{ brl(pendingBalance(sale, received)) }}</div>
        <StatusBadge :value="financialStatus(sale, received)" /></div>
    </div>
    <div class="mb-4 flex flex-wrap gap-2"><StatusBadge :value="sale.status" /><StatusBadge :value="sale.origin" />
      <span class="text-sm text-mute">Proposta {{ sale.proposal_number ?? '—' }} · Apólice {{ sale.policy_number ?? '—' }} · Placa {{ sale.plate ?? '—' }}</span></div>

    <div v-if="canc" class="card mb-4 border-neg/50">
      <h2 class="font-bold">Cancelamento em {{ dateBR(canc.cancelled_at) }}</h2>
      <p class="text-sm text-mute">{{ canc.reason || 'Sem motivo informado.' }}</p>
      <p class="mt-1 text-sm">Comissão original: <b class="num">{{ brl(canc.net_at_cancellation) }}</b> · recebida até o cancelamento: <b class="num">{{ brl(canc.received_at_cancellation) }}</b> ·
        perdida (não realizada): <b class="num text-neg">{{ brl(canc.lost_commission) }}</b></p>
    </div>

    <div class="grid gap-4 lg:grid-cols-2">
      <div class="card overflow-x-auto"><h2 class="mb-2 font-bold">Recebimentos</h2>
        <table class="tbl"><thead><tr><th>Data</th><th class="text-right">Valor</th><th>Referência</th></tr></thead>
          <tbody><tr v-for="r in receipts" :key="r.id"><td>{{ dateBR(r.received_at) }}</td><td class="num text-right">{{ brl(r.amount) }}</td>
            <td>{{ r.reference }} <span v-if="r.over_limit_justification" class="text-xs text-warn">ajuste: {{ r.over_limit_justification }}</span></td></tr>
            <tr v-if="!receipts.length"><td colspan="3" class="py-4 text-center text-mute">Nenhum recebimento ainda.</td></tr></tbody></table></div>
      <div class="card overflow-x-auto"><h2 class="mb-2 font-bold">Estornos</h2>
        <table class="tbl"><thead><tr><th>Data do desconto</th><th class="text-right">Valor</th><th>Status</th></tr></thead>
          <tbody><tr v-for="r in revs" :key="r.id"><td>{{ dateBR(r.reversal_date) }}</td><td class="num text-right">{{ brl(r.amount) }}</td><td><StatusBadge :value="r.status" /></td></tr>
            <tr v-if="!revs.length"><td colspan="3" class="py-4 text-center text-mute">Sem estornos.</td></tr></tbody></table></div>
    </div>

    <div class="card mt-4 overflow-x-auto"><h2 class="mb-2 font-bold">Histórico de alterações</h2>
      <table class="tbl"><thead><tr><th>Quando</th><th>Registro</th><th>Campo</th><th>Antes</th><th>Depois</th><th>Justificativa</th></tr></thead>
        <tbody><tr v-for="h in history" :key="h.id"><td>{{ new Date(h.created_at).toLocaleString('pt-BR', { timeZone: 'America/Recife' }) }}</td>
          <td>{{ h.table_name }} · {{ h.action }}</td><td>{{ h.field }}</td>
          <td class="max-w-[14rem] truncate">{{ h.old_value }}</td><td class="max-w-[14rem] truncate">{{ h.new_value }}</td><td>{{ h.justification }}</td></tr>
          <tr v-if="!history.length"><td colspan="6" class="py-4 text-center text-mute">Sem alterações registradas.</td></tr></tbody></table></div>

    <ModalBox :open="rec.open" title="Registrar recebimento" @close="rec.open = false">
      <div class="grid gap-3 sm:grid-cols-2">
        <div><label class="label">Valor recebido</label><input v-model.number="rec.amount" type="number" step="0.01" class="input" /></div>
        <div><label class="label">Data</label><UDate v-model="rec.received_at" class="input" /></div>
        <div class="sm:col-span-2"><label class="label">Descrição ou referência</label><input v-model="rec.reference" class="input" /></div>
        <div class="sm:col-span-2"><label class="label">Observação</label><input v-model="rec.notes" class="input" /></div>
        <div class="sm:col-span-2"><label class="label">Justificativa (apenas se exceder o valor devido)</label><input v-model="rec.over" class="input" /></div>
      </div>
      <div class="mt-4 flex justify-end gap-2"><button class="btn" @click="rec.open = false">Cancelar</button><button class="btn btn-primary" @click="addReceipt">Registrar</button></div>
    </ModalBox>
    <ModalBox :open="cancel.open" title="Cancelar venda" @close="cancel.open = false">
      <p class="mb-3 text-sm text-mute">A venda e os recebimentos são preservados. {{ received > 0 ? 'Como já há comissão recebida, você poderá registrar estornos quando houver desconto ou devolução efetiva.' : 'Sem comissão recebida, não há estorno: o valor vira comissão perdida.' }}</p>
      <div class="grid gap-3"><div><label class="label">Data do cancelamento</label><UDate v-model="cancel.cancelled_at" class="input" /></div>
        <div><label class="label">Motivo</label><input v-model="cancel.reason" class="input" /></div></div>
      <div class="mt-4 flex justify-end gap-2"><button class="btn" @click="cancel.open = false">Voltar</button><button class="btn btn-danger" @click="cancelSale">Confirmar cancelamento</button></div>
    </ModalBox>
    <ModalBox :open="rev.open" title="Registrar estorno" @close="rev.open = false">
      <div class="grid gap-3 sm:grid-cols-2">
        <div><label class="label">Valor do estorno</label><input v-model.number="rev.amount" type="number" step="0.01" class="input" /></div>
        <div><label class="label">Status</label><USelect v-model="rev.status" class="input"><option value="pendente">Pendente</option><option value="efetivado">Efetivado (desconto já ocorreu)</option></USelect></div>
        <div v-if="rev.status === 'efetivado'"><label class="label">Data do desconto/devolução</label><UDate v-model="rev.reversal_date" class="input" /></div>
        <div class="sm:col-span-2"><label class="label">Justificativa</label><input v-model="rev.justification" class="input" /></div>
      </div>
      <div class="mt-4 flex justify-end gap-2"><button class="btn" @click="rev.open = false">Cancelar</button><button class="btn btn-primary" @click="addReversal">Registrar</button></div>
    </ModalBox>
  </div>
  <p v-else class="text-mute">Venda não encontrada.</p>
</template>
