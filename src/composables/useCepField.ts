import { ref } from 'vue'
import { addressLine, lookupCep } from '@/services/cep'

type Target = { cep: string; street: string; neighborhood: string; city: string; state: string }
const EMPTY = { street: '', neighborhood: '', city: '', state: '' }

/** Campo de CEP com máscara e preenchimento automático do endereço. */
export function useCepField(t: Target) {
  const info = ref('')
  let seq = 0
  const refresh = () => { info.value = t.city || t.street ? addressLine(t) : '' }
  async function onInput() {
    const digits = t.cep.replace(/\D/g, '').slice(0, 8)
    t.cep = digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits
    if (digits.length < 8) { Object.assign(t, EMPTY); info.value = ''; return }
    const mine = ++seq
    info.value = 'Buscando endereço…'
    try {
      const a = await lookupCep(digits)
      if (mine !== seq) return
      if (!a) { Object.assign(t, EMPTY); info.value = 'CEP não encontrado.'; return }
      Object.assign(t, a); refresh()
    } catch (e) { if (mine === seq) info.value = (e as Error).message }
  }
  return { info, onInput, refresh }
}
