<script setup lang="ts">
defineProps<{ title: string; sub?: string }>()
</script>
<template>
  <div class="mb-4 flex flex-wrap items-end justify-between gap-2">
    <div><h1 class="text-2xl font-bold">{{ title }}</h1><p v-if="sub" class="text-sm text-mute">{{ sub }}</p></div>
    <div class="flex flex-wrap gap-2"><slot /></div>
  </div>
</template>