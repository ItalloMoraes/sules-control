<script setup lang="ts">
import { useTheme } from '@/composables/useTheme'
import { envMissing } from '@/services/supabase'
import CookieNotice from '@/components/CookieNotice.vue'
useTheme()
</script>
<template>
  <a href="#conteudo" class="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-full focus:bg-gold focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white dark:focus:text-[#04210f]">Pular para o conteúdo</a>
  <main v-if="envMissing" class="mx-auto mt-16 max-w-lg p-6">
    <div class="card">
      <h1 class="mb-2 text-xl font-bold">Falta configurar o banco</h1>
      <p class="mb-2 text-sm text-mute">O site não encontrou as chaves do Supabase. Na pasta principal do projeto (junto do <code>package.json</code>), crie um arquivo chamado <code>.env</code> com:</p>
      <pre class="mb-2 overflow-x-auto rounded-xl bg-raise p-3 text-xs">VITE_SUPABASE_URL=https://SEU-CODIGO.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-publishable</pre>
      <p class="text-sm text-mute">Salve o arquivo, pare o servidor (<code>Ctrl + C</code>), rode <code>npm run dev</code> de novo e atualize a página.</p>
    </div>
  </main>
  <router-view v-else />
  <CookieNotice />
</template>
