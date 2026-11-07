<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/services/supabase'
import { extractLines, sha256 } from '@/services/pdfExtract'
import { findExistingByHash, importReport } from '@/services/reconciliation'
import { parseReportText, sortItems } from '@/utils/reportParser'
import { useData } from '@/stores/data'
import { notify, run } from '@/composables/useToast'
import { brl, dateBR } from '@/utils/format'
import type { ParsedItem, ParsedReport } from '@/types'
import PageHeader from '@/components/PageHeader.vue'

const data = useData(), router = useRouter()
const reports = ref<{ id: string; file_name: string; reference_month: string; imported_at: string; reconciliation_status: string; production_reconciliations: { summary: Record<string, number> }[] }[]>([])
const totalsDiff = computed(() => {
  const t = parsed.value?.totals; if (!t) return ''
  const prem = Math.round(items.value.reduce((a, i) => a + i.premium, 0) * 100) / 100
  const com = Math.round(items.value.reduce((a, i) => a + i.commission, 0) * 100) / 100
  const out: string[] = []
  if (items.value.length !== t.documents) out.push(`documentos ${items.value.length} lidos × ${t.documents} no relatório`)
  if (prem !== t.premium) out.push(`prêmio ${brl(prem)} × ${brl(t.premium)}`)
  if (com !== t.commission) out.push(`comissão ${brl(com)} × ${brl(t.commission)}`)
  return out.join('; ')
})
const file = ref<File | null>(null), hash = ref(''), parsed = ref<ParsedReport | null>(null), items = ref<ParsedItem[]>([])
const busy = ref(''), usedOcr = ref(false), dir = ref<'asc' | 'desc'>('asc')

async function load() {
  const { data: r } = await supabase.from('production_reports').select('id,file_name,reference_month,imported_at,reconciliation_status,production_reconciliations(summary)').order('reference_month', { ascending: false })
  reports.value = (r ?? []) as typeof reports.value
}
onMounted(load)

async function pick(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]; if (!f) return
  parsed.value = null; items.value = []; file.value = f
  try {
    hash.value = await sha256(f)
    const dup = await findExistingByHash(hash.value)
    if (dup) { notify(`Este PDF já foi importado (${dup.file_name}). Abrindo a conferência existente.`, 'err'); router.push('/conferencia/' + dup.id); return }
    const res = await extractLines(f, m => (busy.value = m))
    usedOcr.value = res.usedOcr
    parsed.value = parseReportText(res.lines)
    items.value = sortItems(parsed.value.items, dir.value)
  } catch (err) { notify('Não foi possível ler o PDF: ' + (err as Error).message, 'err') } finally { busy.value = '' }
}
const sorted = computed(() => sortItems(items.value, dir.value))
const review = computed(() => items.value.filter(i => i.needs_review).length)
function remove(i: ParsedItem) { items.value = items.value.filter(x => x !== i) }

