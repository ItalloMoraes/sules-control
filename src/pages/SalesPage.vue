<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCepField } from '@/composables/useCepField'
import { supabase, fail } from '@/services/supabase'
import { useData } from '@/stores/data'
import { sendSaleEmail } from '@/services/mail'
import { run } from '@/composables/useToast'
import { brl, dateBR, todayISO, formatCpf, maskCpf, onlyDigits } from '@/utils/format'
import { calcSale } from '@/utils/finance'
import PageHeader from '@/components/PageHeader.vue'
import ModalBox from '@/components/ModalBox.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import CopyBtn from '@/components/CopyBtn.vue'
import { uploadProposal } from '@/services/proposals'

const data = useData(), router = useRouter(), route = useRoute()
const filters = reactive({ q: '', status: '', origin: '', insurer: '', product: '', from: '', to: '' })
const modal = ref(false)
const blank = () => ({
  id: '', client_id: '', insurer_id: data.settings?.default_insurer_id ?? '', product_id: '', sale_date: todayISO(),
  policy_start_date: '', vehicle_description: '', plate: '', proposal_number: '', policy_number: '', endorsement_number: '', proposal_pdf_path: '',
  premium: 0, insurer_percent: data.settings?.suggested_insurer_percent ?? 20, broker_percent: data.settings?.broker_percent ?? 70,
  origin: 'digital_suhai', status: 'pendente', notes: '', change_reason: '',
})
const f = reactive(blank())
// Cliente digitado na própria venda: se já existe, reaproveita; se não, cadastra junto.
const cl = reactive({ name: '', cpf: '', phone: '', email: '', cep: '', street: '', neighborhood: '', city: '', state: '' })
const cepField = useCepField(cl)
// o botão "Nova venda" do dashboard abre o formulário direto
onMounted(() => { if (route.query.novo) { open(); router.replace({ query: {} }) } })
const norm = (t: string) => t.trim().toLowerCase()
const existing = computed(() => data.clients.find(c => !c.archived_at && norm(c.full_name) === norm(cl.name)))
const matches = computed(() => norm(cl.name).length < 2 ? [] : data.clients.filter(c => !c.archived_at && norm(c.full_name).includes(norm(cl.name)) && norm(c.full_name) !== norm(cl.name)).slice(0, 5))
const pdfFile = ref<File | null>(null)
function onPdf(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (file.type !== 'application/pdf' || file.size > 20 * 1024 * 1024) return alert('Envie um PDF de até 20 MB.')
  pdfFile.value = file
}
const issue = reactive({ open: false, id: '', name: '', policy: '' })

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
    proposal_number: s.proposal_number ?? '', policy_number: s.policy_number ?? '', endorsement_number: s.endorsement_number ?? '', proposal_pdf_path: s.proposal_pdf_path ?? '',
    premium: s.premium, insurer_percent: s.insurer_percent, broker_percent: s.broker_percent,
    origin: s.origin, status: s.status, notes: s.notes ?? '', change_reason: '',
  } : blank())
  const c = data.clients.find(x => x.id === f.client_id)
  Object.assign(cl, { name: c?.full_name ?? '', cpf: '', phone: '', email: '', cep: '', street: '', neighborhood: '', city: '', state: '' })
  cepField.info.value = ''
  pdfFile.value = null
  modal.value = true
}
function openIssue(id: string, name: string) { Object.assign(issue, { open: true, id, name, policy: '' }) }
async function doIssue() {
  if (!issue.policy.trim()) return
  // O banco exige justificativa quando o status muda; fica registrada automaticamente.
  if (await run(async () => {
    fail((await supabase.from('sales').update({ policy_number: issue.policy.trim(), status: 'emitida', change_reason: 'Apólice emitida' }).eq('id', issue.id)).error)
    await data.refresh()
  }, 'Apólice emitida')) issue.open = false
}
async function save() {
  if (!isEdit.value && !cl.name.trim()) return alert('Informe o nome do cliente.')
  if (!f.product_id || !f.insurer_id) return alert('Escolha seguradora e produto.')
  if (isEdit.value && financialEdit.value && !f.change_reason.trim()) return alert('Informe a justificativa da alteração de valores ou data.')
  const row: Record<string, unknown> = {
    insurer_id: f.insurer_id, product_id: f.product_id, sale_date: f.sale_date, plate: f.plate.trim().toUpperCase() || null,
    proposal_number: f.proposal_number.trim() || null, premium: f.premium, insurer_percent: f.insurer_percent, origin: f.origin, notes: f.notes || null,
  }
  if (isEdit.value) { row.policy_number = f.policy_number.trim() || null; if (financialEdit.value) row.change_reason = f.change_reason }
  else { row.broker_percent = f.broker_percent; row.status = 'pendente' } // snapshot do percentual vigente; a apólice vem depois
  let newId = ''
  if (await run(async () => {
    if (isEdit.value) fail((await supabase.from('sales').update(row).eq('id', f.id)).error)
    else {
      let cid = existing.value?.id
      if (!cid) {
        const c = await supabase.from('clients').insert({ full_name: cl.name.trim(), cpf: onlyDigits(cl.cpf) || null, phone: cl.phone.trim() || null, email: cl.email.trim() || null, cep: cl.cep.replace(/\D/g, '') || null, street: cl.street || null, neighborhood: cl.neighborhood || null, city: cl.city || null, state: cl.state || null }).select('id').single()
        fail(c.error); cid = c.data!.id
      }
      const r = await supabase.from('sales').insert({ ...row, client_id: cid }).select('id').single()
      fail(r.error); newId = r.data!.id
    }
    if (pdfFile.value) await uploadProposal(isEdit.value ? f.id : newId, pdfFile.value)
    await data.refresh()
  }, 'Venda salva')) { modal.value = false; if (newId) void sendSaleEmail(newId) }
}
</script>
<template>
  <PageHeader title="Vendas" sub="Cadastre a venda e, quando a apólice sair, clique em Emitir apólice.">
    <button class="btn btn-primary" @click="open()">Nova venda</button>
  </PageHeader>
  <div class="card mb-3 filters">
    <input v-model="filters.q" class="input sm:col-span-2" placeholder="Cliente, placa, proposta, apólice" aria-label="Pesquisar vendas" />
    <USelect v-model="filters.status" class="input" aria-label="Status"><option value="">Todos os status</option><option value="pendente">Pendente</option><option value="emitida">Emitida</option><option value="cancelada">Cancelada</option></USelect>
    <USelect v-model="filters.origin" class="input" aria-label="Origem"><option value="">Todas as origens</option><option value="digital_suhai">Digital Suhai</option><option value="venda_propria">Venda própria</option></USelect>
    <USelect v-model="filters.insurer" class="input" aria-label="Seguradora"><option value="">Seguradoras</option><option v-for="i in data.insurers" :key="i.id" :value="i.id">{{ i.name }}</option></USelect>
    <USelect v-model="filters.product" class="input" aria-label="Produto"><option value="">Produtos</option><option v-for="p in data.products" :key="p.id" :value="p.id">{{ p.name }}</option></USelect>
    <UDateRange v-model:from="filters.from" v-model:to="filters.to" class="input" aria-label="Período" />
  </div>
  <div class="card overflow-x-auto p-0">
    <div class="tbl-scroll"><table class="tbl">
      <thead><tr><th>Data</th><th>Cliente</th><th>Produto</th><th>Origem</th><th class="text-right">Prêmio</th><th class="text-right">Bruta</th><th class="text-right">Líquida</th><th>Status</th><th></th></tr></thead>
      <tbody>
        <tr v-for="s in list" :key="s.id">
          <td>{{ dateBR(s.sale_date) }}</td>
          <td><button class="text-left font-medium hover:text-gold" @click="router.push('/vendas/' + s.id)">{{ s.clients?.full_name }}</button>
            <div class="space-y-0.5 text-xs text-mute">
              <div v-if="s.plate">{{ s.plate }}</div>
              <div v-if="s.clients?.cpf" class="flex items-center gap-0.5">CPF {{ formatCpf(s.clients.cpf) }}<CopyBtn :text="formatCpf(s.clients.cpf)" label="Copiar CPF" /></div>
              <div v-if="s.policy_number" class="flex items-center gap-0.5">apólice {{ s.policy_number }}<CopyBtn :text="s.policy_number" label="Copiar apólice" /></div></div></td>
          <td>{{ s.products?.name }}</td><td><StatusBadge :value="s.origin" /></td>
          <td class="num text-right">{{ brl(s.premium) }}</td><td class="num text-right">{{ brl(s.gross_commission) }}</td>
          <td class="num text-right">{{ brl(s.net_commission) }}</td><td><StatusBadge :value="s.status" /></td>
          <td class="whitespace-nowrap"><button v-if="s.status === 'pendente'" class="btn btn-primary mr-1" @click="openIssue(s.id, s.clients?.full_name ?? '')">Emitir apólice</button><button class="btn" @click="open(s.id)">Editar</button></td>
        </tr>
        <tr v-if="!list.length"><td colspan="9" class="py-6 text-center text-mute">Nenhuma venda com esses filtros.</td></tr>
      </tbody>
    </table></div>
  </div>

  <ModalBox :open="modal" :title="isEdit ? 'Editar venda' : 'Nova venda'" @close="modal = false">
    <div class="grid gap-3 sm:grid-cols-2">
      <div class="relative sm:col-span-2"><label class="label" for="cn">Cliente</label>
        <input id="cn" v-model="cl.name" class="input" autocomplete="off" :disabled="isEdit" placeholder="Digite o nome do cliente" />
        <ul v-if="!isEdit && matches.length" class="card absolute z-10 mt-1 w-full !p-1">
          <li v-for="c in matches" :key="c.id"><button type="button" class="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-raise" @click="cl.name = c.full_name">{{ c.full_name }}</button></li>
        </ul>
        <p v-if="!isEdit && cl.name.trim()" class="mt-1 text-xs" :class="existing ? 'text-pos' : 'text-mute'">{{ existing ? 'Cliente já cadastrado.' : 'Cliente novo: será cadastrado junto com a venda.' }}</p></div>
      <template v-if="!isEdit && cl.name.trim() && !existing">
        <div><label class="label" for="cc">CPF</label><input id="cc" v-model="cl.cpf" class="input" inputmode="numeric" maxlength="14" placeholder="000.000.000-00" @input="cl.cpf = maskCpf(cl.cpf)" /></div>
        <div><label class="label" for="ct">Telefone</label><input id="ct" v-model="cl.phone" class="input" inputmode="tel" /></div>
        <div class="sm:col-span-2"><label class="label" for="ce">E-mail</label><input id="ce" v-model="cl.email" type="email" class="input" /></div>
        <div><label class="label" for="cp">CEP</label><input id="cp" v-model="cl.cep" class="input" inputmode="numeric" maxlength="9" placeholder="00000-000" @input="cepField.onInput" /></div>
        <div class="flex items-end pb-2 text-xs text-mute" aria-live="polite">{{ cepField.info.value }}</div>
      </template>
      <div><label class="label">Data da venda</label><UDate v-model="f.sale_date" class="input" /></div>
      <div><label class="label" for="pl">Placa</label><input id="pl" v-model="f.plate" class="input uppercase" /></div>
      <div><label class="label" for="pr">Nº da proposta</label><input id="pr" v-model="f.proposal_number" class="input" /></div>
      <div class="sm:col-span-2"><label class="label">Proposta em PDF</label>
        <label class="btn cursor-pointer"><input type="file" accept="application/pdf" class="sr-only" @change="onPdf" />{{ pdfFile ? pdfFile.name : f.proposal_pdf_path ? 'Trocar o PDF anexado' : 'Anexar PDF da proposta' }}</label>
        <span v-if="f.proposal_pdf_path && !pdfFile" class="ml-2 text-xs text-pos">PDF já anexado</span></div>
      <div v-if="isEdit && f.status === 'emitida'"><label class="label" for="ap">Nº da apólice</label><input id="ap" v-model="f.policy_number" class="input" /></div>
      <div><label class="label">Produto</label><USelect v-model="f.product_id" class="input"><option value="">Selecione</option><option v-for="p in data.products" :key="p.id" :value="p.id">{{ p.name }}</option></USelect></div>
      <div><label class="label">Seguradora</label><USelect v-model="f.insurer_id" class="input"><option v-for="i in data.insurers" :key="i.id" :value="i.id">{{ i.name }}</option></USelect></div>
      <div><label class="label" for="pm">Prêmio (R$)</label><MoneyInput id="pm" v-model="f.premium" class="input" /></div>
      <div><label class="label" for="ip2">Comissão da seguradora (%)</label><MoneyInput id="ip2" v-model="f.insurer_percent" class="input" /></div>
      <div><label class="label" for="bp">Percentual do corretor (%)</label><MoneyInput id="bp" v-model="f.broker_percent" class="input" :disabled="isEdit" />
        <p v-if="isEdit" class="mt-1 text-xs text-mute">Fixo desde o cadastro da venda.</p></div>
      <div><label class="label">Origem</label><USelect v-model="f.origin" class="input"><option value="digital_suhai">Digital Suhai</option><option value="venda_propria">Venda própria</option></USelect></div>
      <div class="sm:col-span-2"><label class="label" for="ob">Observações</label><textarea id="ob" v-model="f.notes" class="input" rows="2" /></div>
      <div v-if="isEdit && financialEdit" class="sm:col-span-2">
        <label class="label" for="jr">Justificativa da alteração (obrigatória)</label><input id="jr" v-model="f.change_reason" class="input" /></div>
    </div>
    <div class="card mt-3 flex flex-wrap gap-6 text-sm">
      <div>Comissão bruta <b class="num block text-base">{{ brl(preview.gross) }}</b></div>
      <div>Comissão líquida <b class="num block text-base text-gold">{{ brl(preview.net) }}</b></div>
    </div>
    <div class="mt-4 flex justify-end gap-2"><button class="btn" @click="modal = false">Cancelar</button><button class="btn btn-primary" @click="save">Salvar venda</button></div>
  </ModalBox>

  <ModalBox :open="issue.open" title="Emitir apólice" @close="issue.open = false">
    <p class="mb-3 text-sm text-mute">{{ issue.name }}: informe o número da apólice. A venda passa para <b>Emitida</b>.</p>
    <label class="label" for="ipn">Nº da apólice</label>
    <input id="ipn" v-model="issue.policy" class="input mb-4" @keydown.enter="doIssue" />
    <div class="flex justify-end gap-2"><button class="btn" @click="issue.open = false">Cancelar</button><button class="btn btn-primary" :disabled="!issue.policy.trim()" @click="doIssue">Emitir apólice</button></div>
  </ModalBox>
</template>
