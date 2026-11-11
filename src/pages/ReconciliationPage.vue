<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase, fail } from '@/services/supabase'
import { compareItem, toSaleLite } from '@/services/reconciliation'
import { isCancellation, isEndorsement } from '@/utils/reconcile'
import { itemKey, sortItems } from '@/utils/reportParser'
import { useData } from '@/stores/data'
import { notify, run } from '@/composables/useToast'
import { brl, dateBR, todayISO } from '@/utils/format'
import type { Classification, Difference, ParsedItem } from '@/types'
import PageHeader from '@/components/PageHeader.vue'
import StatCard from '@/components/StatCard.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import ModalBox from '@/components/ModalBox.vue'

interface DbItem { id: string; line_no: number; client_name: string; policy_start_date: string | null; proposal_number: string | null; policy_number: string | null
  endorsement_number: string | null; product: string | null; movement_code: ParsedItem['movement_code']; vigencia_start: string | null; vigencia_end: string | null
  installments: number | null; premium: number; commission_percent: number; commission: number; raw: Record<string, unknown> }
interface Row { id: string; report_item_id: string | null; sale_id: string | null; classification: Classification; match_rule: string | null
  differences: Difference[]; justification: string | null; analyzed: boolean; linked_manually: boolean; production_report_items: DbItem | null }

const data = useData(), route = useRoute(), router = useRouter()
const reportId = route.params.id as string
const report = ref<{ file_name: string; reference_month: string; storage_path: string | null; reconciliation_status: string } | null>(null)
const reconId = ref('')
const rows = ref<Row[]>([])
const filters = reactive({ q: '', cls: '' as '' | Classification | 'atencao' | 'endosso' | 'cancelamento', from: '', to: '', dir: 'asc' as 'asc' | 'desc' })
const sel = ref<Row | null>(null)
const just = ref(''), linkTo = ref(''), edit = reactive({ open: false, client_name: '', proposal_number: '', policy_number: '', endorsement_number: '', premium: 0, commission: 0, commission_percent: 0 })
const create = reactive({ open: false, client_id: '', product_id: '', sale_date: todayISO(), status: 'emitida' })

async function load() {
  const { data: rp } = await supabase.from('production_reports').select('*').eq('id', reportId).single()
  report.value = rp
  const { data: rc } = await supabase.from('production_reconciliations').select('id').eq('report_id', reportId).single()
  reconId.value = rc!.id
  const { data: r, error } = await supabase.from('production_reconciliation_items').select('*, production_report_items(*)').eq('reconciliation_id', reconId.value)
  fail(error); rows.value = (r ?? []) as Row[]
}
onMounted(load)

const toParsed = (d: DbItem): ParsedItem => ({ ...d, needs_review: false, raw: '' } as ParsedItem)
const saleOf = (id: string | null) => data.sales.find(s => s.id === id)
const imported = computed(() => rows.value.filter(r => r.production_report_items))
const cnt = (c: Classification) => rows.value.filter(r => r.classification === c).length
const panel = computed(() => ({
  total: imported.value.length, ok: cnt('conferido'), div: cnt('divergencia'), nc: cnt('nao_cadastrado'), ab: cnt('nao_consta_no_relatorio'),
  end: imported.value.filter(r => isEndorsement(r.production_report_items!.movement_code)).length,
  can: imported.value.filter(r => isCancellation(r.production_report_items!.movement_code)).length, dup: cnt('duplicado'),
}))
const view = computed(() => {
  const t = filters.q.toLowerCase()
  const list = rows.value.filter(r => {
    const i = r.production_report_items
    const txt = i ? [i.client_name, i.proposal_number, i.policy_number, i.endorsement_number, i.product, i.movement_code].join(' ').toLowerCase() : (saleOf(r.sale_id)?.clients?.full_name ?? '').toLowerCase()
    const cls = !filters.cls || (filters.cls === 'atencao' ? !['conferido', 'duplicado'].includes(r.classification) || (!r.analyzed && r.classification === 'divergencia')
      : filters.cls === 'endosso' ? !!i && isEndorsement(i.movement_code) : filters.cls === 'cancelamento' ? !!i && isCancellation(i.movement_code) : r.classification === filters.cls)
    const d = i?.policy_start_date ?? ''
    return (!t || txt.includes(t)) && cls && (!filters.from || d >= filters.from) && (!filters.to || d <= filters.to)
  })
  const withItem = sortItems(list.filter(r => r.production_report_items).map(r => ({ r, ...toParsed(r.production_report_items!) })), filters.dir).map(x => x.r)
  return [...withItem, ...list.filter(r => !r.production_report_items)]
})

