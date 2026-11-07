import type { MovementCode, ParsedItem, ParsedReport } from '../types/index.ts'

/**
 * Parser do relatório mensal de produção (Digital Suhai).
 * Trabalha sobre LINHAS de texto (uma linha = um registro) e é tolerante ao layout.
 * Colunas esperadas: Cliente | Dt. In. Vig. | Proposta | Apólice | Endosso | Produto |
 * Neg/Itens | Vigência | Parc | Prêmio | (%) | Comissão.
 * Qualquer linha que não casar vai para `unparsed` (nunca é descartada em silêncio).
 */
const DATE = /\b(\d{2})\/(\d{2})\/(\d{4})\b/g
const MONEY = /\(?-?\s?\d{1,3}(?:\.\d{3})*,\d{2}-?\)?|\(?-?\d+,\d{2}-?\)?/g
const CODES = ['EN', 'CN', 'ER', 'CR', 'N', 'R'] as const

export function toISO(br: string): string {
  const m = br.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : ''
}

/** "1.234,56" → 1234.56 ; "-10,00", "10,00-" e "(10,00)" → negativos; preserva zero. */
export function parseMoney(raw: string): number {
  let s = raw.trim()
  let neg = false
  if (s.startsWith('(') && s.endsWith(')')) { neg = true; s = s.slice(1, -1) }
  if (s.endsWith('-')) { neg = true; s = s.slice(0, -1) }
  if (s.startsWith('-')) { neg = true; s = s.slice(1) }
  s = s.replace(/\s/g, '').replace(/\./g, '').replace(',', '.')
  const n = Number(s)
  if (Number.isNaN(n)) return 0
  return neg ? -n : n
}

export function normalizeId(v: string | null | undefined): string | null {
  if (!v) return null
  const digits = v.replace(/\D/g, '').replace(/^0+/, '')
  return digits.length ? digits : null
}

export function parseLine(line: string, lineNo: number): ParsedItem | null {
  const text = line.replace(/\s+/g, ' ').replace(/([A-Za-zÀ-ÿ.])(\d{2}\/\d{2}\/\d{4})/g, '$1 $2').trim()
  const dates = [...text.matchAll(DATE)]
  if (dates.length < 1) return null

  const firstDate = dates[0]
  const firstIdx = firstDate.index!
  const client = text.slice(0, firstIdx).trim()
  if (!client) return null

  // Dinheiro: os três últimos valores monetários são prêmio, (%) e comissão.
  const moneyAll = [...text.matchAll(MONEY)].filter(m => m.index! > firstIdx)
  if (moneyAll.length < 3) return null
  const [mp, mpct, mc] = moneyAll.slice(-3)
  const premium = parseMoney(mp[0])
  const commission_percent = parseMoney(mpct[0])
  const commission = parseMoney(mc[0])

  // Trecho entre a 1ª data e a vigência/valores contém ids, produto e código.
  const afterFirst = text.slice(firstIdx + firstDate[0].length)
  const mid = afterFirst.slice(0, Math.max(0, mp.index! - (firstIdx + firstDate[0].length)))

  // Vigência: duas últimas datas (se houver 3+); senão, repete Dt. In. Vig.
  let vigStart: string | null = null
  let vigEnd: string | null = null
  if (dates.length >= 3) {
    vigStart = toISO(dates[dates.length - 2][0]); vigEnd = toISO(dates[dates.length - 1][0])
  } else if (dates.length === 2) {
    vigStart = toISO(dates[0][0]); vigEnd = toISO(dates[1][0])
  }

  // Remove datas do trecho do meio e procura o código Neg/Itens.
  const midNoDates = mid.replace(DATE, ' ').replace(/\s+/g, ' ').trim()
  const tokens = midNoDates.split(' ').filter(Boolean)
  let codeIdx = -1
  let code: MovementCode | null = null
  for (let i = 0; i < tokens.length; i++) {
    if ((CODES as readonly string[]).includes(tokens[i].toUpperCase()) && i > 0) {
      code = tokens[i].toUpperCase() as MovementCode; codeIdx = i; break
    }
  }
  if (!code) return null

  const before = tokens.slice(0, codeIdx)
  const after = tokens.slice(codeIdx + 1)
  const idTokens: string[] = []
  const productTokens: string[] = []
  for (const t of before) {
    if (/^\d+$/.test(t) || t === '-') idTokens.push(t)
    else productTokens.push(t)
  }
  const clean = (t?: string) => (t && t !== '0' && t !== '-' ? t : null)

  let proposal: string | null = null
  let policy: string | null = null
  let endorsement: string | null = null
  const isEndorse = code === 'EN' || code === 'ER' || code === 'CN' || code === 'CR'
  if (idTokens.length >= 3) {
    ;[proposal, policy, endorsement] = [clean(idTokens[0]), clean(idTokens[1]), clean(idTokens[2])]
  } else if (idTokens.length === 2) {
    ;[proposal, policy] = [clean(idTokens[0]), clean(idTokens[1])]
  } else if (idTokens.length === 1) {
    proposal = clean(idTokens[0])
  }
  // Proposta sem apólice ainda é normal (apólice ainda não emitida); endosso sem número de endosso não é.
  const needsReview = idTokens.length === 0 || (isEndorse && !endorsement)

  // Parcelas: inteiro isolado logo antes do prêmio (ou nos tokens após o código).
  let installments: number | null = null
  const tail = after.filter(t => /^\d{1,2}$/.test(t))
  if (tail.length) installments = Number(tail[tail.length - 1])

  return {
    line_no: lineNo,
    client_name: client,
    policy_start_date: toISO(firstDate[0]) || null,
    proposal_number: proposal,
    policy_number: policy,
    endorsement_number: endorsement,
    product: productTokens.join(' ') || null,
    movement_code: code,
    vigencia_start: vigStart,
    vigencia_end: vigEnd,
    installments,
    premium, commission_percent, commission,
    needs_review: needsReview,
    raw: line,
  }
}

