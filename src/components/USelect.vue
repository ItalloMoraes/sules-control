<script setup lang="ts">
// Lista suspensa no visual do site. Mantém um <select> nativo escondido, então os <option>
// (inclusive v-for) e o v-model funcionam como antes.
import { computed, nextTick, onMounted, onUpdated, ref, useAttrs, watch } from 'vue'
import { usePopover } from '@/composables/usePopover'

defineOptions({ inheritAttrs: false })
const props = defineProps<{ modelValue?: unknown }>()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const emit = defineEmits<{ (e: 'update:modelValue', v: any): void }>()
type Opt = { value: string; label: string; disabled: boolean }
const attrs = useAttrs()
const root = ref<HTMLElement>(), sel = ref<HTMLSelectElement>()
const { open, pop, style, close, toggle } = usePopover(root)
const opts = ref<Opt[]>([]), cur = ref('')
const rest = computed(() => Object.fromEntries(Object.entries(attrs).filter(([k]) => k !== 'class' && k !== 'style')))
const val = computed(() => String(props.modelValue ?? ''))

function read() {
  const s = sel.value
  if (!s) return
  opts.value = Array.from(s.options).map(o => ({ value: o.value, label: o.text, disabled: o.disabled }))
  cur.value = s.selectedOptions[0]?.text ?? ''
}
function choose(o: Opt) {
  if (o.disabled) return
  if (sel.value) sel.value.value = o.value
  emit('update:modelValue', o.value); cur.value = o.label; close()
}
onMounted(read); onUpdated(read)
watch(() => props.modelValue, () => nextTick(read))
</script>
<template>
  <div ref="root" class="relative" :class="attrs.class">
    <select ref="sel" :value="val" class="sr-only" tabindex="-1" aria-hidden="true"><slot /></select>
    <button type="button" v-bind="rest" class="flex w-full items-center justify-between gap-2 text-left" aria-haspopup="listbox"
            :aria-expanded="open" @click="toggle" @keydown.down.prevent="open = true">
      <span class="truncate" :class="cur ? '' : 'text-mute'">{{ cur || 'Selecione' }}</span>
      <svg class="shrink-0 text-mute transition-transform" :class="open ? 'rotate-180' : ''" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
    </button>
    <Teleport to="body">
      <Transition name="pop">
        <div v-if="open" ref="pop" role="listbox" class="fixed z-[60] max-h-64 overflow-auto rounded-2xl border border-line bg-panel p-1 shadow-[0_16px_40px_-12px_rgb(0_0_0/.3)]" :style="style">
          <button v-for="o in opts" :key="o.value" type="button" role="option" :aria-selected="o.value === val" :disabled="o.disabled"
                  class="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm text-text hover:bg-raise disabled:opacity-40"
                  :class="o.value === val ? 'font-semibold !text-gold' : ''" @click="choose(o)">
            <span class="truncate">{{ o.label }}</span>
            <svg v-if="o.value === val" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
          </button>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
