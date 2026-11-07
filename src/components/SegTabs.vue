<script setup lang="ts">
defineProps<{ tabs: { id: string; label: string }[]; modelValue: string }>()
defineEmits<{ (e: 'update:modelValue', v: string): void }>()
</script>
<template>
  <div class="mb-4 inline-flex rounded-full bg-raise p-1" role="tablist">
    <button v-for="t in tabs" :key="t.id" role="tab" :aria-selected="modelValue === t.id" class="rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
            :class="modelValue === t.id ? 'bg-panel text-text shadow-sm' : 'text-mute hover:text-text'" @click="$emit('update:modelValue', t.id)">{{ t.label }}</button>
  </div>
</template>
