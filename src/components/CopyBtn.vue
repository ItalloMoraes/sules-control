<script setup lang="ts">
import { ref } from 'vue'
import AppIcon from './AppIcon.vue'
import { notify } from '@/composables/useToast'

const props = defineProps<{ text: string; label?: string }>()
const done = ref(false)
async function copy() {
  try { await navigator.clipboard.writeText(props.text); done.value = true; notify('Copiado'); setTimeout(() => { done.value = false }, 1200) }
  catch { notify('Não foi possível copiar', 'err') }
}
</script>
<template>
  <button type="button" class="inline-flex rounded-md p-1 text-mute transition-colors hover:bg-raise hover:text-gold" :aria-label="label ?? 'Copiar'" :title="label ?? 'Copiar'" @click.stop="copy">
    <AppIcon :name="done ? 'check' : 'copy'" :size="14" />
  </button>
</template>
