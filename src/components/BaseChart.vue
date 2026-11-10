<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Chart, registerables, type ChartConfiguration, type ScriptableContext } from 'chart.js'
Chart.register(...registerables)

const props = defineProps<{ config: ChartConfiguration; height?: number }>()
const emit = defineEmits<{ (e: 'pick', index: number, dataset: number): void }>()
const el = ref<HTMLCanvasElement>()
let chart: Chart | null = null

const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, system-ui, sans-serif'
const compact = (n: number) => new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
const alpha = (hex: string, a: number) => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!m) return hex
  const n = parseInt(m[1], 16)
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`
}

const pctLabels = (fontColor: string) => (chart: Chart) => {
  const ds = chart.data.datasets[0], vals = (ds.data as number[]).map(Number), colors = ds.backgroundColor as string[]
  const total = vals.reduce((a, b) => a + b, 0) || 1
  return (chart.data.labels ?? []).map((l, i) => ({ text: `${l}  ${Math.round((vals[i] / total) * 100)}%`, fillStyle: colors[i], strokeStyle: colors[i], lineWidth: 0, hidden: !chart.getDataVisibility(i), index: i, pointStyle: 'circle' as const, fontColor }))
}

// Visual limpo: barras arredondadas, linhas suaves com degradê, rosca fina, grade discreta.
function themed(cfg: ChartConfiguration): ChartConfiguration {
  const css = getComputedStyle(document.documentElement)
  const tok = (v: string) => css.getPropertyValue(v).trim()
  const mute = `rgb(${tok('--c-mute')})`, text = `rgb(${tok('--c-text')})`, panel = `rgb(${tok('--c-panel')})`
  const border = `rgb(${tok('--c-line')})`, grid = `rgb(${tok('--c-line')} / 0.7)`
  const copy = structuredClone(cfg) as ChartConfiguration
  const round = copy.type === 'doughnut' || copy.type === 'pie'
  for (const ds of copy.data.datasets as unknown as Record<string, unknown>[]) {
    const hex = typeof ds.backgroundColor === 'string' && /^#/.test(ds.backgroundColor) ? ds.backgroundColor : ''
    if (copy.type === 'bar') {
      Object.assign(ds, { borderRadius: 8, borderSkipped: false, maxBarThickness: (ds.maxBarThickness as number | undefined) ?? 26, categoryPercentage: (ds.categoryPercentage as number | undefined) ?? 0.7, barPercentage: (ds.barPercentage as number | undefined) ?? 0.85 })
      if (hex) ds.backgroundColor = (c: ScriptableContext<'bar'>) => {   // degradê; o período mais recente fica em destaque
        const a = c.chart.chartArea
        if (!a) return hex
        const last = c.dataIndex === (c.dataset.data.length - 1), g = c.chart.ctx.createLinearGradient(0, a.top, 0, a.bottom)
        g.addColorStop(0, alpha(hex, last ? 1 : 0.8)); g.addColorStop(1, alpha(hex, last ? 0.7 : 0.4))
        return g
      }
    } else if (copy.type === 'line') {
      const base = String(ds.borderColor)
      Object.assign(ds, { tension: 0.4, borderWidth: 2.5, pointRadius: (c: ScriptableContext<'line'>) => (c.dataIndex === c.dataset.data.length - 1 ? 4.5 : 0),
        pointHoverRadius: 5, pointBackgroundColor: base, pointBorderColor: panel, pointBorderWidth: 2, pointHoverBackgroundColor: base, pointHoverBorderColor: panel, pointHoverBorderWidth: 2,
        backgroundColor: (c: ScriptableContext<'line'>) => {
          const a = c.chart.chartArea
          if (!a) return 'transparent'
          const g = c.chart.ctx.createLinearGradient(0, a.top, 0, a.bottom)
          g.addColorStop(0, alpha(base, 0.28)); g.addColorStop(1, alpha(base, 0))
          return g
        } })
    } else if (round) Object.assign(ds, { borderWidth: 0, spacing: 4, borderRadius: 10, hoverOffset: 6 })
  }
  const tick = { color: mute, font: { family: FONT, size: 11 } }
  copy.options = {
    responsive: true, maintainAspectRatio: false,
    animation: { duration: 700, easing: 'easeOutQuart' },
    interaction: round ? undefined : { mode: 'index', intersect: false },
    cutout: round ? '74%' : undefined,
    layout: { padding: round ? 6 : 0 },
    plugins: {
      legend: { position: round ? 'bottom' : 'top', align: round ? 'center' : 'end',
        labels: { color: mute, usePointStyle: true, pointStyle: 'circle', boxWidth: 8, boxHeight: 8, padding: 16, font: { family: FONT, size: 12 }, ...(round ? { generateLabels: pctLabels(mute) } : {}) } },
      tooltip: { backgroundColor: panel, titleColor: text, bodyColor: mute, borderColor: border, borderWidth: 1, cornerRadius: 12, padding: 12, boxPadding: 6,
        usePointStyle: true, titleFont: { family: FONT, weight: 600 }, bodyFont: { family: FONT } },
    },
    scales: round ? undefined : {
      x: { grid: { display: false }, border: { display: false }, ticks: tick },
      y: { grid: { color: grid }, border: { display: false }, ticks: { ...tick, padding: 8, maxTicksLimit: 5, callback: (v: string | number) => compact(Number(v)) } },
    },
    onClick: (_e: unknown, els: { index: number; datasetIndex: number }[]) => { if (els[0]) emit('pick', els[0].index, els[0].datasetIndex) },
    ...(copy.options ?? {}),
  } as unknown as ChartConfiguration['options']
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
