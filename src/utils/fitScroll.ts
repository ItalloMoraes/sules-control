/**
 * Mantém cada tabela com rolagem (.tbl-scroll) com o pé dentro da tela, para a barra de rolagem lateral
 * ficar sempre à vista, sem precisar descer a página. Recalcula ao redimensionar e quando a tela muda.
 */
export function installFitScroll() {
  const fit = () => document.querySelectorAll<HTMLElement>('.tbl-scroll').forEach(el => {
    const top = el.getBoundingClientRect().top + window.scrollY
    el.style.maxHeight = `${Math.max(240, window.innerHeight - top - 16)}px`
  })
  let raf = 0
  const schedule = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(fit) }
  window.addEventListener('resize', schedule)
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true })
  new ResizeObserver(schedule).observe(document.body)
  schedule()
}
