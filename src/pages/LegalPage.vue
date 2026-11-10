<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { DOCS, LEGAL_UPDATED } from '@/legal/content'
import { CONTATO } from '@/contact'

const route = useRoute()
const doc = computed(() => DOCS[route.meta.doc as string] ?? DOCS.privacidade)
const links = [['/privacidade', 'Política de Privacidade'], ['/termos', 'Termos de Serviço'], ['/cookies', 'Aviso de cookies']]
</script>
<template>
  <div class="min-h-screen bg-ink px-4 py-8">
    <article id="conteudo" class="card mx-auto max-w-3xl" tabindex="-1">
      <router-link to="/" class="text-sm text-gold hover:underline">← Voltar ao sistema</router-link>
      <h1 class="mt-3 font-display text-3xl font-bold">{{ doc.title }}</h1>
      <p class="mb-5 text-xs text-mute">Última atualização: {{ LEGAL_UPDATED }}</p>
      <p class="mb-6 text-sm">{{ doc.intro }}</p>
      <section v-for="(b, i) in doc.blocks" :key="i" class="mb-5">
        <h2 class="mb-1 text-lg font-semibold">{{ i + 1 }}. {{ b.h }}</h2>
        <p v-for="(t, j) in b.p ?? []" :key="j" class="mb-2 text-sm text-mute">{{ t }}</p>
        <ul v-if="b.ul" class="mb-2 list-disc space-y-1 pl-5 text-sm text-mute"><li v-for="(t, j) in b.ul" :key="j">{{ t }}</li></ul>
      </section>
      <p class="border-t border-line pt-4 text-sm">Dúvidas ou pedidos sobre seus dados: <a :href="`mailto:${CONTATO.email}`" class="text-gold hover:underline">{{ CONTATO.email }}</a></p>
      <nav class="mt-3 flex flex-wrap gap-4 text-sm" aria-label="Documentos legais"><router-link v-for="[to, label] in links" :key="to" :to="to" class="text-mute hover:text-gold hover:underline">{{ label }}</router-link></nav>
    </article>
  </div>
</template>
