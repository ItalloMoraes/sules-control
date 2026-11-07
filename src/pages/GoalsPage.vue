<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { supabase, fail } from '@/services/supabase'
import { useData } from '@/stores/data'
import { run } from '@/composables/useToast'
import { brl, monthEnd, monthStart, todayISO } from '@/utils/format'
import { summarize } from '@/utils/finance'
import { project } from '@/utils/projections'
import PageHeader from '@/components/PageHeader.vue'

const data = useData()
const month = ref(monthStart(todayISO()))
const g = reactive({ target_count: null as number | null, target_premium: null as number | null, target_gross: null as number | null, target_net: null as number | null, net_basis: 'generated' as 'generated' | 'after_reversals' })
watch([month, () => data.goals], () => {
  const x = data.goals.find(v => v.month === month.value)
  Object.assign(g, x ? { target_count: x.target_count, target_premium: x.target_premium, target_gross: x.target_gross, target_net: x.target_net, net_basis: x.net_basis }
    : { target_count: null, target_premium: null, target_gross: null, target_net: null, net_basis: data.settings?.goal_net_basis ?? 'generated' })
}, { immediate: true })

const s = computed(() => summarize(data.dataset, { from: month.value, to: monthEnd(month.value) }))
const proj = computed(() => project(data.dataset, todayISO(), new Set(data.holidays)))
const isCurrent = computed(() => month.value === monthStart(todayISO()))
const rows = computed(() => {
  const netDone = g.net_basis === 'after_reversals' ? s.value.adjustedResult : s.value.net
  const projNet = g.net_basis === 'after_reversals' ? proj.value.scenarios.provavel.adjusted : proj.value.scenarios.provavel.net
  const mk = (label: string, target: number | null, done: number, projected: number | null, money = true) => ({ label, target, done, money,
    pctDone: target ? done / target : 0, left: target ? Math.max(target - done, 0) : 0, projected })
  return [
    mk('Quantidade de seguros', g.target_count, s.value.issuedCount, isCurrent.value ? proj.value.scenarios.provavel.count : null, false),
    mk('Prêmios', g.target_premium, s.value.premium, null),
    mk('Comissão bruta', g.target_gross, s.value.gross, isCurrent.value ? proj.value.scenarios.provavel.gross : null),
    mk(`Comissão líquida (${g.net_basis === 'generated' ? 'gerada' : 'após estornos'})`, g.target_net, netDone, isCurrent.value ? projNet : null),
  ]
})
const fmt = (v: number, money: boolean) => money ? brl(v) : String(Math.round(v))
async function save() {
  await run(async () => {
    const { data: u } = await supabase.auth.getUser()
    fail((await supabase.from('goals').upsert({ user_id: u.user!.id, month: month.value, ...g }, { onConflict: 'user_id,month' })).error)
    await data.refresh()
  }, 'Metas salvas')
}
</script>
<template>
  <PageHeader title="Metas" sub="Contam apenas vendas emitidas e não canceladas. Estornos não reduzem a quantidade.">
    <input type="month" class="input" :value="month.slice(0,7)" @change="month = (($event.target as HTMLInputElement).value || month.slice(0,7)) + '-01'" aria-label="Mês" />
  </PageHeader>
  <div class="card mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
    <div><label class="label">Qtd. de seguros</label><input v-model.number="g.target_count" type="number" class="input" /></div>
    <div><label class="label">Prêmios (R$)</label><input v-model.number="g.target_premium" type="number" class="input" /></div>
    <div><label class="label">Comissão bruta (R$)</label><input v-model.number="g.target_gross" type="number" class="input" /></div>
    <div><label class="label">Comissão líquida (R$)</label><input v-model.number="g.target_net" type="number" class="input" /></div>
    <div><label class="label">Meta líquida mede</label><select v-model="g.net_basis" class="input"><option value="generated">Gerada originalmente</option><option value="after_reversals">Após estornos efetivados</option></select></div>
    <div class="sm:col-span-2 lg:col-span-5"><button class="btn btn-primary" @click="save">Salvar metas</button></div>
  </div>
  <div class="grid gap-3 md:grid-cols-2">
    <div v-for="r in rows" :key="r.label" class="card">
      <div class="flex justify-between"><h2 class="font-bold">{{ r.label }}</h2><span class="num text-gold">{{ r.target ? (r.pctDone * 100).toFixed(0) + '%' : 'sem meta' }}</span></div>
      <div class="my-2 h-2 overflow-hidden rounded bg-raise"><div class="h-full bg-gold" :style="{ width: Math.min(r.pctDone * 100, 100) + '%' }" /></div>
      <div class="num text-sm text-mute">Meta {{ r.target ? fmt(r.target, r.money) : '—' }} · Realizado {{ fmt(r.done, r.money) }} · Falta {{ fmt(r.left, r.money) }}</div>
      <div v-if="r.projected !== null" class="num text-sm">Projeção de fechamento (estimativa): <b>{{ fmt(r.projected, r.money) }}</b></div>
    </div>
  </div>
</template>