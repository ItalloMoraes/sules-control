<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/stores/auth'
import AmbientParticles from '@/components/AmbientParticles.vue'
import WordReveal from '@/components/WordReveal.vue'
const auth = useAuth(), router = useRouter()
const email = ref(''), password = ref(''), error = ref(''), busy = ref(false)
async function submit() {
  error.value = ''; busy.value = true
  try { await auth.login(email.value, password.value); router.push('/') }
  catch (e) { error.value = (e as Error).message } finally { busy.value = false }
}
const features = [
  ['Comissões sem surpresa', 'Bruta, líquida, recebida e pendente, sempre pela data certa.'],
  ['Conferência mensal', 'O PDF da Digital Suhai contra as vendas cadastradas, divergência por divergência.'],
  ['Metas e projeções', 'Quanto falta, em quantos dias úteis, e o que o ritmo atual entrega.'],
]
</script>
<template>
  <div class="bg-ink">
    <!-- Hero: ocasião rara, movimento expressivo -->
    <section class="relative flex min-h-screen items-center overflow-hidden bg-[radial-gradient(ellipse_at_top_left,rgb(var(--c-gold)/.14),transparent_55%)]">
      <AmbientParticles />
      <div class="relative mx-auto grid w-full max-w-6xl items-center gap-10 p-6 md:grid-cols-2">
        <div class="flex flex-col gap-3">
          <img v-reveal.stagger src="/mascote.png" alt="Mascote da Suhai Seguradora" class="h-32 w-32 object-contain" />
          <p v-reveal.stagger class="text-sm font-medium uppercase tracking-widest text-gold">Seguro auto · carro e moto</p>
          <h1 v-reveal.stagger class="font-display text-4xl font-bold leading-tight md:text-6xl">Sules Control</h1>
          <p v-reveal.stagger class="max-w-md text-mute">Vendas, comissões, estornos e conferência mensal num só lugar. Acesso individual.</p>
        </div>
        <div v-reveal="200" class="card w-full max-w-sm justify-self-center md:justify-self-end">
          <h2 class="text-lg font-bold">Entrar</h2>
          <p class="mb-4 text-sm text-mute">Use seu e-mail e senha.</p>
          <form @submit.prevent="submit">
            <label class="label" for="em">E-mail</label>
            <input id="em" v-model="email" type="email" autocomplete="username" class="input mb-3" />
            <label class="label" for="pw">Senha</label>
            <input id="pw" v-model="password" type="password" autocomplete="current-password" class="input mb-3" />
            <p v-if="error" class="mb-3 text-sm text-neg" role="alert">{{ error }}</p>
            <button type="submit" class="btn btn-primary w-full" :disabled="busy || !email || !password">Entrar</button>
          </form>
        </div>
      </div>
    </section>

    <!-- Texto que se revela com o scroll -->
    <section class="mx-auto max-w-3xl px-6 py-32">
      <WordReveal class="font-display text-2xl font-medium leading-snug md:text-4xl">
        Cada venda tem uma comissão. Cada comissão tem uma data. O Sules Control acompanha o caminho inteiro,
        da emissão ao <em class="text-gold not-italic">recebimento</em>, do cancelamento ao estorno, até o PDF da seguradora
        bater com o que você vendeu.
      </WordReveal>
    </section>

    <section class="mx-auto grid max-w-6xl gap-4 px-6 pb-32 md:grid-cols-3">
      <div v-for="[t, d] in features" :key="t" v-reveal.stagger class="card">
        <h3 class="mb-1 font-bold text-gold">{{ t }}</h3>
        <p class="text-sm text-mute">{{ d }}</p>
      </div>
    </section>
  </div>
</template>
