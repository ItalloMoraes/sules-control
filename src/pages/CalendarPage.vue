<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase, fail } from '@/services/supabase'
import { run } from '@/composables/useToast'
import { useData } from '@/stores/data'
import { addMonths, brl, dateBR, todayISO } from '@/utils/format'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import ModalBox from '@/components/ModalBox.vue'

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
const monthHolidays = computed(() => Object.entries(data.holidayNames).filter(([d]) => d.startsWith(cursor.value.slice(0, 7))).sort((a, b) => a[0].localeCompare(b[0])))
const daySales = computed(() => byDay.value.get(selected.value) ?? [])

// ---- agenda: atendimentos e recontatos ----
type Appt = { id: string; client_id: string | null; kind: 'atendimento' | 'recontato' | 'outro'; title: string; starts_at: string; notes: string | null; done: boolean }
const KINDS: Record<string, string> = { atendimento: 'Atendimento', recontato: 'Recontato', outro: 'Outro' }
const TZ = 'America/Recife'
const dayKey = (v: string) => new Date(v).toLocaleDateString('sv-SE', { timeZone: TZ })
const timeOf = (v: string) => new Date(v).toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
const appts = ref<Appt[]>([])
async function loadAppts() {
  const { data: rows, error } = await supabase.from('appointments').select('*').order('starts_at')
  fail(error); appts.value = (rows ?? []) as Appt[]
}
const apptsByDay = computed(() => {
  const m = new Map<string, Appt[]>()
  for (const a of appts.value) { const k = dayKey(a.starts_at); m.set(k, [...(m.get(k) ?? []), a]) }
  return m
})
const dayAppts = computed(() => apptsByDay.value.get(selected.value) ?? [])
const apptOpen = (d: string) => (apptsByDay.value.get(d) ?? []).filter(a => !a.done).length
const clientName = (id: string | null) => data.clients.find(c => c.id === id)?.full_name ?? ''
const TIMES = Array.from({ length: 27 }, (_, i) => { const m = 7 * 60 + i * 30; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` })
const ap = reactive({ open: false, id: '', kind: 'recontato', client: '', title: '', date: todayISO(), time: '09:00', notes: '' })
const apMatches = computed(() => { const t = ap.client.trim().toLowerCase(); return t.length < 2 ? [] : data.clients.filter(c => !c.archived_at && c.full_name.toLowerCase().includes(t) && c.full_name.toLowerCase() !== t).slice(0, 5) })
const apClient = computed(() => data.clients.find(c => !c.archived_at && c.full_name.trim().toLowerCase() === ap.client.trim().toLowerCase()))
function newAppt(day = selected.value) { Object.assign(ap, { open: true, id: '', kind: 'recontato', client: '', title: '', date: day, time: '09:00', notes: '' }) }
function editAppt(a: Appt) { Object.assign(ap, { open: true, id: a.id, kind: a.kind, client: clientName(a.client_id), title: a.title, date: dayKey(a.starts_at), time: timeOf(a.starts_at), notes: a.notes ?? '' }) }
async function saveAppt() {
  if (!ap.date || !ap.time) return alert('Escolha a data e a hora.')
  const label = KINDS[ap.kind]
  const row = { kind: ap.kind, client_id: apClient.value?.id ?? null, title: ap.title.trim() || (ap.client.trim() ? `${label} com ${ap.client.trim()}` : label),
    starts_at: new Date(`${ap.date}T${ap.time}:00-03:00`).toISOString(), notes: ap.notes.trim() || null, notified_at: null }
  if (await run(async () => { fail((ap.id ? await supabase.from('appointments').update(row).eq('id', ap.id) : await supabase.from('appointments').insert(row)).error); await loadAppts() }, 'Agendado')) { ap.open = false; selected.value = ap.date }
}
const toggleDone = (a: Appt) => run(async () => { fail((await supabase.from('appointments').update({ done: !a.done }).eq('id', a.id)).error); await loadAppts() }, a.done ? 'Reaberto' : 'Concluído')
const removeAppt = (a: Appt) => confirm(`Excluir "${a.title}"?`) && run(async () => { fail((await supabase.from('appointments').delete().eq('id', a.id)).error); await loadAppts() }, 'Excluído')
const route = useRoute()
onMounted(() => {
  loadAppts().catch(() => {})
  const dia = route.query.dia
  if (typeof dia === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dia)) { cursor.value = dia; selected.value = dia }
})
</script>
<template>
  <PageHeader title="Calendário" sub="Vendas, feriados e a agenda de atendimentos e recontatos.">
    <button class="btn btn-primary" @click="newAppt()">Agendar</button>
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
    <button v-for="d in days" :key="d" class="min-h-20 bg-panel p-1.5 text-left hover:bg-raise" :class="{ '!bg-warn/10': !!data.holidayNames[d], 'ring-2 ring-gold ring-inset': d === selected, 'opacity-40': view === 'mes' && d.slice(0,7) !== cursor.slice(0,7) }" @click="selected = d">
      <div class="text-xs" :class="d === todayISO() ? 'font-bold text-gold' : 'text-mute'">{{ d.slice(8) }}</div>
      <div v-if="data.holidayNames[d]" class="truncate text-[10px] font-semibold text-warn" :title="data.holidayNames[d]">{{ data.holidayNames[d] }}</div>
      <div v-if="apptOpen(d)" class="truncate text-[10px] font-semibold text-gold">● {{ apptOpen(d) }} agendado(s)</div>
      <template v-if="stats(d).n"><div class="num text-sm font-bold">{{ stats(d).n }} <span class="text-xs font-normal text-mute">vendas</span></div>
        <div class="num hidden text-xs text-mute sm:block">{{ brl(stats(d).prem) }}</div><div class="num hidden text-xs text-gold sm:block">{{ brl(stats(d).com) }}</div>
        <div class="mt-0.5 flex gap-1 text-[10px]"><span v-if="stats(d).em" class="text-pos">{{ stats(d).em }}E</span><span v-if="stats(d).pend" class="text-warn">{{ stats(d).pend }}P</span><span v-if="stats(d).can" class="text-neg">{{ stats(d).can }}C</span></div></template>
    </button>
  </div>
  <div v-if="monthHolidays.length" class="card mt-4"><h2 class="mb-2 font-bold">Feriados do mês</h2>
    <ul class="grid gap-1 text-sm sm:grid-cols-2"><li v-for="[d, n] in monthHolidays" :key="d" class="flex justify-between gap-2"><span class="text-warn">{{ dateBR(d) }}</span><span class="truncate">{{ n }}</span></li></ul>
    <p class="mt-2 text-xs text-mute">Feriados nacionais e os cadastrados em Configurações. Eles ficam de fora dos dias úteis da projeção.</p></div>
  <div class="card mt-4">
    <div class="mb-2 flex flex-wrap items-center justify-between gap-2"><h2 class="font-bold">Agenda de {{ dateBR(selected) }}</h2><button class="btn" @click="newAppt()">Agendar neste dia</button></div>
    <ul class="divide-y divide-line/60">
      <li v-for="a in dayAppts" :key="a.id" class="flex flex-wrap items-center gap-3 py-2.5">
        <span class="num w-14 shrink-0 font-semibold" :class="a.done ? 'text-mute line-through' : ''">{{ timeOf(a.starts_at) }}</span>
        <span class="rounded-full bg-gold/10 px-2 py-0.5 text-xs font-semibold text-gold">{{ KINDS[a.kind] }}</span>
        <span class="min-w-0 flex-1"><span :class="a.done ? 'text-mute line-through' : 'font-medium'">{{ a.title }}</span><span v-if="a.client_id" class="text-sm text-mute"> · {{ clientName(a.client_id) }}</span><span v-if="a.notes" class="block text-xs text-mute">{{ a.notes }}</span></span>
        <button class="btn" @click="toggleDone(a)">{{ a.done ? 'Reabrir' : 'Concluir' }}</button><button class="btn" @click="editAppt(a)">Editar</button><button class="btn btn-danger" @click="removeAppt(a)">Excluir</button>
      </li>
      <li v-if="!dayAppts.length" class="py-4 text-center text-sm text-mute">Nada agendado neste dia.</li>
    </ul>
  </div>
  <div class="card mt-4 overflow-x-auto"><h2 class="mb-2 font-bold">Vendas de {{ dateBR(selected) }}</h2>
    <div class="tbl-scroll"><table class="tbl"><thead><tr><th>Cliente</th><th>Produto</th><th class="text-right">Prêmio</th><th class="text-right">Comissão</th><th>Status</th></tr></thead>
      <tbody><tr v-for="s in daySales" :key="s.id" class="cursor-pointer" @click="router.push('/vendas/' + s.id)"><td>{{ s.clients?.full_name }}</td><td>{{ s.products?.name }}</td>
        <td class="num text-right">{{ brl(s.premium) }}</td><td class="num text-right">{{ brl(s.net_commission) }}</td><td><StatusBadge :value="s.status" /></td></tr>
        <tr v-if="!daySales.length"><td colspan="5" class="py-4 text-center text-mute">Sem vendas neste dia.</td></tr></tbody></table></div></div>

  <ModalBox :open="ap.open" :title="ap.id ? 'Editar agendamento' : 'Novo agendamento'" @close="ap.open = false">
    <div class="grid gap-3 sm:grid-cols-2">
      <div><label class="label">Tipo</label><USelect v-model="ap.kind" class="input"><option value="atendimento">Atendimento</option><option value="recontato">Recontato</option><option value="outro">Outro</option></USelect></div>
      <div class="relative"><label class="label" for="apc">Cliente (opcional)</label><input id="apc" v-model="ap.client" class="input" placeholder="Digite o nome" />
        <ul v-if="apMatches.length" class="card absolute z-10 mt-1 w-full !p-1"><li v-for="c in apMatches" :key="c.id"><button type="button" class="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-raise" @click="ap.client = c.full_name">{{ c.full_name }}</button></li></ul></div>
      <div><label class="label">Data</label><UDate v-model="ap.date" class="input" :clearable="false" /></div>
      <div><label class="label">Hora</label><USelect v-model="ap.time" class="input"><option v-for="t in TIMES" :key="t" :value="t">{{ t }}</option></USelect></div>
      <div class="sm:col-span-2"><label class="label" for="apt">Assunto (opcional)</label><input id="apt" v-model="ap.title" class="input" placeholder="Ex.: retomar a cotação do Gol" /></div>
      <div class="sm:col-span-2"><label class="label" for="apn">Observações</label><textarea id="apn" v-model="ap.notes" class="input" rows="2" /></div>
    </div>
    <p class="mt-2 text-xs text-mute">Você recebe um aviso no sino às 8h30 do dia marcado (em dia útil).</p>
    <div class="mt-4 flex justify-end gap-2"><button class="btn" @click="ap.open = false">Cancelar</button><button class="btn btn-primary" @click="saveAppt">Salvar</button></div>
  </ModalBox>
</template>