async function confirmImport() {
  if (!file.value || !parsed.value) return
  const insurer = data.insurers.find(i => i.is_default)?.id ?? null
  busy.value = 'Importando e conferindo…'
  let id = ''
  const ok = await run(async () => { id = await importReport({ file: file.value!, hash: hash.value, parsed: parsed.value!, items: items.value, insurerId: insurer, sales: data.sales }) }, 'Relatório importado e conferido. Nenhuma venda ou recebimento foi criado.')
  busy.value = ''
  if (ok) router.push('/conferencia/' + id)
}
</script>
<template>
  <PageHeader title="Conferência mensal de produção" sub="Importe o PDF da Digital Suhai, revise os dados extraídos e confira com suas vendas." />
  <div class="card mb-4">
    <label class="label" for="pdf">PDF do relatório mensal</label>
    <input id="pdf" type="file" accept="application/pdf" class="input" @change="pick" />
    <p v-if="busy" class="mt-2 text-sm text-gold">{{ busy }}</p>
  </div>

  <div v-if="parsed" class="card mb-6">
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div><h2 class="font-bold">Revisão antes de importar</h2>
        <p class="text-sm text-mute">{{ items.length }} registros · mês de referência {{ dateBR(parsed.reference_month) }} · período {{ dateBR(parsed.period_start) }} a {{ dateBR(parsed.period_end) }}
          <span v-if="usedOcr" class="text-warn"> · lido por OCR (revise com atenção)</span></p></div>
      <div class="flex gap-2"><button class="btn" @click="dir = dir === 'asc' ? 'desc' : 'asc'">Ordem {{ dir === 'asc' ? 'crescente' : 'decrescente' }}</button>
        <button class="btn btn-primary" :disabled="!items.length || !!busy" @click="confirmImport">Confirmar importação</button></div>
    </div>
    <p v-if="review" class="mb-2 text-sm text-warn">{{ review }} registro(s) com identificadores ambíguos: confira proposta, apólice e endosso.</p>
    <div v-if="totalsDiff" class="mb-3 rounded-md border border-warn/50 p-3 text-sm">
      <b class="text-warn">A leitura não bate com o "Total período" do relatório</b>: {{ totalsDiff }}. Confira as linhas antes de importar.</div>
    <p v-else-if="parsed.totals" class="mb-3 text-sm text-pos">Leitura conferida: {{ items.length }} documentos, prêmio e comissão batem com o total do relatório.</p>
    <div v-if="parsed.unparsed.length" class="mb-3 rounded-md border border-warn/50 p-3 text-sm">
      <b class="text-warn">{{ parsed.unparsed.length }} linha(s) não reconhecidas</b> (nada foi descartado em silêncio):
      <ul class="mt-1 max-h-28 overflow-y-auto text-xs text-mute"><li v-for="u in parsed.unparsed" :key="u.line_no">{{ u.text }}</li></ul></div>
    <div class="max-h-[28rem] overflow-auto"><table class="tbl">
      <thead><tr><th>Cliente</th><th>Dt. In. Vig.</th><th>Proposta</th><th>Apólice</th><th>Endosso</th><th>Produto</th><th>Neg</th><th class="text-right">Prêmio</th><th class="text-right">%</th><th class="text-right">Comissão</th><th></th></tr></thead>
      <tbody><tr v-for="i in sorted" :key="i.line_no" :class="{ 'bg-warn/5': i.needs_review }">
        <td><input v-model="i.client_name" class="input min-w-40" /></td><td>{{ dateBR(i.policy_start_date) }}</td>
        <td><input v-model="i.proposal_number" class="input w-28" /></td><td><input v-model="i.policy_number" class="input w-28" /></td><td><input v-model="i.endorsement_number" class="input w-28" /></td>
        <td>{{ i.product }}</td><td><b>{{ i.movement_code }}</b></td>
        <td class="num text-right" :class="{ 'text-neg': i.premium < 0 }">{{ brl(i.premium) }}</td><td class="num text-right">{{ i.commission_percent }}</td>
        <td class="num text-right" :class="{ 'text-neg': i.commission < 0 }">{{ brl(i.commission) }}</td>
        <td><button class="btn" @click="remove(i)" aria-label="Remover linha">✕</button></td></tr></tbody></table></div>
  </div>

  <div class="card overflow-x-auto p-0"><h2 class="p-4 pb-0 font-bold">Histórico mensal</h2><table class="tbl">
    <thead><tr><th>Mês</th><th>Arquivo</th><th>Registros</th><th>Conferidos</th><th>Divergências</th><th>Situação</th></tr></thead>
    <tbody><tr v-for="r in reports" :key="r.id" class="cursor-pointer" @click="router.push('/conferencia/' + r.id)">
      <td>{{ dateBR(r.reference_month).slice(3) }}</td><td>{{ r.file_name }}</td>
      <td class="num">{{ r.production_reconciliations[0]?.summary.total ?? '—' }}</td><td class="num">{{ r.production_reconciliations[0]?.summary.conferido ?? '—' }}</td>
      <td class="num">{{ r.production_reconciliations[0]?.summary.divergencia ?? '—' }}</td>
      <td>{{ r.reconciliation_status === 'confirmada' ? 'Confirmada' : 'Em andamento' }}</td></tr>
      <tr v-if="!reports.length"><td colspan="6" class="py-6 text-center text-mute">Nenhum relatório importado ainda.</td></tr></tbody></table></div>
</template>
