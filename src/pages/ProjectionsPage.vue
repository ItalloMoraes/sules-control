<script setup lang="ts">
import { computed } from 'vue'
import { useData } from '@/stores/data'
import { brl, todayISO } from '@/utils/format'
import { project } from '@/utils/projections'
import PageHeader from '@/components/PageHeader.vue'
import StatCard from '@/components/StatCard.vue'

const data = useData()
const p = computed(() => project(data.dataset, todayISO(), new Set(data.holidays)))
const goal = computed(() => data.goals.find(g => g.month === todayISO().slice(0, 7) + '-01'))
const sc = computed(() => [['Conservador', p.value.scenarios.conservador], ['Provável', p.value.scenarios.provavel], ['Otimista', p.value.scenarios.otimista]] as const)
const conf = computed(() => ({ baixa: 'text-neg', media: 'text-warn', alta: 'text-pos' }[p.value.confidence]))
</script>
<template>
  <PageHeader title="Projeções do mês" sub="Estimativas — nunca valores garantidos." />
  <div class="card mb-4 text-sm">Confiabilidade: <b :class="conf" class="uppercase">{{ p.confidence }}</b> · {{ p.monthsOfHistory }} meses com histórico · {{ p.note }}</div>
  <div class="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    <StatCard label="Comissão gerada até agora" :value="brl(p.generatedSoFar)" tone="gold" />
    <StatCard label="Dias úteis (passados / restantes)" :value="`${p.elapsedBizDays} / ${p.remainingBizDays}`" />
    <StatCard label="Comissão média por venda" :value="brl(p.avgNetPerSale)" />
    <StatCard label="Taxa de cancelamento (coortes maduras)" :value="(p.matureCancelRate * 100).toFixed(1) + '%'" hint="Vendas com menos de 90 dias não herdam esta taxa." />
  </div>
  <div class="grid gap-3 md:grid-cols-3">
    <div v-for="[name, s] in sc" :key="name" class="card" :class="name === 'Provável' ? 'border-gold' : ''">
      <h2 class="font-bold">{{ name }}</h2>
      <dl class="num mt-2 space-y-1 text-sm">
        <div class="flex justify-between"><dt class="text-mute">Vendas</dt><dd>{{ s.count }}</dd></div>
        <div class="flex justify-between"><dt class="text-mute">Comissão no fechamento</dt><dd>{{ brl(s.net) }}</dd></div>
        <div class="flex justify-between"><dt class="text-mute">Estornos estimados</dt><dd>{{ brl(s.reversals) }}</dd></div>
        <div class="flex justify-between font-bold"><dt>Resultado após estornos</dt><dd>{{ brl(s.adjusted) }}</dd></div>
        <div v-if="goal?.target_net" class="flex justify-between"><dt class="text-mute">Distância até a meta</dt><dd>{{ brl(Math.max(goal.target_net - s.net, 0)) }}</dd></div>
      </dl>
    </div>
  </div>
</template>
