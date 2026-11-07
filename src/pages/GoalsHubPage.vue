<script setup lang="ts">
import { ref } from 'vue'
import SegTabs from '@/components/SegTabs.vue'
import A from './GoalsPage.vue'
import B from './ConversionsPage.vue'
const tab = ref('a')
</script>
<template>
  <SegTabs v-model="tab" :tabs="[{ id: 'a', label: 'Metas' }, { id: 'b', label: 'Conversão de leads' }]" />
  <A v-if="tab === 'a'" /><B v-else />
</template>
