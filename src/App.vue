<script setup lang="ts">
import { useTheme } from '@/composables/useTheme'
import { envMissing } from '@/services/supabase'
useTheme()
</script>
<template>
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
</template>