function open(r: Row) { sel.value = r; just.value = r.justification ?? ''; linkTo.value = r.sale_id ?? '' }

async function persist(r: Row, patch: Partial<Row>) {
  fail((await supabase.from('production_reconciliation_items').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', r.id)).error)
  Object.assign(r, patch)
}
function recompute(r: Row, saleId: string | null): Partial<Row> {
  const i = r.production_report_items!, s = saleOf(saleId)
  if (isEndorsement(i.movement_code) || isCancellation(i.movement_code)) return { classification: 'movimentacao_especial', sale_id: saleId, differences: s ? compareItem(toParsed(i), toSaleLite(s)).filter(d => d.severity === 'info') : [] }
  if (!s) return { classification: 'nao_cadastrado', sale_id: null, differences: [] }
  const diffs = compareItem(toParsed(i), toSaleLite(s))
  return { classification: diffs.some(d => d.severity === 'divergencia') ? 'divergencia' : 'conferido', sale_id: s.id, differences: diffs }
}

const saveAnalysis = () => run(async () => { await persist(sel.value!, { justification: just.value || null, analyzed: true }) }, 'Registro marcado como analisado')
const linkSale = () => run(async () => {
  if (!linkTo.value) throw new Error('Escolha a venda.')
  await persist(sel.value!, { ...recompute(sel.value!, linkTo.value), linked_manually: true, match_rule: 'manual' })
}, 'Vinculado manualmente à venda')

function openEdit() { const i = sel.value!.production_report_items!; Object.assign(edit, { open: true, client_name: i.client_name, proposal_number: i.proposal_number ?? '', policy_number: i.policy_number ?? '', endorsement_number: i.endorsement_number ?? '', premium: i.premium, commission: i.commission, commission_percent: i.commission_percent }) }
const saveEdit = () => run(async () => {
  const r = sel.value!, i = r.production_report_items!
  const before = { client_name: i.client_name, proposal_number: i.proposal_number, policy_number: i.policy_number, endorsement_number: i.endorsement_number, premium: i.premium, commission: i.commission, commission_percent: i.commission_percent }
  const next = { client_name: edit.client_name, proposal_number: edit.proposal_number || null, policy_number: edit.policy_number || null, endorsement_number: edit.endorsement_number || null, premium: edit.premium, commission: edit.commission, commission_percent: edit.commission_percent }
  const merged = { ...i, ...next }
  fail((await supabase.from('production_report_items').update({ ...next, item_key: itemKey(merged as unknown as ParsedItem), corrected: { before, at: new Date().toISOString(), why: just.value || 'correção manual' } }).eq('id', i.id)).error)
  Object.assign(i, next); edit.open = false
  await persist(r, recompute(r, r.sale_id))
}, 'Dado corrigido (valor original preservado)')

async function createSale() {
  const r = sel.value!, i = r.production_report_items!
  if (!create.client_id || !create.product_id || !create.sale_date) return notify('Escolha cliente, produto e data da venda.', 'err')
  await run(async () => {
    const ins = data.insurers.find(x => x.is_default) ?? data.insurers[0]
    const { data: s, error } = await supabase.from('sales').insert({
      client_id: create.client_id, insurer_id: ins.id, product_id: create.product_id, sale_date: create.sale_date,
      policy_start_date: i.policy_start_date, proposal_number: i.proposal_number, policy_number: i.policy_number, endorsement_number: i.endorsement_number,
      premium: i.premium, insurer_percent: i.commission_percent, broker_percent: data.settings?.broker_percent ?? 70,
      origin: 'digital_suhai', status: create.status, notes: 'Criada a partir da conferência mensal',
    }).select('id').single()
    fail(error); await data.refresh()
    await persist(r, { ...recompute(r, s!.id), linked_manually: true, match_rule: 'cadastro_pela_conferencia' })
    create.open = false
  }, 'Venda cadastrada e vinculada')
}
async function newClient() {
  const name = sel.value?.production_report_items?.client_name; if (!name) return
  const ex = data.clients.find(c => c.full_name.toLowerCase() === name.toLowerCase())
  if (ex) { create.client_id = ex.id; return }
  const { data: c, error } = await supabase.from('clients').insert({ full_name: name }).select('id').single()
  fail(error); await data.refresh(); create.client_id = c!.id
}
const confirmRecon = () => run(async () => {
  fail((await supabase.from('production_reconciliations').update({ confirmed_at: new Date().toISOString(), summary: { ...panel.value } }).eq('id', reconId.value)).error)
  fail((await supabase.from('production_reports').update({ reconciliation_status: 'confirmada' }).eq('id', reportId)).error)
  report.value!.reconciliation_status = 'confirmada'
}, 'Conferência confirmada. Nenhum registro ou valor financeiro foi alterado.')
async function openPdf() {
  const { data: u, error } = await supabase.storage.from('production-reports').createSignedUrl(report.value!.storage_path!, 120)
  fail(error); window.open(u!.signedUrl, '_blank')
}
const pendingAttention = computed(() => rows.value.filter(r => ['divergencia', 'nao_cadastrado', 'nao_consta_no_relatorio'].includes(r.classification) && !r.analyzed).length)
</script>
<template>
  <div v-if="report">
    <PageHeader :title="`Conferência de ${dateBR(report.reference_month).slice(3)}`" :sub="report.file_name">
      <button class="btn" @click="router.push('/conferencia')">Voltar</button>
      <button class="btn" @click="openPdf">Ver PDF original</button>
      <button class="btn btn-primary" :disabled="report.reconciliation_status === 'confirmada'" @click="confirmRecon">
        {{ report.reconciliation_status === 'confirmada' ? 'Conferência confirmada' : 'Confirmar conferência' }}</button>
    </PageHeader>
    <div class="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
      <StatCard label="Importados" :value="String(panel.total)" /><StatCard label="Conferidos" :value="String(panel.ok)" tone="pos" />
      <StatCard label="Divergências" :value="String(panel.div)" tone="neg" /><StatCard label="Não cadastrados" :value="String(panel.nc)" tone="warn" />
      <StatCard label="Ausentes no relatório" :value="String(panel.ab)" tone="warn" /><StatCard label="Endossos" :value="String(panel.end)" />
      <StatCard label="Cancelamentos" :value="String(panel.can)" /><StatCard label="Duplicados" :value="String(panel.dup)" />
    </div>
    <p v-if="pendingAttention" class="mb-3 text-sm text-warn">{{ pendingAttention }} registro(s) de atenção ainda não analisados.</p>
    <div class="card mb-3 grid gap-2 sm:grid-cols-5">
      <input v-model="filters.q" class="input sm:col-span-2" placeholder="Cliente, proposta, apólice, endosso, produto, tipo" aria-label="Filtrar" />
      <USelect v-model="filters.cls" class="input" aria-label="Filtro rápido"><option value="">Todos</option><option value="atencao">Precisam de atenção</option><option value="conferido">Conferidos</option>
        <option value="divergencia">Divergências</option><option value="nao_cadastrado">Não cadastrados</option><option value="nao_consta_no_relatorio">Não constam no relatório</option>
        <option value="movimentacao_especial">Movimentações especiais</option><option value="endosso">Endossos</option><option value="cancelamento">Cancelamentos</option><option value="duplicado">Duplicados</option></USelect>
      <UDateRange v-model:from="filters.from" v-model:to="filters.to" class="input" aria-label="Período" />
      <button class="btn" @click="filters.dir = filters.dir === 'asc' ? 'desc' : 'asc'">Vigência {{ filters.dir === 'asc' ? '↑' : '↓' }}</button>
    </div>
    <div class="card overflow-x-auto p-0"><div class="tbl-scroll"><table class="tbl">
      <thead><tr><th>Dt. In. Vig.</th><th>Cliente</th><th>Proposta</th><th>Apólice</th><th>Endosso</th><th>Neg</th><th class="text-right">Prêmio</th><th class="text-right">Comissão</th><th>Situação</th></tr></thead>
      <tbody><tr v-for="r in view" :key="r.id" class="cursor-pointer" @click="open(r)">
        <template v-if="r.production_report_items"><td>{{ dateBR(r.production_report_items.policy_start_date) }}</td><td>{{ r.production_report_items.client_name }}</td>
          <td>{{ r.production_report_items.proposal_number ?? '—' }}</td><td>{{ r.production_report_items.policy_number ?? '—' }}</td><td>{{ r.production_report_items.endorsement_number ?? '—' }}</td>
          <td><b>{{ r.production_report_items.movement_code }}</b></td>
          <td class="num text-right" :class="{ 'text-neg': r.production_report_items.premium < 0 }">{{ brl(r.production_report_items.premium) }}</td>
          <td class="num text-right" :class="{ 'text-neg': r.production_report_items.commission < 0 }">{{ brl(r.production_report_items.commission) }}</td></template>
        <template v-else><td>—</td><td>{{ saleOf(r.sale_id)?.clients?.full_name }}</td><td>{{ saleOf(r.sale_id)?.proposal_number ?? '—' }}</td><td colspan="5" class="text-mute">Venda cadastrada sem registro no relatório</td></template>
        <td><StatusBadge :value="r.classification" /><span v-if="r.analyzed" class="ml-1 text-xs text-pos">✓ analisado</span></td></tr></tbody></table></div></div>

    <ModalBox :open="!!sel" title="Registro lado a lado" @close="sel = null">
      <div v-if="sel" class="grid gap-3 md:grid-cols-2">
        <div class="card"><h3 class="mb-2 font-bold">Relatório</h3>
          <dl v-if="sel.production_report_items" class="num space-y-1 text-sm">
            <div>Cliente: {{ sel.production_report_items.client_name }}</div><div>Dt. In. Vig.: {{ dateBR(sel.production_report_items.policy_start_date) }}</div>
            <div>Proposta: {{ sel.production_report_items.proposal_number ?? '—' }}</div><div>Apólice: {{ sel.production_report_items.policy_number ?? '—' }}</div>
            <div>Endosso: {{ sel.production_report_items.endorsement_number ?? '—' }}</div><div>Produto: {{ sel.production_report_items.product }} · Neg/Itens: {{ sel.production_report_items.movement_code }}</div>
            <div>Vigência: {{ dateBR(sel.production_report_items.vigencia_start) }} a {{ dateBR(sel.production_report_items.vigencia_end) }} · Parc: {{ sel.production_report_items.installments ?? '—' }}</div>
            <div>Prêmio: {{ brl(sel.production_report_items.premium) }} · {{ sel.production_report_items.commission_percent }}% · Comissão: {{ brl(sel.production_report_items.commission) }}</div></dl>
          <p v-else class="text-sm text-mute">Sem registro no relatório.</p></div>
        <div class="card"><h3 class="mb-2 font-bold">Sistema</h3>
          <dl v-if="saleOf(sel.sale_id)" class="num space-y-1 text-sm">
            <div>Cliente: {{ saleOf(sel.sale_id)!.clients?.full_name }}</div><div>Data da venda: {{ dateBR(saleOf(sel.sale_id)!.sale_date) }}</div>
            <div>Proposta: {{ saleOf(sel.sale_id)!.proposal_number ?? '—' }}</div><div>Apólice: {{ saleOf(sel.sale_id)!.policy_number ?? '—' }}</div>
            <div>Prêmio: {{ brl(saleOf(sel.sale_id)!.premium) }} · {{ saleOf(sel.sale_id)!.insurer_percent }}% · Bruta: {{ brl(saleOf(sel.sale_id)!.gross_commission) }}</div>
            <div>Critério de correspondência: {{ sel.match_rule ?? '—' }}</div></dl>
          <p v-else class="text-sm text-mute">Nenhuma venda vinculada.</p></div>
      </div>
      <ul v-if="sel?.differences.length" class="mt-3 text-sm">
        <li v-for="d in sel.differences" :key="d.field" :class="d.severity === 'divergencia' ? 'text-neg' : 'text-mute'">{{ d.severity === 'divergencia' ? '⚠' : 'ℹ' }} {{ d.field }}: relatório {{ d.report }} × sistema {{ d.system }}</li></ul>
      <div v-if="sel" class="mt-3 space-y-3">
        <div><label class="label">Justificativa / observação da análise</label><input v-model="just" class="input" /></div>
        <div class="flex flex-wrap gap-2">
          <button class="btn btn-primary" @click="saveAnalysis">Marcar como analisado</button>
          <button v-if="sel.production_report_items" class="btn" @click="openEdit">Corrigir dado extraído</button>
          <button v-if="sel.production_report_items && !sel.sale_id" class="btn" @click="create.open = true; newClient()">Cadastrar venda a partir deste registro</button></div>
        <div v-if="sel.production_report_items" class="flex gap-2"><USelect v-model="linkTo" class="input" aria-label="Venda para vincular"><option value="">Vincular manualmente a uma venda…</option>
          <option v-for="s in data.sales" :key="s.id" :value="s.id">{{ dateBR(s.sale_date) }} · {{ s.clients?.full_name }} · {{ brl(s.premium) }} · {{ s.proposal_number ?? 's/ proposta' }}</option></USelect>
          <button class="btn" @click="linkSale">Vincular</button></div>
        <p class="text-xs text-mute">Nenhuma ação aqui altera vendas, recebimentos ou estornos existentes. Comissão negativa no PDF não vira estorno automático: registre o desconto em Cancelamentos.</p>
      </div>
    </ModalBox>

    <ModalBox :open="edit.open" title="Corrigir dado extraído" @close="edit.open = false">
      <div class="grid gap-3 sm:grid-cols-2">
        <div class="sm:col-span-2"><label class="label">Cliente</label><input v-model="edit.client_name" class="input" /></div>
        <div><label class="label">Proposta</label><input v-model="edit.proposal_number" class="input" /></div><div><label class="label">Apólice</label><input v-model="edit.policy_number" class="input" /></div>
        <div><label class="label">Endosso</label><input v-model="edit.endorsement_number" class="input" /></div><div><label class="label">Prêmio</label><MoneyInput v-model="edit.premium" class="input" /></div>
        <div><label class="label">% seguradora</label><MoneyInput v-model="edit.commission_percent" class="input" /></div><div><label class="label">Comissão</label><MoneyInput v-model="edit.commission" class="input" /></div></div>
      <p class="mt-2 text-xs text-mute">Os valores originais extraídos continuam guardados para auditoria.</p>
      <div class="mt-3 flex justify-end gap-2"><button class="btn" @click="edit.open = false">Cancelar</button><button class="btn btn-primary" @click="saveEdit">Salvar correção</button></div>
    </ModalBox>

    <ModalBox :open="create.open" title="Cadastrar venda faltante" @close="create.open = false">
      <div class="grid gap-3 sm:grid-cols-2">
        <div><label class="label">Cliente</label><USelect v-model="create.client_id" class="input"><option v-for="c in data.clients" :key="c.id" :value="c.id">{{ c.full_name }}</option></USelect></div>
        <div><label class="label">Produto</label><USelect v-model="create.product_id" class="input"><option value="">Selecione</option><option v-for="p in data.products" :key="p.id" :value="p.id">{{ p.name }}</option></USelect></div>
        <div><label class="label">Data da venda (confirme; não é a data de vigência)</label><UDate v-model="create.sale_date" class="input" /></div>
        <div><label class="label">Status</label><USelect v-model="create.status" class="input"><option value="emitida">Emitida</option><option value="pendente">Pendente</option></USelect></div></div>
      <p class="mt-2 text-xs text-mute">Prêmio, % da seguradora, proposta e apólice vêm do relatório. O % do corretor é o vigente nas configurações.</p>
      <div class="mt-3 flex justify-end gap-2"><button class="btn" @click="create.open = false">Cancelar</button><button class="btn btn-primary" @click="createSale">Cadastrar e vincular</button></div>
    </ModalBox>
  </div>
</template>
