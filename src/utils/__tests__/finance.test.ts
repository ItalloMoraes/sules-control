import test from 'node:test'
import assert from 'node:assert/strict'
import { calcSale, canReceive, pendingBalance, summarize } from '../finance.ts'
import type { Sale, Receipt, Cancellation, Reversal } from '../../types/index.ts'

const sale = (o: Partial<Sale>): Sale => ({
  id: 's1', client_id: 'c', insurer_id: 'i', product_id: 'p', sale_date: '2026-10-05', policy_start_date: null,
  vehicle_description: null, plate: null, proposal_number: null, policy_number: null, endorsement_number: null,
  premium: 2000, insurer_percent: 20, broker_percent: 70, gross_commission: 400, net_commission: 280,
  origin: 'digital_suhai', status: 'emitida', notes: null, created_at: '', updated_at: '', ...o,
})

test('exemplo da especificação: 2.000 × 20% × 70% = 280', () => {
  assert.deepEqual(calcSale(2000, 20, 70), { gross: 400, net: 280 })
})
test('saldo pendente com recebimentos parciais (280 − 100 − 80 = 100)', () => {
  assert.equal(pendingBalance(sale({}), 180), 100)
})
test('recebimento acima do devido exige justificativa', () => {
  assert.equal(canReceive(sale({}), 180, 200).ok, false)
  assert.equal(canReceive(sale({}), 180, 200, 'ajuste autorizado').ok, true)
})
test('estornos parciais e múltiplos; impacto no mês do desconto, não da venda', () => {
  const s = sale({})
  const receipts: Receipt[] = [{ id: 'r', sale_id: 's1', amount: 280, received_at: '2026-10-20', reference: null, notes: null, over_limit_justification: null }]
  const canc: Cancellation[] = [{ id: 'c1', sale_id: 's1', cancelled_at: '2026-11-02', reason: null, received_at_cancellation: 280, net_at_cancellation: 280, lost_commission: 0 }]
  const rev: Reversal[] = [
    { id: 'v1', cancellation_id: 'c1', sale_id: 's1', amount: 100, reversal_date: '2026-11-10', status: 'efetivado', justification: 'x' },
    { id: 'v2', cancellation_id: 'c1', sale_id: 's1', amount: 180, reversal_date: '2026-12-10', status: 'pendente', justification: 'x' },
  ]
  const ds = { sales: [{ ...s, status: 'cancelada' as const }], receipts, cancellations: canc, reversals: rev }
  const oct = summarize(ds, { from: '2026-10-01', to: '2026-10-31' })
  const nov = summarize(ds, { from: '2026-11-01', to: '2026-11-30' })
  assert.equal(oct.reversalsEffective, 0)       // não retroage ao mês da venda
  assert.equal(nov.reversalsEffective, 100)
  assert.equal(nov.reversalsPending, 180)       // pendente não impacta resultado
})
test('cancelamento antes do recebimento: comissão perdida, sem estorno', () => {
  const ds = { sales: [sale({ status: 'cancelada' })], receipts: [],
    cancellations: [{ id: 'c1', sale_id: 's1', cancelled_at: '2026-10-10', reason: null, received_at_cancellation: 0, net_at_cancellation: 280, lost_commission: 280 }],
    reversals: [] }
  const s = summarize(ds, { from: '2026-10-01', to: '2026-10-31' })
  assert.equal(s.lostCommission, 280)
  assert.equal(s.reversalsEffective, 0)
  assert.equal(pendingBalance(ds.sales[0], 0), 0)
})

test('comissão conta já no cadastro: pendente entra, cancelada sai, recebida = líquida', () => {
  const ds = { sales: [sale({ id: 'a', status: 'pendente' }), sale({ id: 'b', status: 'emitida' }), sale({ id: 'c', status: 'cancelada' })], receipts: [], cancellations: [], reversals: [] }
  const s = summarize(ds, { from: '2026-10-01', to: '2026-10-31' })
  assert.equal(s.net, 560)
  assert.equal(s.received, 560)
  assert.equal(s.pending, 0)
  assert.equal(s.issuedCount, 2)
})

import { nationalHolidays } from '../holidays.ts'
import { businessDaysBetween } from '../businessDays.ts'

test('feriados nacionais de 2026 e dias úteis sem eles', () => {
  assert.deepEqual(nationalHolidays(2026), ['2026-01-01', '2026-04-03', '2026-04-21', '2026-05-01', '2026-09-07', '2026-10-12', '2026-11-02', '2026-11-15', '2026-11-20', '2026-12-25'])
  assert.ok(nationalHolidays(2027).includes('2027-03-26'))      // Sexta-feira Santa 2027
  assert.ok(!nationalHolidays(2023).includes('2023-11-20'))     // Consciência Negra só vale a partir de 2024
  const set = new Set(nationalHolidays(2026))
  assert.equal(businessDaysBetween('2026-11-01', '2026-11-30'), 21)
  assert.equal(businessDaysBetween('2026-11-01', '2026-11-30', set), 19)   // tira 2/11 e 20/11 (15/11 é domingo)
})

import { formatCpf, maskCpf, parseBRL } from '../format.ts'

test('CPF formatado e valores no padrão brasileiro', () => {
  assert.equal(maskCpf('12345678901'), '123.456.789-01')
  assert.equal(maskCpf('1234567'), '123.456.7')
  assert.equal(formatCpf('123.456.789-01'), '123.456.789-01')
  assert.equal(formatCpf('abc'), 'abc')
  assert.equal(parseBRL('1.234,56'), 1234.56)
  assert.equal(parseBRL('R$ 9.999,00'), 9999)
  assert.equal(parseBRL('1234,5'), 1234.5)
  assert.equal(parseBRL('1.234'), 1234)
  assert.equal(parseBRL('12.5'), 12.5)
  assert.equal(parseBRL(''), 0)
})

import { nationalHolidayNames } from '../holidays.ts'
test('nomes dos feriados nacionais', () => {
  const n = nationalHolidayNames(2026)
  assert.equal(n['2026-11-20'], 'Consciência Negra')
  assert.equal(n['2026-04-03'], 'Sexta-feira Santa')
  assert.equal(Object.keys(n).length, 10)
})

import { BR_LABELS, BR_PATHS } from '../brazilMap.ts'
test('mapa do Brasil tem os 27 estados com contorno e sigla', () => {
  const ufs = Object.keys(BR_PATHS)
  assert.equal(ufs.length, 27)
  for (const u of ufs) { assert.ok(BR_PATHS[u].startsWith('M') && BR_PATHS[u].length > 60, u); assert.ok(BR_LABELS[u], u) }
  assert.ok(ufs.includes('DF') && ufs.includes('SP') && ufs.includes('AM'))
})
