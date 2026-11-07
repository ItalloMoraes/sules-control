<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { supabase } from '@/services/supabase'
import { notify } from '@/composables/useToast'

type M = { role: 'user' | 'assistant'; content: string }
const open = ref(false), msgs = ref<M[]>([]), text = ref(''), busy = ref(false), box = ref<HTMLElement>()
const chips = ['Quebrar objeção: achei caro', 'Mensagem de apresentação', 'Cliente sumiu, como retomar?']
const down = () => nextTick(() => box.value?.scrollTo({ top: box.value.scrollHeight }))

async function send(t = text.value) {
  t = t.trim()
  if (!t || busy.value) return
  msgs.value.push({ role: 'user', content: t }); text.value = ''; busy.value = true; down()
  const { data, error } = await supabase.functions.invoke('chat', { body: { messages: msgs.value } })
  msgs.value.push({ role: 'assistant', content: error || !data?.reply ? 'Não consegui responder agora. Confira a configuração do chat no README.' : data.reply })
  busy.value = false; down()
}
async function copy(t: string) { await navigator.clipboard.writeText(t); notify('Mensagem copiada') }
</script>
<template>
  <div class="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
    <Transition name="modal">
      <div v-if="open" class="w-80 max-w-[90vw]" @keydown.esc="open = false">
        <div class="card flex h-[26rem] flex-col !p-0">
          <div class="flex items-center justify-between border-b border-line px-4 py-2.5">
            <span class="text-sm font-semibold">Assistente rápido</span>
            <button class="text-mute hover:text-text" aria-label="Fechar chat" @click="open = false">✕</button>
          </div>
          <div ref="box" class="flex-1 space-y-2 overflow-y-auto p-3 text-sm" aria-live="polite">
            <div v-if="!msgs.length" class="space-y-2">
              <p class="text-mute">Peça um texto curto para o cliente.</p>
              <button v-for="c in chips" :key="c" class="btn block !rounded-xl text-left" @click="send(c)">{{ c }}</button>
            </div>
            <div v-for="(m, i) in msgs" :key="i" :class="m.role === 'user' ? 'text-right' : ''">
              <div class="inline-block max-w-[90%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-left" :class="m.role === 'user' ? 'bg-gold text-white dark:text-[#04210f]' : 'bg-raise'">{{ m.content }}</div>
              <button v-if="m.role === 'assistant'" class="mt-0.5 block text-xs text-gold hover:underline" @click="copy(m.content)">Copiar</button>
            </div>
            <p v-if="busy" class="text-mute">Escrevendo…</p>
          </div>
          <form class="flex gap-2 border-t border-line p-2" @submit.prevent="send()">
            <input v-model="text" class="input" placeholder="Escreva aqui" aria-label="Mensagem" />
            <button class="btn btn-primary" :disabled="busy || !text.trim()">Enviar</button>
          </form>
        </div>
      </div>
    </Transition>
    <button class="btn btn-primary !h-12 !w-12 !rounded-full !p-0 shadow-lg" aria-label="Abrir assistente" @click="open = !open">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L3 20l1-4.6A8 8 0 1 1 21 12z"/></svg>
    </button>
  </div>
</template>
