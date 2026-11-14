<script setup lang="ts">
// Vendas por estado: mapa do Brasil + lista de estados com as cidades e a comissão de cada um.
import { computed, ref } from 'vue'
import { useData } from '@/stores/data'
import { brl } from '@/utils/format'
import { round2 } from '@/utils/finance'
import { STATE_NAMES } from '@/services/cep'
import BrazilMap from './BrazilMap.vue'

const props = defineProps<{ sales: { client_id: string; net_commission: number }[] }>()
const data = useData()
const sel = ref('')
const geo = computed(() => {
  const byUf = new Map<string, { count: number; net: number; cities: Map<string, { count: number; net: number }> }>()
  let none = 0
  for (const s of props.sales) {
    const c = data.clients.find(x => x.id === s.client_id)
    if (!c?.state) { none++; continue }
    const e = byUf.get(c.state) ?? { count: 0, net: 0, cities: new Map() }
    e.count++; e.net += s.net_commission
    const k = c.city || 'Cidade não informada', ci = e.cities.get(k) ?? { count: 0, net: 0 }
    ci.count++; ci.net += s.net_commission; e.cities.set(k, ci); byUf.set(c.state, e)
  }
  const rows = [...byUf].map(([uf, e]) => ({ uf, count: e.count, net: round2(e.net), cities: [...e.cities].map(([name, v]) => ({ name, count: v.count, net: round2(v.net) })).sort((x, y) => y.net - x.net) }))
    .sort((x, y) => y.count - x.count || y.net - x.net)
  return { rows, none }
})
const counts = computed(() => Object.fromEntries(geo.value.rows.map(r => [r.uf, r.count])))
const net = computed(() => Object.fromEntries(geo.value.rows.map(r => [r.uf, r.net])))
</script>
<template>
  <div v-reveal class="card">
    <div class="mb-3 flex flex-wrap items-baseline justify-between gap-2"><h2 class="font-bold">Vendas por estado</h2><p class="text-xs text-mute">Quanto mais verde, mais vendas no período. Clique num estado para ver as cidades.</p></div>
    <div class="grid gap-6 lg:grid-cols-2">
      <BrazilMap :counts="counts" :commission="net" v-model="sel" />
      <div class="max-h-[26rem] overflow-y-auto pr-1">
        <ul v-if="geo.rows.length" class="divide-y divide-line/60">
          <li v-for="r in geo.rows" :key="r.uf">
            <button type="button" class="flex w-full items-center gap-3 py-2 text-left hover:bg-raise/60" :aria-expanded="sel === r.uf" @click="sel = sel === r.uf ? '' : r.uf">
              <span class="w-8 font-semibold">{{ r.uf }}</span><span class="flex-1 truncate text-sm">{{ STATE_NAMES[r.uf] }}</span>
              <span class="num text-sm">{{ r.count }} venda(s)</span><span class="num w-28 text-right text-sm font-semibold text-gold">{{ brl(r.net) }}</span>
            </button>
            <ul v-if="sel === r.uf" class="mb-2 ml-8 space-y-1 border-l border-line pl-3 text-sm">
              <li v-for="c in r.cities" :key="c.name" class="flex items-center justify-between gap-2"><span class="truncate">{{ c.name }}</span><span class="num shrink-0 text-mute">{{ c.count }} · <b class="text-gold">{{ brl(c.net) }}</b></span></li>
            </ul>
          </li>
        </ul>
        <p v-else class="text-sm text-mute">Cadastre o CEP dos clientes para ver o mapa.</p>
        <p v-if="geo.none" class="mt-2 text-xs text-mute">{{ geo.none }} venda(s) de clientes sem CEP não aparecem aqui.</p>
      </div>
    </div>
  </div>
</template>
