import { onBeforeUnmount, ref, watch, type Ref } from 'vue'

/** Popover ancorado em um elemento (fixo na tela, abre para cima se faltar espaço). */
export function usePopover(anchor: Ref<HTMLElement | undefined>, height = 260, minWidth = 0) {
  const open = ref(false), pop = ref<HTMLElement>(), style = ref<Record<string, string>>({})
  const close = () => { open.value = false }
  function place() {
    const a = anchor.value
    if (!a) return
    const r = a.getBoundingClientRect(), w = Math.max(r.width, minWidth)
    const below = window.innerHeight - r.bottom > height || r.top < height
    style.value = { left: `${Math.max(8, Math.min(r.left, window.innerWidth - w - 8))}px`, width: `${w}px`,
      ...(below ? { top: `${r.bottom + 6}px` } : { bottom: `${window.innerHeight - r.top + 6}px` }) }
  }
  const down = (e: PointerEvent) => { const t = e.target as Node; if (!pop.value?.contains(t) && !anchor.value?.contains(t)) close() }
  const key = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
  const scroll = (e: Event) => { if (!pop.value?.contains(e.target as Node)) close() }
  function bind(on: boolean) {
    if (on) {
      document.addEventListener('pointerdown', down); document.addEventListener('keydown', key)
      window.addEventListener('resize', close); window.addEventListener('scroll', scroll, true)
    } else {
      document.removeEventListener('pointerdown', down); document.removeEventListener('keydown', key)
      window.removeEventListener('resize', close); window.removeEventListener('scroll', scroll, true)
    }
  }
  watch(open, o => { if (o) place(); bind(o) })
  onBeforeUnmount(() => bind(false))
  return { open, pop, style, close, toggle: () => { open.value = !open.value } }
}