const HEADER = /(cliente|dt\.?\s*in\.?\s*vig|proposta|ap[óo]lice|neg\/itens|pr[êe]mio|comiss[ãa]o|p[áa]g(?:ina)?\.?|total|legenda|seguro novo|renova[çc][ãa]o|endosso\/fatura)/i

export function parseReportText(lines: string[]): ParsedReport {
  const items: ParsedItem[] = []
  const unparsed: { line_no: number; text: string }[] = []
  let periodStart = null as string | null
  let periodEnd = null as string | null
  let totals = null as ParsedReport['totals']

  lines.forEach((ln, idx) => {
    const lineNo = idx + 1
    const text = ln.trim()
    if (!text) return
    const per = text.match(/(?:per[íi]odo|in[íi]cio de vig[êe]ncia)[^0-9]*(\d{2}\/\d{2}\/\d{4})\s*(?:a|at[ée]|-|–)\s*(\d{2}\/\d{2}\/\d{4})/i)
    if (per) { periodStart = toISO(per[1]); periodEnd = toISO(per[2]); return }
    const tot = text.match(/^total per[íi]odo:?\s+(\d+)\s+(\d+)\s+(\S+)\s+\S+\s+(\S+)$/i)
    if (tot) { totals = { policies: +tot[1], documents: +tot[2], premium: parseMoney(tot[3]), commission: parseMoney(tot[4]) }; return }
    const item = parseLine(text, lineNo)
    if (item) { items.push(item); return }
    if (!HEADER.test(text) && /\d/.test(text)) unparsed.push({ line_no: lineNo, text })
  })

  // Mês de referência: do período, senão o mês mais frequente das datas de início de vigência.
  let reference: string | null = periodStart ? periodStart.slice(0, 7) + '-01' : null
  if (!reference && items.length) {
    const count = new Map<string, number>()
    for (const it of items) if (it.policy_start_date) {
      const k = it.policy_start_date.slice(0, 7); count.set(k, (count.get(k) ?? 0) + 1)
    }
    const best = [...count.entries()].sort((a, b) => b[1] - a[1])[0]
    if (best) reference = best[0] + '-01'
  }
  if (!periodStart && reference) {
    const dts = items.map(i => i.policy_start_date).filter(Boolean).sort() as string[]
    periodStart = dts[0] ?? reference; periodEnd = dts[dts.length - 1] ?? reference
  }
  return { period_start: periodStart, period_end: periodEnd, reference_month: reference, items, unparsed, totals }
}

/** Ordenação padrão: início de vigência → cliente → proposta. */
export function sortItems<T extends Pick<ParsedItem, 'policy_start_date' | 'client_name' | 'proposal_number'>>(
  items: T[], dir: 'asc' | 'desc' = 'asc'
): T[] {
  const f = dir === 'asc' ? 1 : -1
  return [...items].sort((a, b) =>
    f * ((a.policy_start_date ?? '').localeCompare(b.policy_start_date ?? '') ||
         a.client_name.localeCompare(b.client_name, 'pt-BR') ||
         (a.proposal_number ?? '').localeCompare(b.proposal_number ?? '')))
}

/** Chave de identidade do registro (duplicidade entre importações). */
export function itemKey(i: Pick<ParsedItem, 'proposal_number' | 'policy_number' | 'endorsement_number' | 'movement_code' | 'premium' | 'commission' | 'policy_start_date' | 'client_name'>): string {
  return [
    normalizeId(i.proposal_number) ?? '', normalizeId(i.policy_number) ?? '', normalizeId(i.endorsement_number) ?? '',
    i.movement_code, i.premium.toFixed(2), i.commission.toFixed(2),
    i.policy_start_date ?? '', i.client_name.trim().toLowerCase(),
  ].join('|')
}
