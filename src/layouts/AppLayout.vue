<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/stores/auth'
import { useData } from '@/stores/data'
import { useTheme } from '@/composables/useTheme'
import { toasts, run } from '@/composables/useToast'
import NotificationBell from '@/components/NotificationBell.vue'
import ChatWidget from '@/components/ChatWidget.vue'

const auth = useAuth(), data = useData(), router = useRouter()
const { theme, toggle } = useTheme()
const open = ref(false)
const bootName = ref('')
const nav = [
  ['/', 'Dashboard'], ['/vendas', 'Vendas'], ['/clientes', 'Clientes'], ['/comissoes', 'Comissões'],
  ['/cancelamentos', 'Cancelamentos'], ['/conferencia', 'Conferência mensal'], ['/calendario', 'Calendário'],
  ['/historico', 'Histórico do cliente'], ['/conversao', 'Conversão de leads'], ['/notas', 'Notas e mensagens'],
  ['/metas', 'Metas'], ['/projecoes', 'Projeções'], ['/comparativos', 'Comparativos'],
  ['/relatorios', 'Relatórios'], ['/configuracoes', 'Configurações'],
]
onMounted(() => run(() => data.refresh(), 'Dados carregados').catch(() => {}))
async function out() { await auth.logout(); router.push('/login') }
</script>

<template>
  <div class="min-h-screen bg-ink p-3 md:flex md:gap-3">
    <aside class="bg-panel mb-3 flex-col overflow-y-auto rounded-3xl p-2 shadow-[0_10px_28px_-16px_rgb(0_0_0/.18)] md:sticky md:top-3 md:mb-0 md:flex md:h-[calc(100vh-1.5rem)] md:w-60 md:shrink-0"
           :class="open ? 'flex' : 'hidden'">
      <div class="flex items-center gap-2 px-3 py-3 font-display text-lg font-semibold tracking-tight">
        <img src="/mascote.png" alt="" class="h-8 w-8 object-contain" />Sules Control
      </div>
      <nav class="flex flex-col gap-0.5 px-1 pb-3" aria-label="Principal">
        <router-link v-for="[to, label] in nav" :key="to" :to="to" @click="open = false"
          class="rounded-xl px-3 py-2 text-sm text-mute transition-colors hover:bg-raise hover:text-text"
          active-class="!bg-gold/10 !text-gold font-semibold" exact-active-class="!bg-gold/10 !text-gold font-semibold">{{ label }}</router-link>
      </nav>
      <div class="mt-auto rounded-2xl bg-gold p-3 text-center text-white dark:text-[#04210f]">
        <img src="/mascote.png" alt="Mascote Suhai" class="mx-auto h-24 object-contain" />
        <p class="text-sm font-semibold">Bora fechar mais uma</p>
        <p class="text-xs opacity-80">Acompanhe sua meta do mês em Metas.</p>
      </div>
    </aside>
    <div class="min-w-0 flex-1">
      <header class="bg-panel flex items-center justify-between gap-2 rounded-3xl px-4 py-2.5 shadow-[0_10px_28px_-16px_rgb(0_0_0/.18)]">
        <div class="flex items-center gap-3">
          <button class="btn md:hidden" @click="open = !open" aria-label="Menu">☰</button>
          <span class="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-gold/10"><img src="/mascote.png" alt="" class="h-9 w-9 object-contain" /></span>
          <div class="leading-tight"><div class="text-sm font-semibold">{{ data.settings?.broker_name ?? auth.session?.user.email }}</div><div class="text-xs text-mute">Seguro auto · Suhai</div></div>
        </div>
        <div class="flex items-center gap-2">
          <NotificationBell />
          <button class="btn" @click="toggle">{{ theme === 'dark' ? 'Claro' : 'Escuro' }}</button>
          <button class="btn" @click="out">Sair</button>
        </div>
      </header>
      <main class="mx-auto max-w-7xl py-4">
        <div v-if="data.needsBootstrap && data.loaded" class="card mx-auto mt-10 max-w-md">
          <h2 class="text-lg font-bold">Configurar sua conta</h2>
          <p class="mb-3 text-sm text-mute">Cria a Suhai como seguradora padrão, os produtos iniciais e as configurações.</p>
          <label class="label" for="bn">Seu nome</label>
          <input id="bn" v-model="bootName" class="input mb-3" placeholder="Nome do corretor" />
          <button class="btn btn-primary" :disabled="!bootName.trim()"
                  @click="run(() => data.bootstrap(bootName.trim()), 'Conta configurada')">Criar configuração inicial</button>
        </div>
        <router-view v-else v-slot="{ Component }"><transition name="page" mode="out-in"><component :is="Component" /></transition></router-view>
      </main>
    </div>
    <ChatWidget />
    <div class="fixed bottom-4 left-4 z-50 flex flex-col gap-2" aria-live="polite">
      <div v-for="t in toasts" :key="t.id" class="card max-w-sm text-sm"
           :class="t.kind === 'err' ? 'border-neg text-neg' : 'border-pos'">{{ t.msg }}</div>
    </div>
  </div>
</template>
