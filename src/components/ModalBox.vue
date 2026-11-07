<script setup lang="ts">
defineProps<{ title: string; open: boolean }>()
defineEmits<{ (e: 'close'): void }>()
</script>
<template>
  <Transition name="modal">
  <div v-if="open" class="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/60 p-4" @keydown.esc="$emit('close')">
    <div class="card mt-10 w-full max-w-2xl" role="dialog" aria-modal="true" :aria-label="title">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-lg font-bold">{{ title }}</h2>
        <button class="btn" @click="$emit('close')" aria-label="Fechar">✕</button>
      </div>
      <slot />
    </div>
  </div>
  </Transition>
</template>
