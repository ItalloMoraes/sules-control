<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { supabase } from '@/services/supabase'
import { useData } from '@/stores/data'
import { brl, dateBR, monthEnd, monthStart, todayISO } from '@/utils/format'
import { pendingBalance, round2 } from '@/utils/finance'
import { toCSV, toPDF, toXLSX, type Table } from '@/utils/exporters'
import PageHeader from '@/components/PageHeader.vue'

const data = useData()
const f = reactive({ type: 'comercial', from: monthStart(todayISO()), to: monthEnd(todayISO()), insurer: '', product: '', origin: '', status: '', groupBy: 'status' })
const recon = ref<{ file_name: string; reference_month: string; production_reconciliations: { summary: Record<string, number> }[] }[]>([])
onMounted(async () => {
  const { data: r } = await supabase.from('production_reports').select('file_name,reference_month,production_reconciliations(summary)').order('reference_month', { ascending: false })
  recon.value = (r ?? []) as typeof recon.value
})
const sales = computed(() => data.sales.filter(s => s.sale_date >= f.from && s.sale_date <= f.to && (!f.insurer || s.insurer_id === f.insurer) &&
  (!f.product || s.product_id === f.product) && (!f.origin || s.origin === f.origin) && (!f.status || s.status === f.status)))
const ids = computed(() => new Set(sales.value.map(s => s.id)))

const table = computed<Table>(() => {
  const m = (n: number) => brl(n)
  if (f.type === 'comercial') {
    const key = (s: typeof sales.value[number]) => f.groupBy === 'seguradora' ? s.insurers?.name : f.groupBy === 'produto' ? s.products?.name : f.groupBy === 'origem' ? (s.origin === 'digital_suhai' ? 'Digital Suhai' : 'Venda própria') : s.status
    const g = new Map<string, { n: number; p: number; b: number; l: number }>()
    for (const s of sales.value) { const k = key(s) ?? '—'; const x = g.get(k) ?? { n: 0, p: 0, b: 0, l: 0 }; x.n++; x.p += s.premium; x.b += s.gross_commission; x.l += s.net_commission; g.set(k, x) }
    return { title: 'Relatório comercial', headers: [`Por ${f.groupBy}`, 'Vendas', 'Prêmios', 'Comissão bruta', 'Comissão líquida'], rows: [...g].map(([k, x]) => [k, x.n, m(x.p), m(x.b), m(x.l)]) }
  }
  if (f.type === 'financeiro') {
    return { title: 'Relatório financeiro', headers: ['Data venda', 'Cliente', 'Comissão gerada', 'Recebida', 'Pendente', 'Estornos efetivados'],
      rows: sales.value.map(s => [dateBR(s.sale_date), s.clients?.full_name ?? '', m(s.status === 'cancelada' ? 0 : s.net_commission), m(data.receivedBySale.get(s.id) ?? 0),
        m(pendingBalance(s, data.receivedBySale.get(s.id) ?? 0)), m(round2(data.reversals.filter(r => r.sale_id === s.id && r.status === 'efetivado').reduce((a, r) => a + r.amount, 0)))]) }
  }
  if (f.type === 'cancelamentos') {
    return { title: 'Relatório de cancelamentos', headers: ['Data', 'Cliente', 'Motivo', 'Comissão perdida', 'Estornos pendentes', 'Estornos efetivados'],
      rows: data.cancellations.filter(c => ids.value.has(c.sale_id)).map(c => [dateBR(c.cancelled_at), data.sales.find(s => s.id === c.sale_id)?.clients?.full_name ?? '', c.reason ?? '', m(c.lost_commission),
        m(data.reversals.filter(r => r.sale_id === c.sale_id && r.status === 'pendente').reduce((a, r) => a + r.amount, 0)),
        m(data.reversals.filter(r => r.sale_id === c.sale_id && r.status === 'efetivado').reduce((a, r) => a + r.amount, 0))]) }
  }
  return { title: 'Relatório de conferência mensal', headers: ['Mês', 'Arquivo', 'Importados', 'Conferidos', 'Divergências', 'Não cadastrados', 'Ausentes no relatório', 'Endossos', 'Cancelamentos'],
    rows: recon.value.map(r => { const s = r.production_reconciliations[0]?.summary ?? {}; return [dateBR(r.reference_month).slice(3), r.file_name, s.total ?? 0, s.conferido ?? 0, s.divergencia ?? 0, s.nao_cadastrado ?? 0, s.nao_consta_no_relatorio ?? 0, s.endossos ?? 0, s.cancelamentos ?? 0] }) }
})
const name = computed(() => `${f.type}-${f.from}_a_${f.to}`)
const sub = computed(() => `Período ${dateBR(f.from)} a ${dateBR(f.to)}`)
</script>
<template>
  <PageHeader title="Relatórios e exportações" sub="Exportações respeitam os filtros selecionados.">
    <button class="btn" @click="toPDF(table, name, sub)">PDF</button><button class="btn" @click="toXLSX(table, name)">XLSX</button><button class="btn" @click="toCSV(table, name)">CSV</button>
  </PageHeader>
  <div class="card mb-4 grid gap-2 sm:grid-cols-4 lg:grid-cols-8">
    <select v-model="f.type" class="input sm:col-span-2" aria-label="Relatório"><option value="comercial">Comercial</option><option value="financeiro">Financeiro</option><option value="cancelamentos">Cancelamentos</option><option value="conferencia">Conferência mensal</option></select>
    <input v-model="f.from" type="date" class="input" aria-label="De" /><input v-model="f.to" type="date" class="input" aria-label="Até" />
    <select v-model="f.insurer" class="input" aria-label="Seguradora"><option value="">Seguradoras</option><option v-for="i in data.insurers" :key="i.id" :value="i.id">{{ i.name }}</option></select>
    <select v-model="f.product" class="input" aria-label="Produto"><option value="">Produtos</option><option v-for="p in data.products" :key="p.id" :value="p.id">{{ p.name }}</option></select>
    <select v-model="f.origin" class="input" aria-label="Origem"><option value="">Origens</option><option value="digital_suhai">Digital Suhai</option><option value="venda_propria">Venda própria</option></select>
    <select v-if="f.type === 'comercial'" v-model="f.groupBy" class="input" aria-label="Agrupar"><option value="status">Por status</option><option value="seguradora">Por seguradora</option><option value="produto">Por produto</option><option value="origem">Por origem</option></select>
  </div>
  <div class="card overflow-x-auto p-0"><table class="tbl"><thead><tr><th v-for="h in table.headers" :key="h">{{ h }}</th></tr></thead>
    <tbody><tr v-for="(r, i) in table.rows" :key="i"><td v-for="(c, j) in r" :key="j" class="num">{{ c }}</td></tr>
      <tr v-if="!table.rows.length"><td :colspan="table.headers.length" class="py-6 text-center text-mute">Sem dados para o filtro.</td></tr></tbody></table></div>
</template>
