<script setup lang="ts">
// Skill scroll-scrubbed-word-reveal: o progresso do scroll é a única fonte de verdade.
// Cópia visual dividida em palavras (aria-hidden) + cópia intacta só para leitores de tela.
import { onBeforeUnmount, onMounted, ref } from 'vue'

const vis = ref<HTMLElement>()
let words: HTMLElement[] = [], raf = 0, active = false, orig = ''
let io: IntersectionObserver | null = null

function split(el: HTMLElement) {
  const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode: n => n.parentElement?.closest('script,style,input,textarea,select,[data-no-split]')
      ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  })
  const nodes: Text[] = []
  while (tw.nextNode()) nodes.push(tw.currentNode as Text)
  for (const n of nodes) {
    const frag = document.createDocumentFragment()
    for (const part of n.data.split(/(\s+)/)) {
      if (!part) continue
      if (/^\s+$/.test(part)) { frag.append(part); continue }   // espaços preservados
      const s = document.createElement('span')
      s.className = 'wr-w'; s.textContent = part
      frag.append(s); words.push(s)
    }
    n.replaceWith(frag)
  }
}
function update() {
  raf = 0
  const el = vis.value
  if (!el || !words.length) return
  const r = el.getBoundingClientRect(), vh = window.innerHeight
  // span cresce com o tamanho do texto (altura do bloco + meia tela)
  const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2   // fim da página: texto completo
  const prog = atEnd ? 1 : Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (r.height + vh * 0.35)))
  const n = words.length
  for (let i = 0; i < n; i++) {
    const local = Math.min(1, Math.max(0, prog * (n + 3) - i)) // ~3 palavras de sobreposição
    words[i].style.setProperty('--wp', local.toFixed(3))
  }
}
function onScroll() { if (active && !raf) raf = requestAnimationFrame(update) }

onMounted(() => {
  const el = vis.value
  if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return // tudo visível, sem divisão
  orig = el.innerHTML
  split(el)
  io = new IntersectionObserver(([e]) => { active = e.isIntersecting; if (active) onScroll() }, { rootMargin: '10% 0px' })
  io.observe(el)
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll)
  document.fonts?.ready.then(update)
  update()
})
onBeforeUnmount(() => {
  if (raf) cancelAnimationFrame(raf)
  io?.disconnect()
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onScroll)
  if (vis.value && orig) vis.value.innerHTML = orig // restaura o DOM original
  words = []
})
</script>
<template>
  <div>
    <p ref="vis" aria-hidden="true"><slot /></p>
    <p class="sr-only"><slot /></p>
  </div>
</template>
