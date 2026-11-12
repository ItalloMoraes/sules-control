<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SegTabs from '@/components/SegTabs.vue'
import ProjectionsPage from './ProjectionsPage.vue'
import ConversionsPage from './ConversionsPage.vue'
import GoalsPage from './GoalsPage.vue'

const route = useRoute(), router = useRouter()
const tab = computed({
  get: () => (['conversao', 'metas'].includes(route.query.tab as string) ? (route.query.tab as string) : 'projecao'),
  set: (v: string) => { router.replace({ query: v === 'projecao' ? {} : { tab: v } }) },
})
</script>
<template>
  <SegTabs v-model="tab" :tabs="[{ id: 'projecao', label: 'Projeção do mês' }, { id: 'conversao', label: 'Conversão de leads' }, { id: 'metas', label: 'Metas' }]" />
  <ProjectionsPage v-if="tab === 'projecao'" /><ConversionsPage v-else-if="tab === 'conversao'" /><GoalsPage v-else />
</template>
