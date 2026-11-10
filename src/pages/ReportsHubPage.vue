<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SegTabs from '@/components/SegTabs.vue'
import ReportsPage from './ReportsPage.vue'
import ReconciliationListPage from './ReconciliationListPage.vue'

const route = useRoute(), router = useRouter()
const tab = computed({
  get: () => (route.query.tab === 'conferencia' ? 'conferencia' : 'relatorios'),
  set: (v: string) => { router.replace({ query: v === 'conferencia' ? { tab: v } : {} }) },
})
</script>
<template>
  <SegTabs v-model="tab" :tabs="[{ id: 'relatorios', label: 'Relatórios' }, { id: 'conferencia', label: 'Conferência mensal' }]" />
  <ReportsPage v-if="tab === 'relatorios'" /><ReconciliationListPage v-else />
</template>
