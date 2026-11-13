<script setup lang="ts">
import { computed, reactive, ref, watchEffect } from 'vue'
import { supabase, fail } from '@/services/supabase'
import { useAuth } from '@/stores/auth'
import { useData } from '@/stores/data'
import { useTheme } from '@/composables/useTheme'
import { run } from '@/composables/useToast'
import { nationalHolidayNames } from '@/utils/holidays'
import { dateBR } from '@/utils/format'
import PageHeader from '@/components/PageHeader.vue'
import SegTabs from '@/components/SegTabs.vue'

const data = useData(), auth = useAuth(), { theme } = useTheme()
const tab = ref('perfil')
const THEMES = [['dark', 'Escuro'], ['light', 'Claro']] as const
const f = reactive({ broker_name: '', broker_email: '', broker_percent: 70, suggested_insurer_percent: 20, default_insurer_id: '' as string | null })
watchEffect(() => {
  const s = data.settings
  if (s) Object.assign(f, { broker_name: s.broker_name ?? '', broker_email: s.broker_email ?? '', broker_percent: s.broker_percent, suggested_insurer_percent: s.suggested_insurer_percent ?? 20, default_insurer_id: s.default_insurer_id ?? '' })
})
const uid = async () => (await supabase.auth.getUser()).data.user!.id

async function saveProfile() {
  await run(async () => {
    fail((await supabase.from('settings').update({
      broker_name: f.broker_name, broker_email: f.broker_email.trim() || null, broker_percent: f.broker_percent,
      suggested_insurer_percent: f.suggested_insurer_percent, default_insurer_id: f.default_insurer_id || null, updated_at: new Date().toISOString(),
    }).eq('user_id', await uid())).error)
    await data.refresh()
  }, 'Perfil salvo. Vendas antigas mantêm o percentual com que foram cadastradas.')
}
async function setTheme(t: 'dark' | 'light') {
  theme.value = t
  await supabase.from('settings').update({ theme: t }).eq('user_id', await uid())
}

