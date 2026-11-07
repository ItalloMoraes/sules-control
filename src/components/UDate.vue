<script setup lang="ts">
// Calendário no visual do site (dia: AAAA-MM-DD; com a prop "month": AAAA-MM).
import { computed, ref, useAttrs, watch } from 'vue'
import { usePopover } from '@/composables/usePopover'

defineOptions({ inheritAttrs: false })
const props = withDefaults(defineProps<{ modelValue?: string | null; month?: boolean; clearable?: boolean }>(), { modelValue: '', month: false, clearable: true })
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()
const attrs = useAttrs()
const root = ref<HTMLElement>()
const { open, pop, style, close, toggle } = usePopover(root, 350, 288)
const rest = computed(() => Object.fromEntries(Object.entries(attrs).filter(([k]) => k !== 'class' && k !== 'style')))

const MES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const pad = (n: number) => String(n).padStart(2, '0')
const now = new Date()
const todayIso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
const vy = ref(now.getFullYear()), vm = ref(now.getMonth())

watch(open, o => {
  const m = /^(\d{4})-(\d{2})/.exec(props.modelValue ?? '')
  if (o && m) { vy.value = +m[1]; vm.value = +m[2] - 1 }
})
const shown = computed(() => {
  const v = props.modelValue ?? ''
  if (!v) return ''
  const [y, m, d] = v.split('-')
  return props.month ? `${MES[+m - 1].slice(0, 3).toLowerCase()}/${y}` : `${d}/${m}/${y}`
})
const cells = computed(() => {
  const first = new Date(vy.value, vm.value, 1).getDay(), n = new Date(vy.value, vm.value + 1, 0).getDate()
  return [...Array<number>(first).fill(0), ...Array.from({ length: n }, (_, i) => i + 1)]
})
const dayIso = (d: number) => `${vy.value}-${pad(vm.value + 1)}-${pad(d)}`
const monthIso = (i: number) => `${vy.value}-${pad(i + 1)}`
function pick(v: string) { emit('update:modelValue', v); close() }
function step(delta: number) {
  if (props.month) { vy.value += delta; return }
  const d = new Date(vy.value, vm.value + delta, 1)
  vy.value = d.getFullYear(); vm.value = d.getMonth()
}
</script>
<template>
  <div ref="root" class="relative" :class="attrs.class">
    <button type="button" v-bind="rest" class="flex w-full items-center justify-between gap-2 text-left" aria-haspopup="dialog" :aria-expanded="open" @click="toggle">
      <span class="truncate" :class="shown ? '' : 'text-mute'">{{ shown || (month ? 'mês/ano' : 'dd/mm/aaaa') }}</span>
      <svg class="shrink-0 text-mute" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2v4M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" /></svg>
    </button>
    <Teleport to="body">
      <Transition name="pop">
        <div v-if="open" ref="pop" role="dialog" aria-label="Calendário" class="fixed z-[60] rounded-2xl border border-line bg-panel p-3 shadow-[0_16px_40px_-12px_rgb(0_0_0/.3)]" :style="style">
          <div class="mb-2 flex items-center justify-between">
            <button type="button" class="rounded-full p-1.5 hover:bg-raise" aria-label="Anterior" @click="step(-1)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg></button>
            <span class="text-sm font-semibold">{{ month ? vy : `${MES[vm]} ${vy}` }}</span>
            <button type="button" class="rounded-full p-1.5 hover:bg-raise" aria-label="Próximo" @click="step(1)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg></button>
          </div>
          <div v-if="month" class="grid grid-cols-3 gap-1">
            <button v-for="(m, i) in MES" :key="m" type="button" class="rounded-xl py-2 text-sm hover:bg-raise"
                    :class="modelValue?.slice(0, 7) === monthIso(i) ? '!bg-gold text-white dark:text-[#04210f]' : ''" @click="pick(monthIso(i))">{{ m.slice(0, 3) }}</button>
          </div>
          <template v-else>
            <div class="mb-1 grid grid-cols-7 text-center text-xs text-mute"><span v-for="(w, i) in ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']" :key="i">{{ w }}</span></div>
            <div class="grid grid-cols-7 gap-y-0.5">
              <template v-for="(d, i) in cells" :key="i">
                <span v-if="!d" />
                <button v-else type="button" class="mx-auto h-9 w-9 rounded-full text-sm hover:bg-raise"
                        :class="[dayIso(d) === modelValue ? '!bg-gold font-semibold text-white dark:text-[#04210f]' : '', dayIso(d) === todayIso && dayIso(d) !== modelValue ? 'ring-1 ring-gold' : '']"
                        @click="pick(dayIso(d))">{{ d }}</button>
              </template>
            </div>
          </template>
          <div class="mt-2 flex justify-between border-t border-line pt-2 text-sm">
            <button type="button" class="text-gold hover:underline" @click="pick(month ? todayIso.slice(0, 7) : todayIso)">{{ month ? 'Este mês' : 'Hoje' }}</button>
            <button v-if="clearable && !month" type="button" class="text-mute hover:underline" @click="pick('')">Limpar</button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
