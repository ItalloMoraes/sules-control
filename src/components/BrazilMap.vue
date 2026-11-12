<script setup lang="ts">
// Mapa do Brasil em quadrados: cada estado fica numa posição aproximada do mapa real; quanto mais vendas, mais verde.
import { computed } from 'vue'
import { brl } from '@/utils/format'

const props = defineProps<{ counts: Record<string, number>; commission?: Record<string, number>; modelValue?: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()
// [UF, linha, coluna]
const TILES: [string, number, number][] = [
  ['RR', 0, 2], ['AP', 0, 4],
  ['AM', 1, 1], ['PA', 1, 3], ['MA', 1, 5], ['CE', 1, 6], ['RN', 1, 7],
  ['AC', 2, 0], ['RO', 2, 1], ['MT', 2, 2], ['TO', 2, 4], ['PI', 2, 5], ['PB', 2, 7],
  ['GO', 3, 3], ['DF', 3, 4], ['BA', 3, 5], ['PE', 3, 7],
  ['MS', 4, 2], ['MG', 4, 4], ['ES', 4, 5], ['AL', 4, 7],
  ['SP', 5, 3], ['RJ', 5, 5], ['SE', 5, 7],
  ['PR', 6, 3], ['SC', 7, 3], ['RS', 7, 2],
]
const S = 40, P = 44
const max = computed(() => Math.max(1, ...Object.values(props.counts)))
const ratio = (uf: string) => (props.counts[uf] ?? 0) / max.value
const fill = (uf: string) => (props.counts[uf] ? `rgb(var(--c-gold) / ${0.16 + 0.84 * ratio(uf)})` : 'rgb(var(--c-raise))')
const label = (uf: string) => `rgb(var(${ratio(uf) > 0.55 ? '--c-ink' : '--c-text'}))`
const tip = (uf: string) => `${uf}: ${props.counts[uf] ?? 0} venda(s)${props.commission?.[uf] ? ' · ' + brl(props.commission[uf]) : ''}`
const toggle = (uf: string) => emit('update:modelValue', props.modelValue === uf ? '' : uf)
</script>
<template>
  <div>
    <svg viewBox="0 0 396 352" class="mx-auto w-full max-w-md" role="group" aria-label="Mapa do Brasil com as vendas por estado">
      <g v-for="[uf, r, c] in TILES" :key="uf" class="cursor-pointer" role="button" tabindex="0" :aria-label="tip(uf)" :aria-pressed="modelValue === uf"
         @click="toggle(uf)" @keydown.enter.prevent="toggle(uf)" @keydown.space.prevent="toggle(uf)">
        <title>{{ tip(uf) }}</title>
        <rect :x="c * P" :y="r * P" :width="S" :height="S" rx="9" :style="{ fill: fill(uf), stroke: modelValue === uf ? 'rgb(var(--c-text))' : 'transparent', strokeWidth: 2 }" />
        <text :x="c * P + S / 2" :y="r * P + (counts[uf] ? 18 : 24)" text-anchor="middle" font-size="12" font-weight="700" :style="{ fill: label(uf) }">{{ uf }}</text>
        <text v-if="counts[uf]" :x="c * P + S / 2" :y="r * P + 32" text-anchor="middle" font-size="11" :style="{ fill: label(uf) }">{{ counts[uf] }}</text>
      </g>
    </svg>
    <div class="mt-2 flex items-center justify-center gap-2 text-xs text-mute"><span>Menos</span><span class="h-2 w-28 rounded-full" style="background: linear-gradient(90deg, rgb(var(--c-gold) / 0.16), rgb(var(--c-gold)))" /><span>Mais vendas</span></div>
  </div>
</template>
