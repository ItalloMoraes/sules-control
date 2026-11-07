import { supabase } from './supabase'
import { notify } from '@/composables/useToast'

/** Envia ao RH a venda recém-cadastrada. Nunca bloqueia nem desfaz o cadastro. */
export async function sendSaleEmail(saleId: string) {
  const { data, error } = await supabase.functions.invoke('send-policy-email', { body: { sale_id: saleId } })
  if (error || data?.error) notify(`Venda salva, mas o e-mail para o RH não saiu: ${data?.error ?? error?.message}`, 'err')
  else notify('E-mail enviado ao RH')
}
