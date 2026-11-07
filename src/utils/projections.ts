import type { Sale } from '../types/index.ts'
import type { Dataset } from './finance.ts'
import { monthKeys, monthPeriod, round2, summarize } from './finance.ts'
import { businessDaysBetween } from './businessDays.ts'
import { addMonths } from './format.ts'

export interface Scenario { count: number; gross: number; net: number; reversals: number; adjusted: number }
export interface Projection {
  confidence: 'baixa' | 'media' | 'alta'
  monthsOfHistory: number
  elapsedBizDays: number; remainingBizDays: number
  generatedSoFar: number
  paceNetPerDay: number
  avgNetPerSale: number
  matureCancelRate: number
  avgMonthlyReversals: number
  scenarios: { conservador: Scenario; provavel: Scenario; otimista: Scenario }
  note: string
}

/** Taxa de cancelamento apenas de coortes maduras (vendas com mais de 90 dias) — vendas recentes não herdam a mesma taxa. */
export function matureCancellationRate(sales: Sale[], today: string): number {
  const cutoff = addDaysISO(today, -90)
  const mature = sales.filter(s => s.sale_date <= cutoff && s.status !== 'pendente')
  if (!mature.length) return 0
  return mature.filter(s => s.status === 'cancelada').length / mature.length
}
function addDaysISO(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

export function project(ds: Dataset, today: string, holidays: Set<string> = new Set()): Projection {
  const curKey = today.slice(0, 7)
  const cur = monthPeriod(curKey)
  const soFar = summarize(ds, { from: cur.from, to: today })
  const elapsed = Math.max(businessDaysBetween(cur.from, today, holidays), 1)
  const remaining = businessDaysBetween(addDaysISO(today, 1), cur.to, holidays)

  // histórico: meses anteriores completos com alguma venda emitida
  const prev = monthKeys(addMonths(cur.from, -12), 12).map(k => ({ k, s: summarize(ds, monthPeriod(k)) }))
  const withData = prev.filter(x => x.s.issuedCount > 0)
  const avg = (n: number) => {
    const slice = prev.slice(-n).filter(x => x.s.issuedCount > 0)
    return slice.length ? slice.reduce((a, x) => a + x.s.net, 0) / slice.length : 0
  }
  const avgCount = (n: number) => {
    const slice = prev.slice(-n).filter(x => x.s.issuedCount > 0)
    return slice.length ? slice.reduce((a, x) => a + x.s.issuedCount, 0) / slice.length : 0
  }
  const hist = [avg(3), avg(6), avg(12)].filter(v => v > 0)
  const histNet = hist.length ? hist.reduce((a, b) => a + b, 0) / hist.length : 0
  const histCount = [avgCount(3), avgCount(6), avgCount(12)].filter(v => v > 0)
  const histCnt = histCount.length ? histCount.reduce((a, b) => a + b, 0) / histCount.length : 0

  // sazonalidade: mesmo mês do ano anterior vs média anual
  const sameLast = summarize(ds, monthPeriod(addMonths(cur.from, -12).slice(0, 7))).net
  const yearAvg = withData.length ? withData.reduce((a, x) => a + x.s.net, 0) / withData.length : 0
  const seasonal = sameLast > 0 && yearAvg > 0 ? Math.min(Math.max(sameLast / yearAvg, 0.7), 1.3) : 1

  const paceNet = soFar.net / elapsed
  const paceCnt = soFar.issuedCount / elapsed
  const totalBiz = elapsed + remaining
  const paceProjNet = soFar.net + paceNet * remaining
  const histProjNet = histNet * seasonal
  const base = histProjNet > 0 ? paceProjNet * 0.6 + histProjNet * 0.4 : paceProjNet
  const baseCnt = histCnt > 0 ? (soFar.issuedCount + paceCnt * remaining) * 0.6 + histCnt * 0.4 : soFar.issuedCount + paceCnt * remaining

  const avgNetPerSale = soFar.issuedCount ? soFar.net / soFar.issuedCount : (histCnt ? histNet / histCnt : 0)
  const rate = matureCancellationRate(ds.sales, today)
  const revMonths = prev.slice(-6)
  const avgRev = revMonths.reduce((a, x) => a + x.s.reversalsEffective, 0) / Math.max(revMonths.filter(x => x.s.issuedCount > 0).length, 1)

  const build = (netMul: number, revMul: number): Scenario => {
    const net = round2(Math.max(base * netMul, soFar.net))
    const cnt = Math.round(Math.max(baseCnt * netMul, soFar.issuedCount))
    const gross = round2(soFar.net > 0 ? net * (soFar.gross / soFar.net) : net)
    const reversals = round2(avgRev * revMul)
    return { count: cnt, gross, net, reversals, adjusted: round2(net - reversals) }
  }

  const months = withData.length
  const confidence = months >= 6 && elapsed >= 5 ? 'alta' : months >= 3 ? 'media' : 'baixa'
  return {
    confidence, monthsOfHistory: months, elapsedBizDays: elapsed, remainingBizDays: remaining,
    generatedSoFar: soFar.net, paceNetPerDay: round2(paceNet), avgNetPerSale: round2(avgNetPerSale),
    matureCancelRate: rate, avgMonthlyReversals: round2(avgRev),
    scenarios: {
      conservador: build(0.85, 1.25),
      provavel: build(1, 1),
      otimista: build(1.15, 0.8),
    },
    note: months < 3
      ? 'Pouco histórico: a confiabilidade é baixa. Valores são estimativas, não garantias.'
      : `Estimativa baseada em ritmo atual (${elapsed}/${totalBiz} dias úteis) e histórico. Não é valor garantido.`,
  }
}
