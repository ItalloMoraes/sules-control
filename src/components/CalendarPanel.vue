<script setup lang="ts">
import { computed, ref, watch } from 'vue'
const props = defineProps<{ modelValue?: string | null; title?: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()
const MES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const pad = (n: number) => String(n).padStart(2, '0')
const now = new Date()
const todayIso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
const vy = ref(now.getFullYear()), vm = ref(now.getMonth())
watch(() => props.modelValue, v => { const m = /^(\d{4})-(\d{2})/.exec(v ?? ''); if (m) { vy.value = +m[1]; vm.value = +m[2] - 1 } }, { immediate: true })
const cells = computed(() => {
  const first = new Date(vy.value, vm.value, 1).getDay(), n = new Date(vy.value, vm.value + 1, 0).getDate()
  return [...Array<number>(first).fill(0), ...Array.from({ length: n }, (_, i) => i + 1)]
})
const iso = (d: number) => `${vy.value}-${pad(vm.value + 1)}-${pad(d)}`
function step(delta: number) { const d = new Date(vy.value, vm.value + delta, 1); vy.value = d.getFullYear(); vm.value = d.getMonth() }
</script>
<template>
  <div>
    <div v-if="title" class="mb-1 text-xs font-semibold uppercase tracking-wide text-mute">{{ title }}</div>
    <div class="mb-2 flex items-center justify-between">
      <button type="button" class="rounded-full p-1.5 hover:bg-raise" aria-label="Mês anterior" @click="step(-1)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg></button>
      <span class="text-sm font-semibold">{{ MES[vm] }} {{ vy }}</span>
      <button type="button" class="rounded-full p-1.5 hover:bg-raise" aria-label="Próximo mês" @click="step(1)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg></button>
    </div>
    <div class="mb-1 grid grid-cols-7 text-center text-xs text-mute"><span v-for="(w, i) in ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']" :key="i">{{ w }}</span></div>
    <div class="grid grid-cols-7 gap-y-0.5">
      <template v-for="(d, i) in cells" :key="i">
        <span v-if="!d" />
        <button v-else type="button" class="mx-auto h-8 w-8 rounded-full text-sm hover:bg-raise"
                :class="[iso(d) === modelValue ? '!bg-gold font-semibold text-white dark:text-[#04210f]' : '', iso(d) === todayIso && iso(d) !== modelValue ? 'ring-1 ring-gold' : '']"
                @click="emit('update:modelValue', iso(d))">{{ d }}</button>
      </template>
    </div>
  </div>
</template>
