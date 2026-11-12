<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SegTabs from '@/components/SegTabs.vue'
import CommissionsPage from './CommissionsPage.vue'
import ComparisonsPage from './ComparisonsPage.vue'

const route = useRoute(), router = useRouter()
const tab = computed({
  get: () => (route.query.tab === 'comparativos' ? 'comparativos' : 'comissoes'),
  set: (v: string) => { router.replace({ query: v === 'comparativos' ? { tab: v } : {} }) },
})
</script>
<template>
  <SegTabs v-model="tab" :tabs="[{ id: 'comissoes', label: 'Comissões' }, { id: 'comparativos', label: 'Comparativos' }]" />
  <CommissionsPage v-if="tab === 'comissoes'" /><ComparisonsPage v-else />
</template>
