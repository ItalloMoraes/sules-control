<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '@/stores/auth'
import { useData } from '@/stores/data'
import { useTheme } from '@/composables/useTheme'
import { toasts, run } from '@/composables/useToast'
import AppIcon from '@/components/AppIcon.vue'
import AmbientParticles from '@/components/AmbientParticles.vue'
import { SUHAI_SITE } from '@/config'
import { CONTATO } from '@/contact'
import NotificationBell from '@/components/NotificationBell.vue'
import ChatWidget from '@/components/ChatWidget.vue'

const auth = useAuth(), data = useData(), router = useRouter()
const { theme, toggle } = useTheme()
const open = ref(false)
const bootName = ref(''), bootEmail = ref(auth.session?.user.email ?? '')
const route = useRoute()
const collapsed = ref(localStorage.getItem('sc-nav') === '1')
function toggleNav() { collapsed.value = !collapsed.value; localStorage.setItem('sc-nav', collapsed.value ? '1' : '0') }
const nav = [
  { to: '/', label: 'Dashboard', icon: 'dashboard' }, { to: '/vendas', label: 'Vendas e cancelamentos', icon: 'sales' },
  { to: '/comissoes', label: 'Comissões', icon: 'commissions' },  { to: '/calendario', label: 'Calendário', icon: 'calendar' },
  { to: '/notas', label: 'Notas e mensagens', icon: 'notes' }, { to: '/metas', label: 'Metas e conversão', icon: 'goals' },
  { to: '/projecoes', label: 'Projeções e comparativos', icon: 'forecast' }, { to: '/relatorios', label: 'Relatórios e conferência', icon: 'reports' },
]
const isActive = (to: string) => (to === '/' ? route.path === '/' : route.path.startsWith(to) || (to === '/relatorios' && route.path.startsWith('/conferencia')))
onMounted(() => run(() => data.refresh(), 'Dados carregados').catch(() => {}))
async function out() { await auth.logout(); router.push('/login') }
</script>

