<script setup lang="ts">
import { ref } from 'vue'
const KEY = 'sc-cookies-ok'
const show = ref(localStorage.getItem(KEY) !== '1')
function ok() { localStorage.setItem(KEY, '1'); show.value = false }
</script>
<template>
  <Transition name="pop">
    <div v-if="show" role="region" aria-label="Aviso de cookies" class="card fixed bottom-4 left-1/2 z-[70] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 shadow-2xl">
      <p class="text-sm">Usamos apenas armazenamento essencial do navegador (login e preferências). Sem rastreamento e sem publicidade.
        <router-link to="/cookies" class="text-gold hover:underline">Saiba mais</router-link> · <router-link to="/privacidade" class="text-gold hover:underline">Privacidade</router-link></p>
      <div class="mt-3 flex justify-end"><button class="btn btn-primary" @click="ok">Entendi</button></div>
    </div>
  </Transition>
</template>
