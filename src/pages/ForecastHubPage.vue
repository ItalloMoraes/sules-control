<script setup lang="ts">
import { ref } from 'vue'
import SegTabs from '@/components/SegTabs.vue'
import A from './ProjectionsPage.vue'
import B from './ComparisonsPage.vue'
const tab = ref('a')
</script>
<template>
  <SegTabs v-model="tab" :tabs="[{ id: 'a', label: 'Projeções' }, { id: 'b', label: 'Comparativos' }]" />
  <A v-if="tab === 'a'" /><B v-else />
</template>
