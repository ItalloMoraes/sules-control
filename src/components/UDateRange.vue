<script setup lang="ts">
// Um campo só, "Todas as datas"; ao abrir mostra dois calendários (início e fim) e atalhos de período.
import { computed, ref, useAttrs } from 'vue'
import { usePopover } from '@/composables/usePopover'
import CalendarPanel from './CalendarPanel.vue'

defineOptions({ inheritAttrs: false })
const props = defineProps<{ from?: string | null; to?: string | null }>()
const emit = defineEmits<{ (e: 'update:from', v: string): void; (e: 'update:to', v: string): void }>()
const attrs = useAttrs()
const root = ref<HTMLElement>()
const { open, pop, style, close, toggle } = usePopover(root, 420, 600)
const rest = computed(() => Object.fromEntries(Object.entries(attrs).filter(([k]) => k !== 'class' && k !== 'style')))

const fmt = (v?: string | null) => (v ? v.split('-').reverse().join('/') : '')
const label = computed(() => (!props.from && !props.to ? 'Todas as datas' : `${fmt(props.from) || '…'} – ${fmt(props.to) || '…'}`))
const pad = (n: number) => String(n).padStart(2, '0')
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const now = new Date(), y = now.getFullYear(), m = now.getMonth()
const presets: [string, () => [string, string]][] = [
  ['Este mês', () => [iso(new Date(y, m, 1)), iso(new Date(y, m + 1, 0))]],
  ['Mês passado', () => [iso(new Date(y, m - 1, 1)), iso(new Date(y, m, 0))]],
  ['Últimos 30 dias', () => [iso(new Date(now.getTime() - 29 * 86400000)), iso(now)]],
  ['Este ano', () => [`${y}-01-01`, `${y}-12-31`]],
  ['Todas as datas', () => ['', '']],
]
function apply(p: [string, string]) { emit('update:from', p[0]); emit('update:to', p[1]) }
</script>
<template>
  <div ref="root" class="relative" :class="attrs.class">
    <button type="button" v-bind="rest" class="flex w-full items-center justify-between gap-2 text-left" aria-haspopup="dialog" :aria-expanded="open" @click="toggle">
      <span class="truncate" :class="from || to ? '' : 'text-mute'">{{ label }}</span>
      <svg class="shrink-0 text-mute" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2v4M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" /></svg>
    </button>
    <Teleport to="body">
      <Transition name="pop">
        <div v-if="open" ref="pop" role="dialog" aria-label="Período" class="fixed z-[60] max-w-[calc(100vw-1rem)] rounded-2xl border border-line bg-panel p-4 shadow-[0_16px_40px_-12px_rgb(0_0_0/.3)]" :style="style">
          <div class="mb-3 flex flex-wrap gap-1.5">
            <button v-for="[n, fn] in presets" :key="n" type="button" class="rounded-full border border-line px-3 py-1 text-xs hover:border-gold hover:text-gold" @click="apply(fn())">{{ n }}</button>
          </div>
          <div class="grid gap-5 sm:grid-cols-2">
            <CalendarPanel title="Início" :model-value="from" @update:model-value="emit('update:from', $event)" />
            <CalendarPanel title="Fim" :model-value="to" @update:model-value="emit('update:to', $event)" />
          </div>
          <div class="mt-3 flex justify-end"><button type="button" class="btn btn-primary" @click="close">Concluir</button></div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
