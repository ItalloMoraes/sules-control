<script setup lang="ts">
// Mapa do Brasil por estado: quanto mais vendas, mais verde. Clique (ou Enter) num estado para ver as cidades.
import { computed } from 'vue'
import { brl } from '@/utils/format'
import { BR_LABELS, BR_PATHS, BR_VIEWBOX } from '@/utils/brazilMap'

const props = defineProps<{ counts: Record<string, number>; commission?: Record<string, number>; modelValue?: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()
const UFS = Object.keys(BR_PATHS)
const max = computed(() => Math.max(1, ...Object.values(props.counts)))
const ratio = (uf: string) => (props.counts[uf] ?? 0) / max.value
const fill = (uf: string) => (props.counts[uf] ? `rgb(var(--c-gold) / ${0.18 + 0.82 * ratio(uf)})` : 'rgb(var(--c-raise))')
const inside = (uf: string) => `rgb(var(${ratio(uf) > 0.55 ? '--c-ink' : '--c-text'}))`
const tip = (uf: string) => `${uf}: ${props.counts[uf] ?? 0} venda(s)${props.commission?.[uf] ? ' · ' + brl(props.commission[uf]) : ''}`
const toggle = (uf: string) => emit('update:modelValue', props.modelValue === uf ? '' : uf)
</script>
<template>
  <div>
    <svg :viewBox="BR_VIEWBOX" class="mx-auto w-full max-w-lg" role="group" aria-label="Mapa do Brasil com as vendas por estado">
      <g v-for="uf in UFS" :key="uf" class="cursor-pointer transition-opacity hover:opacity-80" role="button" tabindex="0" :aria-label="tip(uf)" :aria-pressed="modelValue === uf"
         @click="toggle(uf)" @keydown.enter.prevent="toggle(uf)" @keydown.space.prevent="toggle(uf)">
        <title>{{ tip(uf) }}</title>
        <path :d="BR_PATHS[uf]" fill-rule="evenodd" :style="{ fill: fill(uf), stroke: 'rgb(var(--c-panel))', strokeWidth: 1.6, strokeLinejoin: 'round' }" />
      </g>
      <path v-if="modelValue && BR_PATHS[modelValue]" :d="BR_PATHS[modelValue]" fill="none" fill-rule="evenodd" style="stroke: rgb(var(--c-text)); stroke-width: 3.2; stroke-linejoin: round; pointer-events: none" />
      <g pointer-events="none" font-weight="700" text-anchor="middle">
        <template v-for="uf in UFS" :key="'l' + uf">
          <template v-if="BR_LABELS[uf].lx === undefined">
            <text :x="BR_LABELS[uf].x" :y="BR_LABELS[uf].y + 6" font-size="21" :style="{ fill: inside(uf) }">{{ uf }}</text>
            <text v-if="counts[uf] && BR_LABELS[uf].r >= 30" :x="BR_LABELS[uf].x" :y="BR_LABELS[uf].y + 25" font-size="17" font-weight="500" :style="{ fill: inside(uf) }">{{ counts[uf] }}</text>
          </template>
          <template v-else>
            <line :x1="BR_LABELS[uf].x" :y1="BR_LABELS[uf].y" :x2="BR_LABELS[uf].lx" :y2="BR_LABELS[uf].ly" style="stroke: rgb(var(--c-mute)); stroke-width: 1.5" />
            <text :x="(BR_LABELS[uf].lx ?? 0) + (BR_LABELS[uf].anchor === 'end' ? -5 : 6)" :y="(BR_LABELS[uf].ly ?? 0) + 6" :text-anchor="BR_LABELS[uf].anchor === 'end' ? 'end' : 'start'" font-size="19" style="fill: rgb(var(--c-text))">{{ uf }}</text>
          </template>
        </template>
      </g>
    </svg>
    <div class="mt-2 flex items-center justify-center gap-2 text-xs text-mute"><span>Menos</span><span class="h-2 w-28 rounded-full" style="background: linear-gradient(90deg, rgb(var(--c-gold) / 0.18), rgb(var(--c-gold)))" /><span>Mais vendas</span></div>
  <p class="mt-1 text-center text-[11px] text-mute">Contornos: <a href="https://commons.wikimedia.org/wiki/File:Brazil_Political_Map.svg" target="_blank" rel="noopener noreferrer" class="underline">Felipe Menegaz</a>, <a href="https://creativecommons.org/licenses/by-sa/3.0/deed.pt-br" target="_blank" rel="noopener noreferrer" class="underline">CC BY-SA 3.0</a>, adaptado · <router-link to="/creditos" class="underline">Créditos</router-link></p>
  </div>
</template>
