<script setup lang="ts">
// Campo de valor no padrão brasileiro: aceita colar "1.234,56" (ou "R$ 1.234,56") e mostra 1.234,56 ao sair do campo.
import { ref, watch } from 'vue'
import { parseBRL } from '@/utils/format'

const props = defineProps<{ modelValue?: number | null }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: number): void }>()
const fmt = (n?: number | null) => (n == null || Number.isNaN(n) ? '' : n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
const text = ref(fmt(props.modelValue))
const focused = ref(false)
watch(() => props.modelValue, v => { if (!focused.value) text.value = fmt(v) })

function onInput(e: Event) {
  text.value = (e.target as HTMLInputElement).value
  emit('update:modelValue', parseBRL(text.value))
}
function onBlur() { focused.value = false; text.value = fmt(props.modelValue) }
</script>
<template>
  <input :value="text" inputmode="decimal" autocomplete="off" @input="onInput" @focus="focused = true; ($event.target as HTMLInputElement).select()" @blur="onBlur" />
</template>
