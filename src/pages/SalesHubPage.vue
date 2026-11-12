<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SegTabs from '@/components/SegTabs.vue'
import SalesPage from './SalesPage.vue'
import CancellationsPage from './CancellationsPage.vue'
import CalendarPage from './CalendarPage.vue'

const route = useRoute(), router = useRouter()
const tab = computed({
  get: () => (['cancelamentos', 'calendario'].includes(route.query.tab as string) ? (route.query.tab as string) : 'vendas'),
  set: (v: string) => { router.replace({ query: v === 'vendas' ? {} : { tab: v } }) },
})
</script>
<template>
  <SegTabs v-model="tab" :tabs="[{ id: 'vendas', label: 'Vendas' }, { id: 'cancelamentos', label: 'Cancelamentos' }, { id: 'calendario', label: 'Calendário' }]" />
  <SalesPage v-if="tab === 'vendas'" /><CancellationsPage v-else-if="tab === 'cancelamentos'" /><CalendarPage v-else />
</template>
