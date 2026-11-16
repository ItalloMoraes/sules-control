// Envia ao RH os dados da venda cadastrada, pelo SMTP do Titan (HostGator). Porta 465 (SSL).
import { createClient } from 'npm:@supabase/supabase-js@2'
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const brl = (n: number) => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const pct = (n: number) => `${Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 3 })}%`
const cpfFmt = (v?: string | null) => { const d = (v ?? '').replace(/\D/g, ''); return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : (v ?? '—') }
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  let sb: ReturnType<typeof createClient> | null = null, saleId = '', to = ''
  try {
    const { sale_id } = await req.json()
    saleId = sale_id
    // Usa o token do próprio usuário: o RLS garante que só venda dele é lida.
    sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
    const { data: allowed } = await sb.rpc('rate_limit_hit', { p_key: 'email', p_max: 60, p_window_seconds: 3600 })
    if (allowed === false) return json({ error: 'Limite de e-mails por hora atingido. Tente mais tarde.' }, 429)
    const { data: s, error } = await sb.from('sales')
      .select('*, clients(full_name, cpf, phone), insurers(name), products(name)').eq('id', sale_id).single()
    if (error || !s) return json({ error: 'Venda não encontrada' }, 404)

    const rows: [string, string][] = [
      ['Cliente', s.clients?.full_name ?? '—'], ['Proposta', s.proposal_number ?? '—'], ['Comissão', pct(s.insurer_percent)],
    ]
    const text = rows.map(([k, v]) => `${k}: ${v}`).join('\n')
    const html = `<table cellpadding="6" style="font-family:sans-serif;font-size:14px;border-collapse:collapse">${
      rows.map(([k, v]) => `<tr><td style="color:#666">${esc(k)}</td><td><b>${esc(v)}</b></td></tr>`).join('')}</table>`

    // Anexa a proposta em PDF, se houver (lida com o token do usuário, respeitando o RLS do Storage).
    const attachments: { filename: string; content: Uint8Array; contentType: string; encoding: string }[] = []
    if (s.proposal_pdf_path) {
      const { data: blob } = await sb.storage.from('proposals').download(s.proposal_pdf_path)
      if (blob) attachments.push({ filename: `Proposta - ${(s.clients?.full_name ?? 'cliente').replace(/[^\w\s-]/g, '')}.pdf`, content: new Uint8Array(await blob.arrayBuffer()), contentType: 'application/pdf', encoding: 'binary' })
    }
    const user = Deno.env.get('SMTP_USER')!
    const smtp = new SMTPClient({ connection: {
      hostname: Deno.env.get('SMTP_HOST') ?? 'smtp.titan.email', port: Number(Deno.env.get('SMTP_PORT') ?? 465), tls: true,
      auth: { username: user, password: Deno.env.get('SMTP_PASS')! } } })
    // Assunto com acento no padrão que todo leitor de e-mail entende (RFC 2047, base64, em pedaços curtos).
const encodeSubject = (s: string) => /^[\x20-\x7e]*$/.test(s) ? s : (s.match(/[\s\S]{1,12}/gu) ?? []).map(c => `=?UTF-8?B?${btoa(String.fromCharCode(...new TextEncoder().encode(c)))}?=`).join(' ')
      to = Deno.env.get('RH_EMAIL')!
    // Cópia oculta (BCC) para a própria caixa: prova do envio e, se o endereço do RH estiver errado, o aviso de devolução chega lá.
    // Para desligar: secret BCC_EMAIL='off'. Para outro endereço: BCC_EMAIL='outro@email.com'.
    const bccEnv = Deno.env.get('BCC_EMAIL')
    const bcc = bccEnv === 'off' ? undefined : (bccEnv || user)
    await smtp.send({ from: user, to, bcc, subject: `Produtor: SUHAI - Ítallo`, content: text, html, attachments })
    await smtp.close()
    await sb.from('email_log').insert({ sale_id: saleId, to_addr: to, status: 'enviado' })
    return json({ ok: true })
  } catch (e) {
    const msg = (e as Error).message
    if (sb && saleId) await sb.from('email_log').insert({ sale_id: saleId, to_addr: to || null, status: 'erro', error: msg.slice(0, 300) })
    return json({ error: msg }, 500)
  }
})
