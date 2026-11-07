import { ref } from 'vue'
export const toasts = ref<{ id: number; msg: string; kind: 'ok' | 'err' }[]>([])
let n = 0
export function notify(msg: string, kind: 'ok' | 'err' = 'ok') {
  const id = ++n
  toasts.value.push({ id, msg, kind })
  setTimeout(() => (toasts.value = toasts.value.filter(t => t.id !== id)), kind === 'err' ? 7000 : 3000)
}
/** Executa uma ação, mostra sucesso/erro e retorna true/false. */
export async function run(fn: () => Promise<unknown>, okMsg: string): Promise<boolean> {
  try { await fn(); notify(okMsg); return true }
  catch (e) { notify((e as Error).message, 'err'); return false }
}
