<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase, fail } from '@/services/supabase'
import { useData } from '@/stores/data'
import { sendSaleEmail } from '@/services/mail'
import { run } from '@/composables/useToast'
import { brl, dateBR, todayISO } from '@/utils/format'
import { calcSale } from '@/utils/finance'
import PageHeader from '@/components/PageHeader.vue'
import ModalBox from '@/components/ModalBox.vue'
import StatusBadge from '@/components/StatusBadge.vue'

const data = useData(), router = useRouter()
const filters = reactive({ q: '', status: '', origin: '', insurer: '', product: '', from: '', to: '' })
const modal = ref(false)
const blank = () => ({
  id: '', client_id: '', insurer_id: data.settings?.default_insurer_id ?? '', product_id: '', sale_date: todayISO(),
  policy_start_date: '', vehicle_description: '', plate: '', proposal_number: '', policy_number: '', endorsement_number: '',
  premium: 0, insurer_percent: data.settings?.suggested_insurer_percent ?? 20, broker_percent: data.settings?.broker_percent ?? 70,
  origin: 'digital_suhai', status: 'pendente', notes: '', change_reason: '',
})
const f = reactive(blank())

const list = computed(() => data.sales.filter(s => {
  const t = filters.q.toLowerCase()
  return (!t || [s.clients?.full_name, s.plate, s.proposal_number, s.policy_number].some(x => (x ?? '').toLowerCase().includes(t))) &&
    (!filters.status || s.status === filters.status) && (!filters.origin || s.origin === filters.origin) &&
    (!filters.insurer || s.insurer_id === filters.insurer) && (!filters.product || s.product_id === filters.product) &&
    (!filters.from || s.sale_date >= filters.from) && (!filters.to || s.sale_date <= filters.to)
}).sort((a, b) => b.sale_date.localeCompare(a.sale_date)))

const preview = computed(() => calcSale(f.premium || 0, f.insurer_percent || 0, f.broker_percent || 0))
const isEdit = computed(() => !!f.id)
const original = computed(() => data.sales.find(s => s.id === f.id))
const financialEdit = computed(() => !!original.value && (original.value.premium !== f.premium || original.value.insurer_percent !== f.insurer_percent
  || original.value.status !== f.status || original.value.sale_date !== f.sale_date))

