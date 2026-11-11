<script setup lang="ts">
import { computed } from 'vue'
import { useData } from '@/stores/data'
import { brl, todayISO } from '@/utils/format'
import { project } from '@/utils/projections'
import PageHeader from '@/components/PageHeader.vue'
import StatCard from '@/components/StatCard.vue'

const data = useData()
const p = computed(() => project(data.dataset, todayISO(), data.holidaySet))
const goal = computed(() => data.goals.find(g => g.month === todayISO().slice(0, 7) + '-01'))
const sc = computed(() => [['Conservador', p.value.scenarios.conservador], ['Provável', p.value.scenarios.provavel], ['Otimista', p.value.scenarios.otimista]] as const)
const conf = computed(() => ({ baixa: 'text-neg', media: 'text-warn', alta: 'text-pos' }[p.value.confidence]))
</script>
<template>
  <PageHeader title="Projeções do mês" sub="Estimativas — nunca valores garantidos." />
  <div class="mb-4 grid gap-4 md:grid-cols-3">
    <div v-for="[name, s] in sc" :key="name" v-reveal.stagger class="card" :class="name === 'Provável' ? '!border-gold !bg-gold text-white dark:text-[#04210f]' : ''">
      <h2 class="text-sm font-semibold uppercase tracking-wide" :class="name === 'Provável' ? '' : 'text-mute'">{{ name }}</h2>
      <div class="num mt-1 font-display text-4xl font-semibold tracking-tight" :class="name === 'Provável' ? '' : 'text-gold'">{{ brl(s.net) }}</div>
      <div class="text-xs opacity-75">comissão no fechamento do mês</div>
      <dl class="num mt-4 space-y-1.5 border-t border-current/20 pt-3 text-sm">
        <div class="flex justify-between"><dt class="opacity-75">Vendas</dt><dd>{{ s.count }}</dd></div>
        <div class="flex justify-between"><dt class="opacity-75">Estornos estimados</dt><dd>{{ brl(s.reversals) }}</dd></div>
        <div class="flex justify-between font-bold"><dt>Resultado após estornos</dt><dd>{{ brl(s.adjusted) }}</dd></div>
        <div v-if="goal?.target_net" class="flex justify-between"><dt class="opacity-75">Distância até a meta</dt><dd>{{ brl(Math.max(goal.target_net - s.net, 0)) }}</dd></div>
      </dl>
    </div>
  </div>
  <div class="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    <StatCard label="Comissão gerada até agora" :value="brl(p.generatedSoFar)" />
    <StatCard label="Dias úteis (passados / restantes)" :value="`${p.elapsedBizDays} / ${p.remainingBizDays}`" />
    <StatCard label="Comissão média por venda" :value="brl(p.avgNetPerSale)" />
    <StatCard label="Taxa de cancelamento (coortes maduras)" :value="(p.matureCancelRate * 100).toFixed(1) + '%'" hint="Vendas com menos de 90 dias não herdam esta taxa." />
  </div>
  <p class="text-xs text-mute">Confiabilidade: <b :class="conf" class="uppercase">{{ p.confidence }}</b> · {{ p.monthsOfHistory }} meses com histórico · {{ p.note }}</p>
</template>
