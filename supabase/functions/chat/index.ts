// Chat rápido do corretor. A chave da Anthropic fica só aqui (secret), nunca no navegador.
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const SYSTEM = `Você ajuda um corretor que vende seguro auto (carro e moto) pela Suhai Seguradora.
Responda em português do Brasil, com mensagens curtas, naturais e prontas para colar no WhatsApp.
Tom amigável e direto. Não invente coberturas, preços, descontos ou regras da seguradora: se faltar dado, deixe [entre colchetes].
Sem markdown pesado.`

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const { messages } = await req.json()
    const msgs = (Array.isArray(messages) ? messages : []).slice(-12)
      .filter((m: { role: string; content: unknown }) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .map((m: { role: string; content: string }) => ({ role: m.role, content: m.content.slice(0, 4000) }))
    if (!msgs.length || msgs[msgs.length - 1].role !== 'user') return json({ error: 'Mensagem vazia' }, 400)
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') ?? '', 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-sonnet-5-5', max_tokens: 600, system: SYSTEM, messages: msgs }),
    })
    const d = await r.json()
    if (!r.ok) return json({ error: d?.error?.message ?? 'Falha na API' }, 502)
    return json({ reply: (d.content ?? []).map((c: { text?: string }) => c.text ?? '').join('') })
  } catch (e) { return json({ error: (e as Error).message }, 500) }
})