function open(id?: string) {
  const s = data.sales.find(x => x.id === id)
  Object.assign(f, s ? {
    id: s.id, client_id: s.client_id, insurer_id: s.insurer_id, product_id: s.product_id, sale_date: s.sale_date,
    policy_start_date: s.policy_start_date ?? '', vehicle_description: s.vehicle_description ?? '', plate: s.plate ?? '',
    proposal_number: s.proposal_number ?? '', policy_number: s.policy_number ?? '', endorsement_number: s.endorsement_number ?? '',
    premium: s.premium, insurer_percent: s.insurer_percent, broker_percent: s.broker_percent,
    origin: s.origin, status: s.status, notes: s.notes ?? '', change_reason: '',
  } : blank())
  modal.value = true
}
async function save() {
  if (!f.client_id || !f.product_id || !f.insurer_id) return alert('Escolha cliente, seguradora e produto.')
  if (isEdit.value && financialEdit.value && !f.change_reason.trim()) return alert('Informe a justificativa da alteração de valores, data ou status.')
  const row: Record<string, unknown> = {
    client_id: f.client_id, insurer_id: f.insurer_id, product_id: f.product_id, sale_date: f.sale_date,
    policy_start_date: f.policy_start_date || null, vehicle_description: f.vehicle_description || null, plate: f.plate || null,
    proposal_number: f.proposal_number || null, policy_number: f.policy_number || null, endorsement_number: f.endorsement_number || null,
    premium: f.premium, insurer_percent: f.insurer_percent, origin: f.origin, status: f.status, notes: f.notes || null,
  }
  if (!isEdit.value) row.broker_percent = f.broker_percent        // snapshot do percentual vigente
  else if (financialEdit.value) row.change_reason = f.change_reason  // percentual do corretor da venda nunca é recalculado
  let newId = ''
  if (await run(async () => {
    if (isEdit.value) fail((await supabase.from('sales').update(row).eq('id', f.id)).error)
    else { const r = await supabase.from('sales').insert(row).select('id').single(); fail(r.error); newId = r.data!.id }
    await data.refresh()
  }, 'Venda salva')) { modal.value = false; if (newId) void sendSaleEmail(newId) }
}
</script>
<template>
  <PageHeader title="Vendas" sub="Cada venda guarda os percentuais usados no cadastro.">
    <button class="btn btn-primary" @click="open()">Nova venda</button>
  </PageHeader>
  <div class="card mb-3 grid gap-2 sm:grid-cols-4 lg:grid-cols-7">
    <input v-model="filters.q" class="input sm:col-span-2" placeholder="Cliente, placa, proposta, apólice" aria-label="Pesquisar vendas" />
    <select v-model="filters.status" class="input" aria-label="Status"><option value="">Todos os status</option><option value="pendente">Pendente</option><option value="emitida">Emitida</option><option value="cancelada">Cancelada</option></select>
    <select v-model="filters.origin" class="input" aria-label="Origem"><option value="">Todas as origens</option><option value="digital_suhai">Digital Suhai</option><option value="venda_propria">Venda própria</option></select>
    <select v-model="filters.insurer" class="input" aria-label="Seguradora"><option value="">Seguradoras</option><option v-for="i in data.insurers" :key="i.id" :value="i.id">{{ i.name }}</option></select>
    <select v-model="filters.product" class="input" aria-label="Produto"><option value="">Produtos</option><option v-for="p in data.products" :key="p.id" :value="p.id">{{ p.name }}</option></select>
    <div class="flex gap-1"><input v-model="filters.from" type="date" class="input" aria-label="De" /><input v-model="filters.to" type="date" class="input" aria-label="Até" /></div>
  </div>
  <div class="card overflow-x-auto p-0">
    <table class="tbl">
      <thead><tr><th>Data</th><th>Cliente</th><th>Produto</th><th>Origem</th><th class="text-right">Prêmio</th><th class="text-right">Bruta</th><th class="text-right">Líquida</th><th>Status</th><th></th></tr></thead>
      <tbody>
        <tr v-for="s in list" :key="s.id">
          <td>{{ dateBR(s.sale_date) }}</td>
          <td><button class="text-left font-medium hover:text-gold" @click="router.push('/vendas/' + s.id)">{{ s.clients?.full_name }}</button>
            <div class="text-xs text-mute">{{ s.plate }} {{ s.proposal_number ? '· prop. ' + s.proposal_number : '' }}</div></td>
          <td>{{ s.products?.name }}</td><td><StatusBadge :value="s.origin" /></td>
          <td class="num text-right">{{ brl(s.premium) }}</td><td class="num text-right">{{ brl(s.gross_commission) }}</td>
          <td class="num text-right">{{ brl(s.net_commission) }}</td><td><StatusBadge :value="s.status" /></td>
          <td><button class="btn" @click="open(s.id)">Editar</button></td>
        </tr>
        <tr v-if="!list.length"><td colspan="9" class="py-6 text-center text-mute">Nenhuma venda com esses filtros.</td></tr>
      </tbody>
    </table>
  </div>

  <ModalBox :open="modal" :title="isEdit ? 'Editar venda' : 'Nova venda'" @close="modal = false">
    <div class="grid gap-3 sm:grid-cols-2">
      <div><label class="label">Cliente</label>
        <select v-model="f.client_id" class="input"><option value="">Selecione</option><option v-for="c in data.clients.filter(c => !c.archived_at)" :key="c.id" :value="c.id">{{ c.full_name }}</option></select></div>
      <div><label class="label">Data da venda</label><input v-model="f.sale_date" type="date" class="input" /></div>
      <div><label class="label">Seguradora</label><select v-model="f.insurer_id" class="input"><option v-for="i in data.insurers" :key="i.id" :value="i.id">{{ i.name }}</option></select></div>
      <div><label class="label">Produto</label><select v-model="f.product_id" class="input"><option value="">Selecione</option><option v-for="p in data.products" :key="p.id" :value="p.id">{{ p.name }}</option></select></div>
      <div><label class="label">Descrição do veículo</label><input v-model="f.vehicle_description" class="input" /></div>
      <div><label class="label">Placa</label><input v-model="f.plate" class="input" /></div>
      <div><label class="label">Nº da proposta</label><input v-model="f.proposal_number" class="input" /></div>
      <div><label class="label">Nº da apólice</label><input v-model="f.policy_number" class="input" /></div>
      <div><label class="label">Nº do endosso</label><input v-model="f.endorsement_number" class="input" /></div>
      <div><label class="label">Início de vigência (informativo)</label><input v-model="f.policy_start_date" type="date" class="input" /></div>
      <div><label class="label">Prêmio (R$)</label><input v-model.number="f.premium" type="number" step="0.01" min="0" class="input" /></div>
      <div><label class="label">Comissão da seguradora (%)</label><input v-model.number="f.insurer_percent" type="number" step="0.01" class="input" /></div>
      <div><label class="label">Percentual do corretor (%)</label><input v-model.number="f.broker_percent" type="number" class="input" :disabled="isEdit" />
        <p v-if="isEdit" class="mt-1 text-xs text-mute">Fixo desde o cadastro da venda.</p></div>
      <div><label class="label">Origem</label><select v-model="f.origin" class="input"><option value="digital_suhai">Digital Suhai</option><option value="venda_propria">Venda própria</option></select></div>
      <div><label class="label">Status</label><select v-model="f.status" class="input"><option value="pendente">Pendente</option><option value="emitida">Emitida</option><option v-if="f.status==='cancelada'" value="cancelada">Cancelada</option></select></div>
      <div class="sm:col-span-2"><label class="label">Observações</label><textarea v-model="f.notes" class="input" rows="2" /></div>
      <div v-if="isEdit && financialEdit" class="sm:col-span-2">
        <label class="label">Justificativa da alteração (obrigatória)</label><input v-model="f.change_reason" class="input" /></div>
    </div>
    <div class="card mt-3 flex flex-wrap gap-6 text-sm">
      <div>Comissão bruta <b class="num block text-base">{{ brl(preview.gross) }}</b></div>
      <div>Comissão líquida <b class="num block text-base text-gold">{{ brl(preview.net) }}</b></div>
    </div>
    <div class="mt-4 flex justify-end gap-2"><button class="btn" @click="modal = false">Cancelar</button><button class="btn btn-primary" @click="save">Salvar venda</button></div>
  </ModalBox>
</template>
