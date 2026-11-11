<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from './AppIcon.vue'
defineProps<{ title: string; sub?: string }>()
const route = useRoute(), router = useRouter()
// só aparece quando existe uma página anterior dentro do sistema
const canBack = computed(() => route.path !== '/' && !!window.history.state?.back)
</script>
<template>
  <div class="mb-4 flex flex-wrap items-end justify-between gap-2">
    <div class="flex items-start gap-3">
      <button v-if="canBack" type="button" class="btn mt-0.5 !px-2.5" aria-label="Voltar" title="Voltar" @click="router.back()"><AppIcon name="back" /></button>
      <div><h1 class="text-2xl font-bold">{{ title }}</h1><p v-if="sub" class="text-sm text-mute">{{ sub }}</p></div>
    </div>
    <div class="flex flex-wrap gap-2"><slot /></div>
  </div>
</template>
