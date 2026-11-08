import { supabase, fail } from './supabase'

/** PDFs ficam num espaço privado do Supabase, numa pasta com o id do usuário. */
export async function uploadProposal(saleId: string, file: File) {
  const uid = (await supabase.auth.getUser()).data.user!.id
  const path = `${uid}/${saleId}.pdf`
  fail((await supabase.storage.from('proposals').upload(path, file, { upsert: true, contentType: 'application/pdf' })).error)
  fail((await supabase.from('sales').update({ proposal_pdf_path: path }).eq('id', saleId)).error)
}
export async function proposalUrl(path: string) {
  const r = await supabase.storage.from('proposals').createSignedUrl(path, 600)
  fail(r.error)
  return r.data!.signedUrl
}