<template>
  <div class="relative isolate min-h-screen bg-ink p-3 md:flex md:gap-3">
    <div class="pointer-events-none fixed inset-0 -z-10" aria-hidden="true"><AmbientParticles :links="130" :max-count="55" :gravity="-4" :wind="1" :sway="10" :max-dpr="1.5" /></div>
    <aside class="bg-panel mb-3 flex-col overflow-y-auto rounded-3xl p-2 shadow-[0_10px_28px_-16px_rgb(0_0_0/.18)] transition-[width] duration-200 md:sticky md:top-3 md:mb-0 md:flex md:h-[calc(100vh-1.5rem)] md:shrink-0"
           :class="[open ? 'flex' : 'hidden', collapsed ? 'md:w-[76px]' : 'md:w-60']">
      <router-link to="/" class="flex items-center justify-center px-2 py-4 font-display text-xl font-bold tracking-tight" aria-label="Sules Control">
        <span class="text-gold">Su</span><span :class="collapsed ? 'md:hidden' : ''">les Control</span>
      </router-link>
      <nav class="flex flex-col gap-0.5 px-1 pb-3" aria-label="Principal">
        <router-link v-for="n in nav" :key="n.to" :to="n.to" :title="n.label" class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors"
          :class="[isActive(n.to) ? 'bg-gold/10 font-semibold text-gold' : 'text-mute hover:bg-raise hover:text-text', collapsed ? 'md:justify-center md:px-0' : '']" @click="open = false">
          <AppIcon :name="n.icon" class="shrink-0" /><span class="truncate" :class="collapsed ? 'md:hidden' : ''">{{ n.label }}</span>
        </router-link>
      </nav>
      <div class="mt-auto border-t border-line/70 px-1 pt-2">
        <router-link to="/configuracoes" title="Configurações" class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors"
          :class="[isActive('/configuracoes') ? 'bg-gold/10 font-semibold text-gold' : 'text-mute hover:bg-raise hover:text-text', collapsed ? 'md:justify-center md:px-0' : '']" @click="open = false">
          <AppIcon name="settings" class="shrink-0" /><span :class="collapsed ? 'md:hidden' : ''">Configurações</span>
        </router-link>
      </div>
      <component :is="SUHAI_SITE ? 'a' : 'div'" :href="SUHAI_SITE || undefined" target="_blank" rel="noopener noreferrer" :title="SUHAI_SITE ? 'Site da Suhai' : undefined"
        class="mt-2 block rounded-2xl bg-gold p-3 text-center text-white dark:text-[#04210f]" :class="collapsed ? 'md:p-1.5' : ''">
        <img src="/mascote.png" alt="Mascote Suhai" class="mx-auto object-contain" :class="collapsed ? 'h-28 md:h-14' : 'h-28'" />
        <div :class="collapsed ? 'md:hidden' : ''"><p class="text-sm font-semibold">Bora fechar mais uma</p><p class="text-xs opacity-80">Acompanhe sua meta do mês em Metas.</p></div>
      </component>
    </aside>
    <div class="min-w-0 flex-1">
      <header class="bg-panel flex items-center justify-between gap-2 rounded-3xl px-4 py-2.5 shadow-[0_10px_28px_-16px_rgb(0_0_0/.18)]">
        <div class="flex items-center gap-3">
          <button class="btn !px-2.5 md:hidden" aria-label="Menu" @click="open = !open"><AppIcon name="panel" /></button>
          <button class="btn hidden !px-2.5 md:inline-flex" :aria-label="collapsed ? 'Expandir menu' : 'Recolher menu'" :title="collapsed ? 'Expandir menu' : 'Recolher menu'" @click="toggleNav"><AppIcon name="panel" /></button>
          <span class="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-gold/10"><img src="/mascote.png" alt="" class="h-11 w-11 object-contain" /></span>
          <div class="leading-tight"><div class="text-sm font-semibold">{{ data.settings?.broker_name ?? auth.session?.user.email }}</div><div class="text-xs text-mute">Seguro auto · Suhai</div></div>
        </div>
        <div class="flex items-center gap-2">
          <NotificationBell />
          <button class="btn !px-2.5" :aria-label="theme === 'dark' ? 'Tema claro' : 'Tema escuro'" :title="theme === 'dark' ? 'Tema claro' : 'Tema escuro'" @click="toggle"><AppIcon :name="theme === 'dark' ? 'sun' : 'moon'" /></button>
          <button class="btn !px-2.5" aria-label="Sair" title="Sair" @click="out"><AppIcon name="door" /></button>
        </div>
      </header>
      <main id="conteudo" tabindex="-1" class="mx-auto max-w-7xl py-4">
        <div v-if="data.needsBootstrap && data.loaded" class="card mx-auto mt-10 max-w-md">
          <h2 class="text-lg font-bold">Configurar sua conta</h2>
          <p class="mb-3 text-sm text-mute">Cria a Suhai como seguradora padrão, os produtos iniciais e as configurações.</p>
          <label class="label" for="bn">Seu nome</label>
          <input id="bn" v-model="bootName" class="input mb-3" placeholder="Nome do corretor" />
          <label class="label" for="be">E-mail do corretor</label>
          <input id="be" v-model="bootEmail" type="email" class="input mb-3" placeholder="seu@email.com" />
          <button class="btn btn-primary" :disabled="!bootName.trim() || !bootEmail.trim()"
                  @click="run(() => data.bootstrap(bootName.trim(), bootEmail.trim()), 'Conta configurada')">Criar configuração inicial</button>
        </div>
        <router-view v-else v-slot="{ Component }"><transition name="page" mode="out-in"><component :is="Component" /></transition></router-view>
      </main>
      <footer class="mx-auto max-w-7xl px-2 pb-4 pt-6 text-xs text-mute">
        <nav class="flex flex-wrap gap-x-4 gap-y-1" aria-label="Informações legais">
          <span>© {{ new Date().getFullYear() }} Sules Control</span>
          <router-link to="/privacidade" class="hover:text-gold hover:underline">Privacidade</router-link>
          <router-link to="/termos" class="hover:text-gold hover:underline">Termos</router-link>
          <router-link to="/cookies" class="hover:text-gold hover:underline">Cookies</router-link>
          <a :href="`mailto:${CONTATO.email}`" class="hover:text-gold hover:underline">Contato</a>
        </nav>
      </footer>
    </div>
    <ChatWidget />
    <div class="fixed bottom-4 left-4 z-50 flex flex-col gap-2" aria-live="polite">
      <div v-for="t in toasts" :key="t.id" class="card max-w-sm text-sm"
           :class="t.kind === 'err' ? 'border-neg text-neg' : 'border-pos'">{{ t.msg }}</div>
    </div>
  </div>
</template>
