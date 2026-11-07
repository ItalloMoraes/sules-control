// Skill animation-on-scroll: IntersectionObserver + keyframe "animationIn" (ver style.css).
// Uso: v-reveal  |  v-reveal="120" (delay em ms)  |  v-reveal.stagger (delay pelo índice entre irmãos)
import type { Directive } from 'vue'

let io: IntersectionObserver | null = null
function observer() {
  return (io ??= new IntersectionObserver(entries => {
    for (const e of entries) {
      if (!e.isIntersecting) continue
      e.target.classList.add('animate')
      io?.unobserve(e.target) // roda uma vez só
    }
  }, { threshold: 0.15, rootMargin: '0px 0px -10% 0px' }))
}

export const vReveal: Directive<HTMLElement, number | undefined> = {
  mounted(el, { value, modifiers }) {
    el.classList.add('animate-on-scroll')
    let delay = value ?? 0
    if (modifiers.stagger && el.parentElement) {
      delay = Math.min(Array.prototype.indexOf.call(el.parentElement.children, el) * 40, 240)
    }
    if (delay) el.style.animationDelay = `${delay}ms`
    observer().observe(el)
  },
  unmounted(el) { io?.unobserve(el) },
}
