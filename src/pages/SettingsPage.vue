<script setup lang="ts">
import { reactive, ref, watchEffect } from 'vue'
import { supabase, fail } from '@/services/supabase'
import { useData } from '@/stores/data'
import { useTheme } from '@/composables/useTheme'
import { run } from '@/composables/useToast'
import PageHeader from '@/components/PageHeader.vue'

const data = useData(); const { theme, toggle } = useTheme()
const f = reactive({ broker_name: '', broker_email: '', broker_percent: 70, suggested_insurer_percent: 20, default_insurer_id: '' as string | null, goal_net_basis: 'generated' })
watchEffect(() => {
  const s = data.settings
  if (s) Object.assign(f, { broker_name: s.broker_name ?? '', broker_email: s.broker_email ?? '', broker_percent: s.broker_percent, suggested_insurer_percent: s.suggested_insurer_percent ?? 20, default_insurer_id: s.default_insurer_id, goal_net_basis: s.goal_net_basis })
})
const newInsurer = ref(''), newProduct = ref(''), newHoliday = ref('')

async function save() {
  await run(async () => {
    const { error } = await supabase.from('settings').update({
      broker_name: f.broker_name, broker_email: f.broker_email.trim() || null, broker_percent: f.broker_percent, suggested_insurer_percent: f.suggested_insurer_percent,
      default_insurer_id: f.default_insurer_id || null, goal_net_basis: f.goal_net_basis, theme: theme.value, updated_at: new Date().toISOString(),
    }).eq('user_id', (await supabase.auth.getUser()).data.user!.id)
    fail(error); await data.refresh()
  }, 'Configurações salvas. Vendas antigas mantêm o percentual com que foram cadastradas.')
}
async function add(table: 'insurers' | 'products', name: string, clear: () => void) {
  if (!name.trim()) return
  if (await run(async () => { fail((await supabase.from(table).insert({ name: name.trim() })).error); await data.refresh() }, 'Cadastrado')) clear()
}
async function remove(table: 'insurers' | 'products', id: string, name: string) {
  const used = data.sales.some(s => (table === 'insurers' ? s.insurer_id : s.product_id) === id)
  if (used) { alert(`"${name}" já tem vendas cadastradas e por isso não pode ser apagada.`); return }
  if (!confirm(`Apagar "${name}"?`)) return
  await run(async () => { fail((await supabase.from(table).delete().eq('id', id)).error); await data.refresh() }, 'Apagado')
}
async function addHoliday() {
  if (!newHoliday.value) return
  if (await run(async () => { fail((await supabase.from('holidays').insert({ day: newHoliday.value })).error); await data.refresh() }, 'Feriado adicionado')) newHoliday.value = ''
}
</script>
<template>
  <PageHeader title="Configurações" />
  <div class="grid gap-4 lg:grid-cols-2">
    <div class="card space-y-3">
      <h2 class="font-bold">Corretor e comissões</h2>
      <div><label class="label">Nome do corretor</label><input v-model="f.broker_name" class="input" /></div>
      <div><label class="label" for="bem">E-mail do corretor</label><input id="bem" v-model="f.broker_email" type="email" class="input" /><p class="mt-1 text-xs text-mute">Aparece no cabeçalho dos relatórios em PDF.</p></div>
      <div>
        <label class="label">Percentual que fica com o corretor (%)</label>
        <input v-model.number="f.broker_percent" type="number" step="0.01" min="0" max="100" class="input" />
        <p class="mt-1 text-xs text-mute">Aplicado só às novas vendas. Cada venda guarda o percentual usado no cadastro.</p>
      </div>
      <div><label class="label">Percentual sugerido da seguradora (%)</label><input v-model.number="f.suggested_insurer_percent" type="number" step="0.01" class="input" /></div>
      <div><label class="label">Seguradora padrão</label>
        <USelect v-model="f.default_insurer_id" class="input"><option v-for="i in data.insurers" :key="i.id" :value="i.id">{{ i.name }}</option></USelect></div>
      <div><label class="label">Meta de comissão líquida mede</label>
        <USelect v-model="f.goal_net_basis" class="input"><option value="generated">Comissão originalmente gerada</option><option value="after_reversals">Resultado após estornos efetivados</option></USelect></div>
      <div class="flex gap-2"><button class="btn btn-primary" @click="save">Salvar</button><button class="btn" @click="toggle">Alternar tema ({{ theme === 'dark' ? 'escuro' : 'claro' }})</button></div>
    </div>
    <div class="space-y-4">
      <div class="card"><h2 class="mb-2 font-bold">Seguradoras</h2>
        <ul class="mb-2 text-sm"><li v-for="i in data.insurers" :key="i.id" class="flex items-center justify-between border-b border-line/60 py-1.5"><span>{{ i.name }} <span v-if="i.is_default" class="text-gold">(padrão)</span></span><button v-if="!i.is_default" class="btn btn-danger" @click="remove('insurers', i.id, i.name)">Apagar</button></li></ul>
        <div class="flex gap-2"><input v-model="newInsurer" class="input" placeholder="Nova seguradora" /><button class="btn" @click="add('insurers', newInsurer, () => (newInsurer = ''))">Adicionar</button></div></div>
      <div class="card"><h2 class="mb-2 font-bold">Produtos</h2>
        <ul class="mb-2 text-sm"><li v-for="p in data.products" :key="p.id" class="flex items-center justify-between border-b border-line/60 py-1.5"><span>{{ p.name }}</span><button class="btn btn-danger" @click="remove('products', p.id, p.name)">Apagar</button></li></ul>
        <div class="flex gap-2"><input v-model="newProduct" class="input" placeholder="Novo produto" /><button class="btn" @click="add('products', newProduct, () => (newProduct = ''))">Adicionar</button></div></div>
      <div class="card"><h2 class="mb-2 font-bold">Feriados (afetam dias úteis nas projeções)</h2>
        <p class="mb-2 text-sm text-mute">{{ data.holidays.length }} cadastrados. Os feriados nacionais já entram sozinhos na projeção.</p>
        <div class="flex gap-2"><UDate v-model="newHoliday" class="input" /><button class="btn" @click="addHoliday">Adicionar</button></div></div>
    </div>
  </div>
</template>
