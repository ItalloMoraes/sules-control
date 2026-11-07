<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useData } from '@/stores/data'
import { addMonths, brl, dateBR, todayISO } from '@/utils/format'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'

const data = useData(), router = useRouter()
const view = ref<'mes' | 'semana' | 'dia'>('mes')
const cursor = ref(todayISO())
const selected = ref(todayISO())
const f = reactive({ insurer: '', product: '', origin: '', status: '' })

const sales = computed(() => data.sales.filter(s => (!f.insurer || s.insurer_id === f.insurer) && (!f.product || s.product_id === f.product) &&
  (!f.origin || s.origin === f.origin) && (!f.status || s.status === f.status)))
const byDay = computed(() => {
  const m = new Map<string, typeof sales.value>()
  for (const s of sales.value) m.set(s.sale_date, [...(m.get(s.sale_date) ?? []), s])
  return m
})
const iso = (d: Date) => d.toISOString().slice(0, 10)
const parse = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)) }
const days = computed<string[]>(() => {
  const c = parse(cursor.value)
  if (view.value === 'dia') return [cursor.value]
  if (view.value === 'semana') { const s = new Date(c); s.setUTCDate(c.getUTCDate() - c.getUTCDay()); return Array.from({ length: 7 }, (_, i) => iso(new Date(s.getTime() + i * 864e5))) }
  const first = new Date(Date.UTC(c.getUTCFullYear(), c.getUTCMonth(), 1)); first.setUTCDate(1 - first.getUTCDay())
  return Array.from({ length: 42 }, (_, i) => iso(new Date(first.getTime() + i * 864e5)))
})
const stats = (d: string) => {
  const l = byDay.value.get(d) ?? []
  return { n: l.length, prem: l.reduce((a, s) => a + s.premium, 0), com: l.reduce((a, s) => a + s.net_commission, 0),
    pend: l.filter(s => s.status === 'pendente').length, em: l.filter(s => s.status === 'emitida').length, can: l.filter(s => s.status === 'cancelada').length }
}
function move(n: number) {
  const c = parse(cursor.value)
  cursor.value = view.value === 'mes' ? addMonths(cursor.value, n).slice(0, 8) + '01' : iso(new Date(c.getTime() + n * (view.value === 'semana' ? 7 : 1) * 864e5))
}
const title = computed(() => parse(cursor.value).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }))
const daySales = computed(() => byDay.value.get(selected.value) ?? [])
</script>
<template>
  <PageHeader title="Calendário de vendas" sub="Referência: data da venda.">
    <div class="flex gap-1"><button v-for="v in (['mes','semana','dia'] as const)" :key="v" class="btn" :class="{ 'btn-primary': view === v }" @click="view = v">{{ v === 'mes' ? 'Mensal' : v === 'semana' ? 'Semanal' : 'Diária' }}</button></div>
  </PageHeader>
  <div class="card mb-3 grid gap-2 sm:grid-cols-4">
    <USelect v-model="f.insurer" class="input" aria-label="Seguradora"><option value="">Seguradoras</option><option v-for="i in data.insurers" :key="i.id" :value="i.id">{{ i.name }}</option></USelect>
    <USelect v-model="f.product" class="input" aria-label="Produto"><option value="">Produtos</option><option v-for="p in data.products" :key="p.id" :value="p.id">{{ p.name }}</option></USelect>
    <USelect v-model="f.origin" class="input" aria-label="Origem"><option value="">Origens</option><option value="digital_suhai">Digital Suhai</option><option value="venda_propria">Venda própria</option></USelect>
    <USelect v-model="f.status" class="input" aria-label="Status"><option value="">Status</option><option value="pendente">Pendente</option><option value="emitida">Emitida</option><option value="cancelada">Cancelada</option></USelect>
  </div>
  <div class="mb-2 flex items-center gap-2"><button class="btn" @click="move(-1)" aria-label="Anterior">‹</button><span class="min-w-40 text-center font-display font-bold capitalize">{{ title }}</span><button class="btn" @click="move(1)" aria-label="Próximo">›</button><button class="btn" @click="cursor = todayISO(); selected = todayISO()">Hoje</button></div>
  <div class="grid gap-px overflow-hidden rounded-lg border border-line bg-line" :class="view === 'dia' ? 'grid-cols-1' : 'grid-cols-7'">
    <div v-if="view !== 'dia'" v-for="d in ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']" :key="d" class="bg-raise p-1 text-center text-xs text-mute">{{ d }}</div>
    <button v-for="d in days" :key="d" class="min-h-20 bg-panel p-1.5 text-left hover:bg-raise" :class="{ 'ring-2 ring-gold ring-inset': d === selected, 'opacity-40': view === 'mes' && d.slice(0,7) !== cursor.slice(0,7) }" @click="selected = d">
      <div class="text-xs" :class="d === todayISO() ? 'font-bold text-gold' : 'text-mute'">{{ d.slice(8) }}</div>
      <template v-if="stats(d).n"><div class="num text-sm font-bold">{{ stats(d).n }} <span class="text-xs font-normal text-mute">vendas</span></div>
        <div class="num hidden text-xs text-mute sm:block">{{ brl(stats(d).prem) }}</div><div class="num hidden text-xs text-gold sm:block">{{ brl(stats(d).com) }}</div>
        <div class="mt-0.5 flex gap-1 text-[10px]"><span v-if="stats(d).em" class="text-pos">{{ stats(d).em }}E</span><span v-if="stats(d).pend" class="text-warn">{{ stats(d).pend }}P</span><span v-if="stats(d).can" class="text-neg">{{ stats(d).can }}C</span></div></template>
    </button>
  </div>
  <div class="card mt-4 overflow-x-auto"><h2 class="mb-2 font-bold">{{ dateBR(selected) }}</h2>
    <table class="tbl"><thead><tr><th>Cliente</th><th>Produto</th><th class="text-right">Prêmio</th><th class="text-right">Comissão</th><th>Status</th></tr></thead>
      <tbody><tr v-for="s in daySales" :key="s.id" class="cursor-pointer" @click="router.push('/vendas/' + s.id)"><td>{{ s.clients?.full_name }}</td><td>{{ s.products?.name }}</td>
        <td class="num text-right">{{ brl(s.premium) }}</td><td class="num text-right">{{ brl(s.net_commission) }}</td><td><StatusBadge :value="s.status" /></td></tr>
        <tr v-if="!daySales.length"><td colspan="5" class="py-4 text-center text-mute">Sem vendas neste dia.</td></tr></tbody></table></div>
</template>
