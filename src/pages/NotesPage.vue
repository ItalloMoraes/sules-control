<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { supabase, fail } from '@/services/supabase'
import { notify, run } from '@/composables/useToast'
import PageHeader from '@/components/PageHeader.vue'
import ModalBox from '@/components/ModalBox.vue'

type Note = { id: string; title: string; body: string; pinned: boolean; updated_at: string }
const notes = ref<Note[]>([]), q = ref(''), modal = ref(false)
const form = reactive({ id: '', title: '', body: '' })
const shown = computed(() => { const t = q.value.trim().toLowerCase()
  return notes.value.filter(n => !t || n.title.toLowerCase().includes(t) || n.body.toLowerCase().includes(t))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updated_at.localeCompare(a.updated_at)) })

async function load() { const { data, error } = await supabase.from('quick_notes').select('*'); fail(error); notes.value = (data ?? []) as Note[] }
function edit(n?: Note) { Object.assign(form, n ? { id: n.id, title: n.title, body: n.body } : { id: '', title: '', body: '' }); modal.value = true }
async function save() {
  const row = { title: form.title.trim(), body: form.body, updated_at: new Date().toISOString() }
  if (!row.title) return
  if (await run(async () => { fail((form.id ? await supabase.from('quick_notes').update(row).eq('id', form.id) : await supabase.from('quick_notes').insert(row)).error); await load() }, 'Nota salva')) modal.value = false
}
const pin = (n: Note) => run(async () => { fail((await supabase.from('quick_notes').update({ pinned: !n.pinned }).eq('id', n.id)).error); await load() }, n.pinned ? 'Desafixada' : 'Fixada')
const del = (n: Note) => confirm(`Excluir "${n.title}"?`) && run(async () => { fail((await supabase.from('quick_notes').delete().eq('id', n.id)).error); await load() }, 'Nota excluída')
async function copy(n: Note) { await navigator.clipboard.writeText(n.body); notify('Mensagem copiada') }
const starters = [
  ['Apresentação', 'Olá, [nome]! Aqui é [seu nome], corretor de seguros da Suhai. Vi que você buscou uma cotação para o seu [veículo]. Posso te passar as opções agora?'],
  ['Retomar contato', 'Oi, [nome], tudo bem? Passando para saber se você conseguiu avaliar a cotação do seu [veículo]. Posso te ajudar com alguma dúvida?'],
  ['Fechamento', '[nome], sua cotação está pronta e dá para emitir hoje. Se quiser, já te envio o link para assinar e deixo seu [veículo] protegido.'],
]
const addStarters = () => run(async () => { fail((await supabase.from('quick_notes').insert(starters.map(([title, body]) => ({ title, body })))).error); await load() }, 'Modelos adicionados')
onMounted(() => load().catch(() => {}))
</script>
<template>
  <PageHeader title="Notas e mensagens" sub="Textos prontos para copiar e mandar ao cliente.">
    <button class="btn btn-primary" @click="edit()">Nova nota</button>
  </PageHeader>
  <input v-model="q" class="input mb-4 max-w-sm" placeholder="Buscar nas notas" aria-label="Buscar nas notas" />
  <div v-if="!notes.length" class="card text-center"><p class="mb-3 text-sm text-mute">Você ainda não tem notas.</p><button class="btn btn-primary" @click="addStarters">Adicionar 3 modelos iniciais</button></div>
  <div class="gap-4 md:columns-2 xl:columns-3">
    <div v-for="n in shown" :key="n.id" v-reveal class="card mb-4 break-inside-avoid">
      <div class="flex items-start justify-between gap-2"><h2 class="font-semibold">{{ n.title }}</h2><span v-if="n.pinned" class="text-xs text-gold">fixada</span></div>
      <p class="mt-1 whitespace-pre-wrap text-sm text-mute">{{ n.body }}</p>
      <div class="mt-3 flex flex-wrap gap-2">
        <button class="btn btn-primary" @click="copy(n)">Copiar</button><button class="btn" @click="edit(n)">Editar</button>
        <button class="btn" @click="pin(n)">{{ n.pinned ? 'Desafixar' : 'Fixar' }}</button><button class="btn btn-danger" @click="del(n)">Excluir</button>
      </div>
    </div>
  </div>
  <ModalBox :open="modal" :title="form.id ? 'Editar nota' : 'Nova nota'" @close="modal = false">
    <label class="label" for="nt">Título</label><input id="nt" v-model="form.title" class="input mb-3" />
    <label class="label" for="nb">Texto</label><textarea id="nb" v-model="form.body" rows="8" class="input mb-3" />
    <button class="btn btn-primary" :disabled="!form.title.trim()" @click="save">Salvar</button>
  </ModalBox>
</template>
