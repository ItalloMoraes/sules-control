<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SegTabs from '@/components/SegTabs.vue'
import SalesPage from './SalesPage.vue'
import CancellationsPage from './CancellationsPage.vue'

const route = useRoute(), router = useRouter()
const tab = computed({
  get: () => (route.query.tab === 'cancelamentos' ? 'cancelamentos' : 'vendas'),
  set: (v: string) => { router.replace({ query: v === 'cancelamentos' ? { tab: v } : {} }) },
})
</script>
<template>
  <SegTabs v-model="tab" :tabs="[{ id: 'vendas', label: 'Vendas' }, { id: 'cancelamentos', label: 'Cancelamentos' }]" />
  <SalesPage v-if="tab === 'vendas'" /><CancellationsPage v-else />
</template>
