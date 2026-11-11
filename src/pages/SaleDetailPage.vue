<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase, fail } from '@/services/supabase'
import { useData } from '@/stores/data'
import { notify, run } from '@/composables/useToast'
import { brl, dateBR, todayISO, pct } from '@/utils/format'
import { proposalUrl } from '@/services/proposals'
import { useCepField } from '@/composables/useCepField'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import ModalBox from '@/components/ModalBox.vue'
import CopyBtn from '@/components/CopyBtn.vue'

const data = useData(), route = useRoute(), router = useRouter()
const id = computed(() => route.params.id as string)
const sale = computed(() => data.sales.find(s => s.id === id.value))
const client = computed(() => data.clients.find(c => c.id === sale.value?.client_id))
const canc = computed(() => data.cancellations.find(c => c.sale_id === id.value))

const pdf = reactive({ open: false, url: '' })
async function openPdf() {
  try { pdf.url = await proposalUrl(sale.value!.proposal_pdf_path!); pdf.open = true } catch (e) { notify((e as Error).message, 'err') }
}

const history = ref<{ id: number; created_at: string; table_name: string; action: string; field: string | null; old_value: string | null; new_value: string | null; justification: string | null }[]>([])
async function loadHistory() {
  const { data: rows } = await supabase.from('audit_logs').select('*').eq('record_id', id.value).order('created_at', { ascending: false }).limit(100)
  history.value = (rows ?? []) as typeof history.value
}
onMounted(loadHistory)

// Cancelar: a comissão da venda sai do total. Excluir: apaga a venda de vez (não vira cancelamento).
const cancel = reactive({ open: false, cancelled_at: todayISO(), reason: '', notes: '' })
async function cancelSale() {
  if (await run(async () => {
    fail((await supabase.from('cancellations').insert({ sale_id: id.value, cancelled_at: cancel.cancelled_at, reason: cancel.reason || null, notes: cancel.notes || null })).error)
    await data.refresh(); await loadHistory()
  }, 'Cancelamento registrado. A comissão desta venda saiu do total.')) cancel.open = false
}
async function deleteSale() {
  if (!sale.value || !confirm('Excluir esta venda definitivamente? Ela some do sistema e NÃO vai para os cancelamentos. Se o cliente cancelou, use "Cancelar venda".')) return
  const path = sale.value.proposal_pdf_path
  if (await run(async () => {
    fail((await supabase.from('sales').delete().eq('id', id.value)).error)
    if (path) await supabase.storage.from('proposals').remove([path])
    await data.refresh()
  }, 'Venda excluída')) router.push('/vendas')
}

