import type { Classification, Difference, ParsedItem, ReconRow, Sale } from '../types/index.ts'
import { normalizeId } from './reportParser.ts'

export interface SaleLite extends Pick<Sale,
  'id' | 'sale_date' | 'policy_start_date' | 'proposal_number' | 'policy_number' | 'endorsement_number' |
  'premium' | 'insurer_percent' | 'gross_commission' | 'status' | 'origin' | 'insurer_id'> {
  client_name: string
}

const TOL = 0.01
const sameMoney = (a: number, b: number) => Math.abs(a - b) <= TOL
const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

export const isEndorsement = (c: string) => c === 'EN' || c === 'ER'
export const isCancellation = (c: string) => c === 'CN' || c === 'CR'

interface Found { sale: SaleLite; rule: string }

/** Correspondência em ordem de prioridade: proposta → apólice → endosso → cliente+vigência+prêmio+comissão. */
function findSale(item: ParsedItem, sales: SaleLite[], used: Set<string>): Found | null {
  const prop = normalizeId(item.proposal_number)
  const pol = normalizeId(item.policy_number)
  const end = normalizeId(item.endorsement_number)

  if (prop) {
    const c = sales.filter(s => normalizeId(s.proposal_number) === prop)
    const pick = c.find(s => !used.has(s.id)) ?? c[0]
    if (pick) return { sale: pick, rule: 'proposta' }
  }
  if (pol) {
    const c = sales.filter(s => normalizeId(s.policy_number) === pol)
    const pick = c.find(s => !used.has(s.id)) ?? c[0]
    if (pick) return { sale: pick, rule: 'apolice' }
  }
  if (end) {
    const c = sales.filter(s => normalizeId(s.endorsement_number) === end)
    if (c[0]) return { sale: c[0], rule: 'endosso' }
  }
  // Fallback: nome NÃO basta sozinho — exige prêmio ou data de vigência compatível.
  const name = norm(item.client_name)
  const byName = sales.filter(s => norm(s.client_name) === name && !used.has(s.id))
  const scored = byName
    .map(s => ({
      s,
      score:
        (sameMoney(s.premium, item.premium) ? 2 : 0) +
        (item.policy_start_date && (s.policy_start_date === item.policy_start_date || s.sale_date === item.policy_start_date) ? 1 : 0) +
        (sameMoney(s.gross_commission, item.commission) ? 1 : 0),
    }))
    .filter(x => x.score >= 2)
    .sort((a, b) => b.score - a.score)
  if (scored.length) return { sale: scored[0].s, rule: 'cliente+vigencia+premio+comissao' }
  return null
}

export function compareItem(item: ParsedItem, sale: SaleLite): Difference[] {
  const d: Difference[] = []
  if (!sameMoney(sale.premium, item.premium)) d.push({ field: 'Prêmio', report: item.premium, system: sale.premium, severity: 'divergencia' })
  if (!sameMoney(sale.gross_commission, item.commission)) d.push({ field: 'Comissão', report: item.commission, system: sale.gross_commission, severity: 'divergencia' })
  if (Math.abs(sale.insurer_percent - item.commission_percent) > 0.005)
    d.push({ field: '% seguradora', report: item.commission_percent, system: sale.insurer_percent, severity: 'divergencia' })
  const pn = normalizeId(item.proposal_number), sp = normalizeId(sale.proposal_number)
  if (pn && sp && pn !== sp) d.push({ field: 'Proposta', report: item.proposal_number, system: sale.proposal_number, severity: 'divergencia' })
  const an = normalizeId(item.policy_number), sa = normalizeId(sale.policy_number)
  if (an && sa && an !== sa) d.push({ field: 'Apólice', report: item.policy_number, system: sale.policy_number, severity: 'divergencia' })
  // Dt. In. Vig. ≠ sale_date: apenas informativo.
  if (item.policy_start_date && item.policy_start_date !== sale.sale_date)
    d.push({ field: 'Data (vigência × venda)', report: item.policy_start_date, system: sale.sale_date, severity: 'info' })
  return d
}

export interface ReconInput {
  items: ParsedItem[]
  sales: SaleLite[]                 // todas as vendas do usuário (para localizar)
  previousKeys: Set<string>         // chaves de itens de importações anteriores
  keyOf: (i: ParsedItem) => string
  referenceMonth: string | null     // 'YYYY-MM-01'
  insurerId?: string | null
}

export function reconcile(input: ReconInput): { rows: ReconRow[]; counts: Record<string, number> } {
  const { items, sales, previousKeys, keyOf, referenceMonth } = input
  const rows: ReconRow[] = []
  const used = new Set<string>()
  const seen = new Set<string>()

  for (const item of items) {
    const key = keyOf(item)
    if (previousKeys.has(key) || seen.has(key)) {
      rows.push({ item, sale_id: null, classification: 'duplicado', match_rule: null, differences: [] })
      continue
    }
    seen.add(key)

    const found = findSale(item, sales, used)
    if (found && !isEndorsement(item.movement_code) && !isCancellation(item.movement_code)) used.add(found.sale.id)

    let cls: Classification
    let diffs: Difference[] = []
    if (isEndorsement(item.movement_code) || isCancellation(item.movement_code)) {
      cls = 'movimentacao_especial'
      if (found) diffs = compareItem(item, found.sale).filter(d => d.severity === 'info')
    } else if (!found) {
      cls = 'nao_cadastrado'
    } else {
      diffs = compareItem(item, found.sale)
      cls = diffs.some(d => d.severity === 'divergencia') ? 'divergencia' : 'conferido'
    }
    rows.push({ item, sale_id: found?.sale.id ?? null, classification: cls, match_rule: found?.rule ?? null, differences: diffs })
  }

  // Vendas cadastradas (Digital Suhai, não canceladas, do mês) que não aparecem no relatório.
  if (referenceMonth) {
    const ym = referenceMonth.slice(0, 7)
    for (const s of sales) {
      if (used.has(s.id) || s.origin !== 'digital_suhai' || s.status === 'cancelada') continue
      if (input.insurerId && s.insurer_id !== input.insurerId) continue
      const dt = s.policy_start_date ?? s.sale_date
      if (dt.slice(0, 7) !== ym && s.sale_date.slice(0, 7) !== ym) continue
      // já referenciada por um item especial? (endossos podem apontar para a venda original)
      if (rows.some(r => r.sale_id === s.id)) continue
      rows.push({ item: null, sale_id: s.id, classification: 'nao_consta_no_relatorio', match_rule: null, differences: [] })
    }
  }

  const counts: Record<string, number> = {
    total: items.length, conferido: 0, divergencia: 0, nao_cadastrado: 0,
    nao_consta_no_relatorio: 0, movimentacao_especial: 0, duplicado: 0, endossos: 0, cancelamentos: 0,
  }
  for (const r of rows) {
    counts[r.classification]++
    if (r.item && isEndorsement(r.item.movement_code)) counts.endossos++
    if (r.item && isCancellation(r.item.movement_code)) counts.cancelamentos++
  }
  return { rows, counts }
}
