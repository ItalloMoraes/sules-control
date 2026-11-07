<script setup lang="ts">
import { computed, ref } from 'vue'
import { useData } from '@/stores/data'
import { brl, dateBR } from '@/utils/format'
import PageHeader from '@/components/PageHeader.vue'
import StatCard from '@/components/StatCard.vue'
import StatusBadge from '@/components/StatusBadge.vue'

const data = useData()
const q = ref(''), sel = ref<string | null>(null)
const matches = computed(() => { const t = q.value.trim().toLowerCase(); return t ? data.clients.filter(c => c.full_name.toLowerCase().includes(t)).slice(0, 8) : [] })
const all = computed(() => data.clients.filter(c => !c.archived_at).sort((a, b) => a.full_name.localeCompare(b.full_name)).slice(0, 60))
const client = computed(() => data.clients.find(c => c.id === sel.value))
const sales = computed(() => data.sales.filter(s => s.client_id === sel.value).sort((a, b) => b.sale_date.localeCompare(a.sale_date)))
const cancs = computed(() => data.cancellations.filter(c => sales.value.some(s => s.id === c.sale_id)))
const activePremium = computed(() => sales.value.filter(s => s.status !== 'cancelada').reduce((a, s) => a + s.premium, 0))
const received = computed(() => sales.value.reduce((a, s) => a + (data.receivedBySale.get(s.id) ?? 0), 0))
const product = (id: string) => data.products.find(p => p.id === id)?.name ?? '—'
function pick(id: string) { sel.value = id; q.value = '' }
</script>
<template>
  <PageHeader title="Clientes" sub="Busque pelo nome e veja tudo o que já foi vendido, recebido e cancelado. Clientes novos são cadastrados direto na venda." />
  <div class="relative mb-4 max-w-md">
    <input v-model="q" class="input" placeholder="Digite o nome do cliente" aria-label="Buscar cliente" autocomplete="off" />
    <ul v-if="matches.length" class="card absolute z-10 mt-1 w-full !p-1">
      <li v-for="c in matches" :key="c.id"><button class="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-raise" @click="pick(c.id)">{{ c.full_name }}<span v-if="c.archived_at" class="ml-2 text-xs text-mute">arquivado</span></button></li>
    </ul>
  </div>
  <div v-if="!client" v-reveal class="card">
    <h2 class="mb-2 font-bold">Todos os clientes</h2>
    <p v-if="!all.length" class="text-sm text-mute">Ainda não há clientes. Eles são criados ao cadastrar uma venda.</p>
    <ul class="grid gap-1 sm:grid-cols-2 lg:grid-cols-3"><li v-for="c in all" :key="c.id"><button class="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-raise" @click="pick(c.id)">{{ c.full_name }}</button></li></ul>
  </div>
  <template v-else>
    <div v-reveal class="card mb-4">
      <h2 class="text-xl font-semibold">{{ client.full_name }}</h2>
      <p class="text-sm text-mute">{{ [client.phone, client.email].filter(Boolean).join(' · ') || 'Sem contato cadastrado' }}</p>
      <p v-if="client.notes" class="mt-1 text-sm">{{ client.notes }}</p>
      <button class="btn mt-3" @click="sel = null">Voltar à lista</button>
    </div>
    <div class="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard label="Apólices e vendas" :value="String(sales.length)" tone="gold" />
      <StatCard label="Prêmio em vigor" :value="brl(activePremium)" />
      <StatCard label="Comissão recebida" :value="brl(received)" tone="pos" />
      <StatCard label="Cancelamentos" :value="String(cancs.length)" tone="warn" />
    </div>
    <div v-reveal class="card overflow-x-auto p-0">
      <table class="tbl"><thead><tr><th>Data</th><th>Produto</th><th>Veículo</th><th>Proposta / Apólice</th><th>Status</th><th>Prêmio</th><th></th></tr></thead>
        <tbody>
          <tr v-for="s in sales" :key="s.id"><td>{{ dateBR(s.sale_date) }}</td><td>{{ product(s.product_id) }}</td>
            <td>{{ [s.vehicle_description, s.plate].filter(Boolean).join(' · ') || '—' }}</td>
            <td class="num">{{ s.proposal_number ?? '—' }} / {{ s.policy_number ?? '—' }}</td><td><StatusBadge :value="s.status" /></td>
            <td class="num">{{ brl(s.premium) }}</td><td><router-link :to="`/vendas/${s.id}`" class="text-gold hover:underline">Abrir</router-link></td></tr>
          <tr v-if="!sales.length"><td colspan="7" class="py-6 text-center text-mute">Este cliente ainda não tem vendas.</td></tr>
        </tbody></table>
    </div>
  </template>
</template>
