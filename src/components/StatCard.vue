<script setup lang="ts">
defineProps<{ label: string; value: string; hint?: string; tone?: 'pos' | 'neg' | 'gold' | 'warn' | '' }>()
</script>
<template>
  <!-- tone="gold" vira o cartão de destaque (verde cheio), como no modelo de referência -->
  <div v-reveal.stagger class="card" :class="tone === 'gold' ? '!border-gold !bg-gold text-white dark:text-[#04210f]' : ''">
    <div class="text-xs" :class="tone === 'gold' ? 'opacity-80' : 'text-mute'">{{ label }}</div>
    <div class="num mt-1 font-display text-2xl font-semibold tracking-tight"
         :class="{ 'text-pos': tone === 'pos', 'text-neg': tone === 'neg', 'text-warn': tone === 'warn' }">{{ value }}</div>
    <div v-if="hint" class="mt-1 text-xs" :class="tone === 'gold' ? 'opacity-80' : 'text-mute'">{{ hint }}</div>
  </div>
</template>
