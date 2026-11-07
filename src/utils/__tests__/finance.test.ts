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
  assert.equal(nov.cashBalance, -100)
  assert.equal(oct.cashBalance, 280)
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
