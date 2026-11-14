<script setup lang="ts">
// Anel de progresso até a meta, com o memoji no centro (joinha, triste ou deslike) e o percentual na etiqueta de cima.
import { computed } from 'vue'
import { leadMood } from '@/utils/leadMood'

const props = defineProps<{ pct: number; goal: number }>()
const mood = computed(() => leadMood(props.pct, props.goal))
const fill = computed(() => Math.min(100, props.goal > 0 ? (props.pct / props.goal) * 100 : 0))
</script>
<template>
  <div class="relative h-28 w-28 shrink-0" role="img" :aria-label="`Conversão de ${pct}% para meta de ${goal}%: ${mood.label}`">
    <svg viewBox="0 0 36 36" class="absolute inset-0 -rotate-90" aria-hidden="true">
      <circle cx="18" cy="18" r="16" fill="none" stroke="currentColor" class="text-raise" stroke-width="2.4" />
      <circle cx="18" cy="18" r="16" fill="none" :stroke="mood.color" stroke-width="2.4" stroke-linecap="round" pathLength="100" :stroke-dasharray="`${fill} 100`" class="transition-[stroke-dasharray] duration-700" />
    </svg>
    <div class="absolute inset-[9px] overflow-hidden rounded-full bg-raise"><img :src="mood.img" :alt="mood.alt" class="h-full w-full object-contain p-1.5" /></div>
    <span class="num absolute -top-1 left-1/2 -translate-x-1/2 rounded-md border bg-panel px-1.5 text-xs font-bold" :style="{ borderColor: mood.color, color: mood.color }">{{ pct }}%</span>
  </div>
</template>