const newInsurer = ref(''), newProduct = ref(''), newHoliday = ref('')
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
async function removeHoliday(day: string) {
  if (!confirm(`Remover o feriado de ${dateBR(day)}?`)) return
  await run(async () => { fail((await supabase.from('holidays').delete().eq('day', day)).error); await data.refresh() }, 'Feriado removido')
}
const natList = computed(() => Object.entries(nationalHolidayNames(new Date().getFullYear())).sort((a, b) => a[0].localeCompare(b[0])))
const customList = computed(() => [...data.holidays].sort())
</script>
<template>
  <PageHeader title="Configurações" sub="Seu perfil e as preferências do sistema." />
  <SegTabs v-model="tab" :tabs="[{ id: 'perfil', label: 'Perfil do corretor' }, { id: 'geral', label: 'Configurações gerais do app' }]" />

  <div v-if="tab === 'perfil'" class="grid gap-4 lg:grid-cols-2">
    <div v-reveal class="card space-y-3">
      <h2 class="font-bold">Dados do corretor</h2>
      <div><label class="label" for="bn">Nome</label><input id="bn" v-model="f.broker_name" class="input" /></div>
      <div><label class="label" for="bem">E-mail do corretor</label><input id="bem" v-model="f.broker_email" type="email" class="input" /><p class="mt-1 text-xs text-mute">Aparece no cabeçalho dos relatórios em PDF.</p></div>
      <div><span class="label">E-mail de acesso (login)</span><p class="text-sm">{{ auth.session?.user.email }}</p></div>
    </div>
    <div v-reveal class="card space-y-3">
      <h2 class="font-bold">Comissões</h2>
      <div><label class="label" for="bp">Percentual que fica com o corretor (%)</label><MoneyInput id="bp" v-model="f.broker_percent" class="input" /><p class="mt-1 text-xs text-mute">Vale só para as novas vendas. Cada venda guarda o percentual usado no cadastro.</p></div>
      <div><label class="label" for="sp">Percentual sugerido da seguradora (%)</label><MoneyInput id="sp" v-model="f.suggested_insurer_percent" class="input" /></div>
      <div><label class="label">Seguradora padrão</label><USelect v-model="f.default_insurer_id" class="input"><option v-for="i in data.insurers" :key="i.id" :value="i.id">{{ i.name }}</option></USelect></div>
    </div>
    <div class="flex justify-end lg:col-span-2"><button class="btn btn-primary" @click="saveProfile">Salvar perfil</button></div>
  </div>

  <div v-else class="grid gap-4 lg:grid-cols-2">
    <div v-reveal class="card">
      <h2 class="mb-2 font-bold">Aparência</h2>
      <p class="mb-3 text-sm text-mute">O tema escolhido fica salvo neste navegador e na sua conta.</p>
      <div class="inline-flex rounded-full bg-raise p-1"><button v-for="[id, label] in THEMES" :key="id" class="rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
        :class="theme === id ? 'bg-panel text-text shadow-sm' : 'text-mute hover:text-text'" @click="setTheme(id)">{{ label }}</button></div>
    </div>
    <div v-reveal class="card"><h2 class="mb-2 font-bold">Avisos do sino</h2>
      <ul class="list-disc space-y-1 pl-5 text-sm text-mute">
        <li>Apólice pendente: aviso a cada 6 horas, só das 8h às 17h, de segunda a sexta e sem feriados.</li>
        <li>Se a hora do aviso cair fora desse horário, ele sai às 8h30 do próximo dia útil.</li>
        <li>Agendamentos: aviso às 8h30 do dia marcado.</li>
        <li>Você pode excluir os avisos no próprio sino.</li>
      </ul></div>
    <div v-reveal class="card"><h2 class="mb-2 font-bold">Dados e privacidade</h2>
      <ul class="space-y-1.5 text-sm">
        <li><router-link to="/relatorios" class="text-gold hover:underline">Backup completo dos seus dados (Relatórios)</router-link></li>
        <li><router-link to="/privacidade" class="text-gold hover:underline">Política de Privacidade</router-link></li>
        <li><router-link to="/termos" class="text-gold hover:underline">Termos de Serviço</router-link></li>
        <li><router-link to="/cookies" class="text-gold hover:underline">Aviso de cookies</router-link></li>
        <li><router-link to="/creditos" class="text-gold hover:underline">Créditos e licenças</router-link></li>
      </ul></div>
    <div v-reveal class="card"><h2 class="mb-2 font-bold">Seguradoras</h2>
      <ul class="mb-2 text-sm"><li v-for="i in data.insurers" :key="i.id" class="flex items-center justify-between border-b border-line/60 py-1.5"><span>{{ i.name }} <span v-if="i.is_default" class="text-gold">(padrão)</span></span><button v-if="!i.is_default" class="btn btn-danger" @click="remove('insurers', i.id, i.name)">Apagar</button></li></ul>
      <div class="flex gap-2"><input v-model="newInsurer" class="input" placeholder="Nova seguradora" aria-label="Nova seguradora" /><button class="btn" @click="add('insurers', newInsurer, () => (newInsurer = ''))">Adicionar</button></div></div>
    <div v-reveal class="card"><h2 class="mb-2 font-bold">Produtos</h2>
      <ul class="mb-2 text-sm"><li v-for="p in data.products" :key="p.id" class="flex items-center justify-between border-b border-line/60 py-1.5"><span>{{ p.name }}</span><button class="btn btn-danger" @click="remove('products', p.id, p.name)">Apagar</button></li></ul>
      <div class="flex gap-2"><input v-model="newProduct" class="input" placeholder="Novo produto" aria-label="Novo produto" /><button class="btn" @click="add('products', newProduct, () => (newProduct = ''))">Adicionar</button></div></div>
    <div v-reveal class="card lg:col-span-2"><h2 class="mb-1 font-bold">Feriados</h2>
      <p class="mb-3 text-sm text-mute">Os feriados nacionais entram sozinhos na projeção e no calendário. Cadastre aqui só os que forem extras (municipais ou pontos facultativos que você não trabalha).</p>
      <div class="grid gap-6 md:grid-cols-2">
        <div><h3 class="mb-1 text-sm font-semibold">Nacionais de {{ new Date().getFullYear() }}</h3>
          <ul class="space-y-1 text-sm"><li v-for="[d, n] in natList" :key="d" class="flex justify-between gap-2"><span class="text-mute">{{ dateBR(d) }}</span><span class="truncate">{{ n }}</span></li></ul></div>
        <div><h3 class="mb-1 text-sm font-semibold">Cadastrados por você</h3>
          <ul class="mb-2 space-y-1 text-sm"><li v-for="d in customList" :key="d" class="flex items-center justify-between"><span>{{ dateBR(d) }}</span><button class="btn btn-danger" @click="removeHoliday(d)">Remover</button></li>
            <li v-if="!customList.length" class="text-mute">Nenhum.</li></ul>
          <div class="flex gap-2"><UDate v-model="newHoliday" class="input" /><button class="btn" @click="addHoliday">Adicionar</button></div></div>
      </div></div>
  </div>
</template>
