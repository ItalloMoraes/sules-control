// Envia ao RH os dados da venda cadastrada, pelo SMTP do Titan (HostGator). Porta 465 (SSL).
import { createClient } from 'npm:@supabase/supabase-js@2'
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const brl = (n: number) => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const pct = (n: number) => `${Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 3 })}%`
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const { sale_id } = await req.json()
    // Usa o token do próprio usuário: o RLS garante que só venda dele é lida.
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
    const { data: s, error } = await sb.from('sales')
      .select('*, clients(full_name, cpf, phone), insurers(name), products(name)').eq('id', sale_id).single()
    if (error || !s) return json({ error: 'Venda não encontrada' }, 404)

    const rows: [string, string][] = [
      ['Cliente', s.clients?.full_name ?? '—'], ['CPF', s.clients?.cpf ?? '—'], ['Telefone', s.clients?.phone ?? '—'],
      ['Seguradora', s.insurers?.name ?? '—'], ['Produto', s.products?.name ?? '—'],
      ['Placa', s.plate ?? '—'],
      ['Proposta', s.proposal_number ?? '—'], ['Apólice', s.policy_number ?? 'ainda não emitida'],
      ['Data da venda', String(s.sale_date).split('-').reverse().join('/')],
      ['Prêmio', brl(s.premium)], ['Percentual da seguradora', pct(s.insurer_percent)],
      ['Percentual do corretor', pct(s.broker_percent)], ['Comissão líquida', brl(s.net_commission)],
      ['Origem', s.origin === 'digital_suhai' ? 'Digital Suhai' : 'Venda própria'], ['Status', s.status],
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
    await smtp.send({ from: user, to: Deno.env.get('RH_EMAIL')!, subject: `Nova venda: ${s.clients?.full_name ?? ''} · ${s.products?.name ?? ''}`, content: text, html, attachments })
    await smtp.close()
    return json({ ok: true })
  } catch (e) { return json({ error: (e as Error).message }, 500) }
})
