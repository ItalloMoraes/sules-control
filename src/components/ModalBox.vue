<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
const props = defineProps<{ title: string; open: boolean; wide?: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()
const panel = ref<HTMLElement>()
let previous: HTMLElement | null = null
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

watch(() => props.open, async o => {
  if (o) {
    previous = document.activeElement as HTMLElement | null
    await nextTick()
    const f = panel.value?.querySelector<HTMLElement>('input:not([disabled]),select,textarea') ?? panel.value?.querySelector<HTMLElement>(FOCUSABLE)
    f?.focus()
  } else previous?.focus()
})
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') { emit('close'); return }
  if (e.key !== 'Tab') return
  const list = panel.value?.querySelectorAll<HTMLElement>(FOCUSABLE)
  if (!list?.length) return
  const first = list[0], last = list[list.length - 1]
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
}
</script>
<template>
  <Transition name="modal">
  <div v-if="open" class="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/60 p-4" @keydown="onKey">
    <div ref="panel" class="card mt-10 w-full" :class="wide ? 'max-w-5xl' : 'max-w-2xl'" role="dialog" aria-modal="true" :aria-label="title">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-lg font-bold">{{ title }}</h2>
        <button class="btn" @click="emit('close')" aria-label="Fechar">✕</button>
      </div>
      <slot />
    </div>
  </div>
  </Transition>
</template>
