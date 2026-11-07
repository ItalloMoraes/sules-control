<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Chart, registerables, type ChartConfiguration } from 'chart.js'
Chart.register(...registerables)

const props = defineProps<{ config: ChartConfiguration; height?: number }>()
const emit = defineEmits<{ (e: 'pick', index: number, dataset: number): void }>()
const el = ref<HTMLCanvasElement>()
let chart: Chart | null = null

function themed(cfg: ChartConfiguration): ChartConfiguration {
  const css = getComputedStyle(document.documentElement)
  const mute = `rgb(${css.getPropertyValue('--c-mute')})`
  const line = `rgb(${css.getPropertyValue('--c-line')})`
  const copy = structuredClone(cfg) as ChartConfiguration
  copy.options = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { color: mute, boxWidth: 10 } } },
    scales: copy.type === 'doughnut' || copy.type === 'pie' ? undefined : {
      x: { ticks: { color: mute }, grid: { color: line } },
      y: { ticks: { color: mute }, grid: { color: line } },
    },
    onClick: (_e, els) => { if (els[0]) emit('pick', els[0].index, els[0].datasetIndex) },
    ...(copy.options ?? {}),
  }
  return copy
}
function draw() {
  chart?.destroy()
  if (el.value) chart = new Chart(el.value, themed(props.config))
}
onMounted(draw)
watch(() => props.config, draw, { deep: true })
onBeforeUnmount(() => chart?.destroy())
</script>
<template><div :style="{ height: (height ?? 240) + 'px' }"><canvas ref="el" /></div></template>