const ed = reactive({ open: false, full_name: '', cpf: '', phone: '', email: '', cep: '', street: '', neighborhood: '', city: '', state: '' })
const cepEd = useCepField(ed)
function openClient() {
  const c = client.value
  if (!c) return
  Object.assign(ed, { open: true, full_name: c.full_name, cpf: c.cpf ?? '', phone: c.phone ?? '', email: c.email ?? '', cep: c.cep ?? '', street: c.street ?? '', neighborhood: c.neighborhood ?? '', city: c.city ?? '', state: c.state ?? '' })
  cepEd.refresh()
}
async function saveClient() {
  if (!client.value || !ed.full_name.trim()) return alert('Informe o nome do cliente.')
  if (await run(async () => {
    fail((await supabase.from('clients').update({ full_name: ed.full_name.trim(), cpf: ed.cpf.trim() || null, phone: ed.phone.trim() || null, email: ed.email.trim() || null, cep: ed.cep.replace(/\D/g, '') || null, street: ed.street || null, neighborhood: ed.neighborhood || null, city: ed.city || null, state: ed.state || null }).eq('id', client.value!.id)).error)
    await data.refresh()
  }, 'Cliente atualizado')) ed.open = false
}
</script>
<template>
  <div v-if="sale">
    <PageHeader :title="sale.clients?.full_name ?? 'Venda'" :sub="`${sale.products?.name} · ${sale.insurers?.name} · ${dateBR(sale.sale_date)}`">
      <button v-if="sale.proposal_pdf_path" class="btn" @click="openPdf">Ver proposta</button>
      <button class="btn" @click="openClient">Editar cliente</button>
      <button v-if="sale.status !== 'cancelada'" class="btn btn-danger" @click="cancel.open = true">Cancelar venda</button>
      <button class="btn btn-danger" @click="deleteSale">Excluir venda</button>
    </PageHeader>
    <div class="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div class="card"><div class="text-xs text-mute">Prêmio</div><div class="num font-bold">{{ brl(sale.premium) }}</div></div>
      <div class="card"><div class="text-xs text-mute">Bruta ({{ pct(sale.insurer_percent, 2) }})</div><div class="num font-bold">{{ brl(sale.gross_commission) }}</div></div>
      <div class="card"><div class="text-xs text-mute">Líquida ({{ pct(sale.broker_percent, 2) }})</div><div class="num font-bold text-gold">{{ brl(sale.net_commission) }}</div></div>
    </div>
    <div class="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1"><StatusBadge :value="sale.status" /><StatusBadge :value="sale.origin" />
      <span class="inline-flex items-center gap-0.5 text-sm text-mute">Proposta {{ sale.proposal_number ?? '—' }}<CopyBtn v-if="sale.proposal_number" :text="sale.proposal_number" label="Copiar proposta" /></span>
      <span class="inline-flex items-center gap-0.5 text-sm text-mute">Apólice {{ sale.policy_number ?? '—' }}<CopyBtn v-if="sale.policy_number" :text="sale.policy_number" label="Copiar apólice" /></span>
      <span class="inline-flex items-center gap-0.5 text-sm text-mute">Placa {{ sale.plate ?? '—' }}</span>
      <span v-if="client?.cpf" class="inline-flex items-center gap-0.5 text-sm text-mute">CPF {{ client.cpf }}<CopyBtn :text="client.cpf" label="Copiar CPF" /></span>
      <span v-if="client?.phone" class="inline-flex items-center gap-0.5 text-sm text-mute">{{ client.phone }}<CopyBtn :text="client.phone" label="Copiar telefone" /></span>
      <span v-if="client?.city" class="inline-flex items-center gap-0.5 text-sm text-mute">{{ client.city }}/{{ client.state }}</span>
      <span v-if="client?.email" class="inline-flex items-center gap-0.5 text-sm text-mute">{{ client.email }}<CopyBtn :text="client.email" label="Copiar e-mail" /></span></div>

    <div v-if="canc" class="card mb-4 border-neg/50">
      <h2 class="font-bold">Cancelada em {{ dateBR(canc.cancelled_at) }}</h2>
      <p class="text-sm text-mute">{{ canc.reason || 'Sem motivo informado.' }}</p>
      <p class="mt-1 text-sm">Comissão descontada do total: <b class="num text-neg">{{ brl(canc.net_at_cancellation) }}</b></p>
    </div>

    <div class="card overflow-x-auto"><h2 class="mb-2 font-bold">Histórico de alterações</h2>
      <table class="tbl"><thead><tr><th>Quando</th><th>Registro</th><th>Campo</th><th>Antes</th><th>Depois</th><th>Justificativa</th></tr></thead>
        <tbody><tr v-for="h in history" :key="h.id"><td>{{ new Date(h.created_at).toLocaleString('pt-BR', { timeZone: 'America/Recife' }) }}</td>
          <td>{{ h.table_name }} · {{ h.action }}</td><td>{{ h.field }}</td>
          <td class="max-w-[14rem] truncate">{{ h.old_value }}</td><td class="max-w-[14rem] truncate">{{ h.new_value }}</td><td>{{ h.justification }}</td></tr>
          <tr v-if="!history.length"><td colspan="6" class="py-4 text-center text-mute">Sem alterações registradas.</td></tr></tbody></table></div>

    <ModalBox :open="cancel.open" title="Cancelar venda" @close="cancel.open = false">
      <p class="mb-3 text-sm text-mute">A comissão desta venda sai do total, no mês da venda. Se foi lançada por engano, use "Excluir venda".</p>
      <div class="grid gap-3"><div><label class="label">Data do cancelamento</label><UDate v-model="cancel.cancelled_at" class="input" /></div>
        <div><label class="label">Motivo</label><input v-model="cancel.reason" class="input" /></div></div>
      <div class="mt-4 flex justify-end gap-2"><button class="btn" @click="cancel.open = false">Voltar</button><button class="btn btn-danger" @click="cancelSale">Confirmar cancelamento</button></div>
    </ModalBox>
    <ModalBox :open="ed.open" title="Editar cliente" @close="ed.open = false">
      <div class="grid gap-3 sm:grid-cols-2">
        <div class="sm:col-span-2"><label class="label" for="en">Nome</label><input id="en" v-model="ed.full_name" class="input" /></div>
        <div><label class="label" for="ec">CPF</label><input id="ec" v-model="ed.cpf" class="input" inputmode="numeric" /></div>
        <div><label class="label" for="et">Telefone</label><input id="et" v-model="ed.phone" class="input" inputmode="tel" /></div>
        <div class="sm:col-span-2"><label class="label" for="ee">E-mail</label><input id="ee" v-model="ed.email" type="email" class="input" /></div>
        <div><label class="label" for="ecp">CEP</label><input id="ecp" v-model="ed.cep" class="input" inputmode="numeric" maxlength="9" placeholder="00000-000" @input="cepEd.onInput" /></div>
        <div class="flex items-end pb-2 text-xs text-mute" aria-live="polite">{{ cepEd.info.value }}</div>
      </div>
      <p class="mt-2 text-xs text-mute">A alteração vale para todas as vendas deste cliente.</p>
      <div class="mt-4 flex justify-end gap-2"><button class="btn" @click="ed.open = false">Cancelar</button><button class="btn btn-primary" @click="saveClient">Salvar</button></div>
    </ModalBox>
  </div>
  <p v-else class="text-mute">Venda não encontrada.</p>

  <ModalBox :open="pdf.open" title="Proposta do cliente" wide @close="pdf.open = false">
    <iframe :src="pdf.url" class="h-[70vh] w-full rounded-xl border border-line" title="Proposta em PDF" />
    <div class="mt-3 flex justify-end gap-2"><a :href="pdf.url" target="_blank" rel="noopener" class="btn">Abrir em nova aba</a></div>
  </ModalBox>
</template>
