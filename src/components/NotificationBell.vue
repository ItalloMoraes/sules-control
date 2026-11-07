<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/services/supabase'

type N = { id: string; sale_id: string | null; message: string; read_at: string | null; created_at: string }
const router = useRouter()
const items = ref<N[]>([]), open = ref(false)
const unread = computed(() => items.value.filter(n => !n.read_at).length)
let timer = 0

async function load() {
  await supabase.rpc('refresh_my_notifications') // gera no máximo 1 aviso a cada 5 h por apólice pendente
  const { data } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(30)
  items.value = (data ?? []) as N[]
}
async function readAll() {
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null)
  await load()
}
async function go(n: N) {
  if (!n.read_at) await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id)
  open.value = false
  if (n.sale_id) router.push(`/vendas/${n.sale_id}`)
  load()
}
const when = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
onMounted(() => { load(); timer = window.setInterval(load, 10 * 60 * 1000) })
onBeforeUnmount(() => clearInterval(timer))
</script>
<template>
  <div class="relative">
    <button class="btn relative !px-3" :aria-label="`Notificações, ${unread} não lidas`" aria-haspopup="true" :aria-expanded="open" @click="open = !open">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
      <span v-if="unread" class="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-neg px-1 text-[11px] font-semibold text-white">{{ unread }}</span>
    </button>
    <Transition name="modal">
      <div v-if="open" class="absolute right-0 z-40 mt-2 w-80 max-w-[85vw]" @keydown.esc="open = false">
        <div class="card !p-0">
          <div class="flex items-center justify-between border-b border-line px-4 py-2.5">
            <span class="text-sm font-semibold">Notificações</span>
            <button v-if="unread" class="text-xs text-gold hover:underline" @click="readAll">Marcar todas como lidas</button>
          </div>
          <ul class="max-h-80 overflow-y-auto">
            <li v-for="n in items" :key="n.id">
              <button class="block w-full border-b border-line/60 px-4 py-2.5 text-left hover:bg-raise" @click="go(n)">
                <span class="flex items-start gap-2">
                  <span class="mt-1.5 h-2 w-2 shrink-0 rounded-full" :class="n.read_at ? 'bg-line' : 'bg-gold'" />
                  <span class="text-sm" :class="n.read_at ? 'text-mute' : ''">{{ n.message }}<span class="block text-xs text-mute">{{ when(n.created_at) }}</span></span>
                </span>
              </button>
            </li>
            <li v-if="!items.length" class="px-4 py-6 text-center text-sm text-mute">Nenhuma apólice pendente no momento.</li>
          </ul>
        </div>
      </div>
    </Transition>
  </div>
</template>
