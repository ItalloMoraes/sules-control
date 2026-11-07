<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase, fail } from '@/services/supabase'
import { useData } from '@/stores/data'
import { run } from '@/composables/useToast'
import { brl, dateBR } from '@/utils/format'
import PageHeader from '@/components/PageHeader.vue'
import ModalBox from '@/components/ModalBox.vue'
import StatusBadge from '@/components/StatusBadge.vue'

const data = useData(), router = useRouter()
const q = ref(''), showArchived = ref(false), modal = ref(false), detail = ref<string | null>(null)
const form = reactive({ id: '', full_name: '', cpf: '', phone: '', email: '', notes: '' })

const list = computed(() => {
  const t = q.value.trim().toLowerCase(), d = q.value.replace(/\D/g, '')
  return data.clients.filter(c => (showArchived.value || !c.archived_at) &&
    (!t || c.full_name.toLowerCase().includes(t) || (d && ((c.cpf ?? '').replace(/\D/g, '').includes(d) || (c.phone ?? '').replace(/\D/g, '').includes(d)))))
})
const sel = computed(() => data.clients.find(c => c.id === detail.value))
const selSales = computed(() => data.sales.filter(s => s.client_id === detail.value))
const selCancs = computed(() => data.cancellations.filter(c => selSales.value.some(s => s.id === c.sale_id)))
const selReceived = computed(() => selSales.value.reduce((a, s) => a + (data.receivedBySale.get(s.id) ?? 0), 0))

function edit(c?: typeof data.clients[number]) {
  Object.assign(form, c ? { id: c.id, full_name: c.full_name, cpf: c.cpf ?? '', phone: c.phone ?? '', email: c.email ?? '', notes: c.notes ?? '' }
    : { id: '', full_name: '', cpf: '', phone: '', email: '', notes: '' })
  modal.value = true
}
async function save() {
  const row = { full_name: form.full_name.trim(), cpf: form.cpf || null, phone: form.phone || null, email: form.email || null, notes: form.notes || null }
  if (!row.full_name) return
  if (await run(async () => {
    fail((form.id ? await supabase.from('clients').update(row).eq('id', form.id) : await supabase.from('clients').insert(row)).error)
    await data.refresh()
  }, 'Cliente salvo')) modal.value = false
}
async function toggleArchive(id: string, archived: boolean) {
  await run(async () => {
    fail((await supabase.from('clients').update({ archived_at: archived ? null : new Date().toISOString() }).eq('id', id)).error)
    await data.refresh()
  }, archived ? 'Cliente reativado' : 'Cliente arquivado (histórico preservado)')
}
</script>
<template>
  <PageHeader title="Clientes" sub="Base centralizada. Clientes com vendas são arquivados, nunca excluídos.">
    <button class="btn btn-primary" @click="edit()">Novo cliente</button>
  </PageHeader>
  <div class="mb-3 flex flex-wrap gap-3">
    <input v-model="q" class="input max-w-sm" placeholder="Buscar por nome, CPF ou telefone" aria-label="Buscar clientes" />
    <label class="flex items-center gap-2 text-sm text-mute"><input v-model="showArchived" type="checkbox" /> Mostrar arquivados</label>
  </div>
  <div class="card overflow-x-auto p-0">
    <table class="tbl">
      <thead><tr><th>Nome</th><th>Telefone</th><th>E-mail</th><th>Vendas</th><th>Cadastro</th><th></th></tr></thead>
      <tbody>
        <tr v-for="c in list" :key="c.id" :class="{ 'opacity-60': c.archived_at }">
          <td><button class="text-left font-medium hover:text-gold" @click="detail = c.id">{{ c.full_name }}</button>
            <span v-if="c.archived_at" class="ml-2 text-xs text-mute">arquivado</span></td>
          <td>{{ c.phone ?? '—' }}</td><td>{{ c.email ?? '—' }}</td>
          <td class="num">{{ data.sales.filter(s => s.client_id === c.id).length }}</td>
          <td>{{ dateBR(c.created_at) }}</td>
          <td class="whitespace-nowrap text-right">
            <button class="btn" @click="edit(c)">Editar</button>
            <button class="btn ml-1" @click="toggleArchive(c.id, !!c.archived_at)">{{ c.archived_at ? 'Reativar' : 'Arquivar' }}</button>
          </td>
        </tr>
        <tr v-if="!list.length"><td colspan="6" class="py-6 text-center text-mute">Nenhum cliente encontrado. Cadastre o primeiro em “Novo cliente”.</td></tr>
      </tbody>
    </table>
  </div>

  <ModalBox :open="modal" :title="form.id ? 'Editar cliente' : 'Novo cliente'" @close="modal = false">
    <div class="grid gap-3 sm:grid-cols-2">
      <div class="sm:col-span-2"><label class="label">Nome completo</label><input v-model="form.full_name" class="input" /></div>
      <div><label class="label">CPF (quando necessário)</label><input v-model="form.cpf" class="input" /></div>
      <div><label class="label">Telefone</label><input v-model="form.phone" class="input" /></div>
      <div class="sm:col-span-2"><label class="label">E-mail</label><input v-model="form.email" type="email" class="input" /></div>
      <div class="sm:col-span-2"><label class="label">Observações</label><textarea v-model="form.notes" class="input" rows="3" /></div>
    </div>
    <div class="mt-4 flex justify-end gap-2"><button class="btn" @click="modal = false">Cancelar</button><button class="btn btn-primary" @click="save">Salvar cliente</button></div>
  </ModalBox>

  <ModalBox :open="!!sel" :title="sel?.full_name ?? ''" @close="detail = null">
    <p class="mb-3 text-sm text-mute">{{ sel?.notes || 'Sem observações.' }}</p>
    <div class="mb-3 grid grid-cols-3 gap-2 text-sm">
      <div class="card"><div class="text-xs text-mute">Vendas</div><div class="num font-bold">{{ selSales.length }}</div></div>
      <div class="card"><div class="text-xs text-mute">Comissão recebida</div><div class="num font-bold">{{ brl(selReceived) }}</div></div>
      <div class="card"><div class="text-xs text-mute">Cancelamentos</div><div class="num font-bold">{{ selCancs.length }}</div></div>
    </div>
    <table class="tbl"><thead><tr><th>Data</th><th>Produto</th><th>Prêmio</th><th>Comissão líq.</th><th>Status</th></tr></thead>
      <tbody><tr v-for="s in selSales" :key="s.id" class="cursor-pointer" @click="router.push('/vendas/' + s.id)">
        <td>{{ dateBR(s.sale_date) }}</td><td>{{ s.products?.name }}</td><td class="num">{{ brl(s.premium) }}</td>
        <td class="num">{{ brl(s.net_commission) }}</td><td><StatusBadge :value="s.status" /></td></tr></tbody></table>
  </ModalBox>
</template>
