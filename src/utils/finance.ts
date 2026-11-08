import type { Cancellation, Receipt, Reversal, Sale } from '../types/index.ts'

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100

export function grossCommission(premium: number, insurerPercent: number): number {
  return round2((premium * insurerPercent) / 100)
}
export function netCommission(gross: number, brokerPercent: number): number {
  return round2((gross * brokerPercent) / 100)
}
export function calcSale(premium: number, insurerPercent: number, brokerPercent: number) {
  const gross = grossCommission(premium, insurerPercent)
  return { gross, net: netCommission(gross, brokerPercent) }
}

/** Comissão líquida válida: venda cancelada não tem mais comissão a receber. */
export function validNet(sale: Pick<Sale, 'status' | 'net_commission'>): number {
  return sale.status === 'cancelada' ? 0 : sale.net_commission
}
export function pendingBalance(sale: Pick<Sale, 'status' | 'net_commission'>, received: number): number {
  return round2(Math.max(validNet(sale) - received, 0))
}
export type FinancialStatus = 'pendente' | 'parcialmente_recebido' | 'recebido' | 'cancelada'
export function financialStatus(sale: Pick<Sale, 'status' | 'net_commission'>, received: number): FinancialStatus {
  if (sale.status === 'cancelada') return 'cancelada'
  if (received <= 0) return 'pendente'
  return received < sale.net_commission ? 'parcialmente_recebido' : 'recebido'
}
/** Recebimento acima do devido só com ajuste justificado. */
export function canReceive(sale: Pick<Sale, 'net_commission'>, received: number, amount: number, justification?: string) {
  const over = round2(received + amount) > sale.net_commission
  if (over && !justification?.trim()) {
    return { ok: false as const, reason: 'Recebimento acima do valor devido exige justificativa de ajuste.' }
  }
  return { ok: true as const }
}

export interface Period { from: string; to: string }
export interface Dataset {
  sales: Sale[]; receipts: Receipt[]; cancellations: Cancellation[]; reversals: Reversal[]
}
const within = (d: string | null | undefined, p: Period) => !!d && d >= p.from && d <= p.to

/** A comissão conta desde o cadastro: pendentes e emitidas entram; canceladas ficam de fora (já descontadas). */
export const isProduction = (s: Sale) => s.status !== 'cancelada'

export interface Summary {
  salesCount: number; issuedCount: number; premium: number
  gross: number; net: number
  received: number; pending: number
  lostCommission: number
  reversalsEffective: number; reversalsPending: number
  adjustedResult: number   // produção ajustada = líquida gerada − estornos efetivados no período
  cashBalance: number      // recebimentos − devoluções efetivamente pagas no período
  cancellationsCount: number; cancellationRate: number
}

export function summarize(ds: Dataset, p: Period, filter: (s: Sale) => boolean = () => true): Summary {
  const sales = ds.sales.filter(filter)
  const ids = new Set(sales.map(s => s.id))
  const periodSales = sales.filter(s => within(s.sale_date, p))
  const issued = periodSales.filter(isProduction)
  const premium = round2(issued.reduce((a, s) => a + s.premium, 0))
  const gross = round2(issued.reduce((a, s) => a + s.gross_commission, 0))
  const net = round2(issued.reduce((a, s) => a + s.net_commission, 0))

  // Sem lançamento de recebimentos: a comissão é considerada recebida assim que a venda é cadastrada.
  const received = net
  const pending = 0

  const cancsPeriod = ds.cancellations.filter(c => ids.has(c.sale_id) && within(c.cancelled_at, p))
  const lostCommission = round2(cancsPeriod.reduce((a, c) => a + c.lost_commission, 0))

  const revs = ds.reversals.filter(r => ids.has(r.sale_id))
  const reversalsEffective = round2(revs.filter(r => r.status === 'efetivado' && within(r.reversal_date, p))
    .reduce((a, r) => a + r.amount, 0))
  const reversalsPending = round2(revs.filter(r => r.status === 'pendente').reduce((a, r) => a + r.amount, 0))

  const nonPending = periodSales.filter(s => s.status !== 'pendente')
  const cancelled = periodSales.filter(s => s.status === 'cancelada').length
  return {
    salesCount: periodSales.length, issuedCount: issued.length,
    premium, gross, net, received, pending, lostCommission,
    reversalsEffective, reversalsPending,
    adjustedResult: round2(net - reversalsEffective),
    cashBalance: round2(received - reversalsEffective),
    cancellationsCount: cancsPeriod.length,
    cancellationRate: nonPending.length ? cancelled / nonPending.length : 0,
  }
}

export function monthKeys(fromMonth: string, count: number): string[] {
  const out: string[] = []
  const [y, m] = fromMonth.slice(0, 7).split('-').map(Number)
  for (let i = 0; i < count; i++) {
    const d = new Date(Date.UTC(y, m - 1 + i, 1))
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`)
  }
  return out
}
export function monthPeriod(key: string): Period {
  const [y, m] = key.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { from: `${key}-01`, to: `${key}-${String(last).padStart(2, '0')}` }
}
