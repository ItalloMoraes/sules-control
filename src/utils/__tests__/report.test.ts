import test from 'node:test'
import assert from 'node:assert/strict'
import { parseLine, parseMoney, parseReportText, sortItems, itemKey } from '../reportParser.ts'
import { reconcile, type SaleLite } from '../reconcile.ts'

test('parseMoney preserva negativos e zeros', () => {
  assert.equal(parseMoney('1.234,56'), 1234.56)
  assert.equal(parseMoney('-10,00'), -10)
  assert.equal(parseMoney('10,00-'), -10)
  assert.equal(parseMoney('(10,00)'), -10)
  assert.equal(parseMoney('0,00'), 0)
})

const L1 = 'MARIA DA SILVA 05/10/2026 123456 789012 0 AUTO N 05/10/2026 05/10/2027 10 2.000,00 20,00 400,00'
const L2 = 'JOAO PEREIRA 02/10/2026 223344 556677 998877 MOTO EN 02/10/2026 02/10/2027 1 0,00 0,00 0,00'
const L3 = 'ANA LIMA 09/10/2026 333444 777888 112233 AUTO CN 09/10/2026 09/10/2027 12 -500,00 20,00 -100,00'

test('parseia nova, endosso zerado e cancelamento negativo', () => {
  const a = parseLine(L1, 1)!, b = parseLine(L2, 2)!, c = parseLine(L3, 3)!
  assert.equal(a.movement_code, 'N'); assert.equal(a.proposal_number, '123456'); assert.equal(a.endorsement_number, null)
  assert.equal(a.premium, 2000); assert.equal(a.commission, 400); assert.equal(a.client_name, 'MARIA DA SILVA')
  assert.equal(b.movement_code, 'EN'); assert.equal(b.commission, 0); assert.equal(b.endorsement_number, '998877')
  assert.equal(c.movement_code, 'CN'); assert.equal(c.commission, -100); assert.equal(c.premium, -500)
})

test('ordenação cronológica por início de vigência, depois cliente', () => {
  const r = parseReportText(['Período: 01/10/2026 a 31/10/2026', L1, L2, L3])
  assert.equal(r.reference_month, '2026-10-01')
  const s = sortItems(r.items)
  assert.deepEqual(s.map(i => i.client_name), ['JOAO PEREIRA', 'MARIA DA SILVA', 'ANA LIMA'])
  assert.equal(sortItems(r.items, 'desc')[0].client_name, 'ANA LIMA')
})

const sale = (o: Partial<SaleLite>): SaleLite => ({
  id: 's', client_name: 'MARIA DA SILVA', sale_date: '2026-10-03', policy_start_date: null,
  proposal_number: '123456', policy_number: null, endorsement_number: null, premium: 2000, insurer_percent: 20,
  gross_commission: 400, status: 'emitida', origin: 'digital_suhai', insurer_id: 'i', ...o,
})

test('conferência: conferido, divergência, não cadastrado, ausente, especial, duplicado', () => {
  const items = parseReportText([L1, L2, L3]).items
  const sales = [
    sale({ id: 'a' }),                                                          // casa com L1 (data diferente = só info)
    sale({ id: 'b', client_name: 'OUTRO', proposal_number: '999999', sale_date: '2026-10-08' }), // ausente
  ]
  const { rows, counts } = reconcile({ items, sales, previousKeys: new Set(), keyOf: itemKey, referenceMonth: '2026-10-01' })
  const by = (n: string) => rows.find(r => r.item?.client_name === n)!
  assert.equal(by('MARIA DA SILVA').classification, 'conferido')
  assert.ok(by('MARIA DA SILVA').differences.some(d => d.severity === 'info'))
  assert.equal(by('JOAO PEREIRA').classification, 'movimentacao_especial')
  assert.equal(by('ANA LIMA').classification, 'movimentacao_especial')
  assert.equal(counts.endossos, 1); assert.equal(counts.cancelamentos, 1)
  assert.equal(counts.nao_consta_no_relatorio, 1)

  // divergência de prêmio
  const d = reconcile({ items: [items[0]], sales: [sale({ id: 'a', premium: 1900, gross_commission: 380 })], previousKeys: new Set(), keyOf: itemKey, referenceMonth: '2026-10-01' })
  assert.equal(d.rows[0].classification, 'divergencia')

  // não cadastrado
  const n = reconcile({ items: [items[0]], sales: [], previousKeys: new Set(), keyOf: itemKey, referenceMonth: '2026-10-01' })
  assert.equal(n.rows[0].classification, 'nao_cadastrado')

  // importação repetida
  const dup = reconcile({ items, sales, previousKeys: new Set(items.map(itemKey)), keyOf: itemKey, referenceMonth: '2026-10-01' })
  assert.equal(dup.counts.duplicado, 3)
})

test('mesmo cliente, propostas diferentes: casa pela proposta, não pelo nome', () => {
  const items = [parseLine(L1, 1)!, parseLine(L1.replace('123456', '555555').replace('2.000,00', '3.000,00').replace('400,00', '600,00'), 2)!]
  const sales = [sale({ id: 'a' }), sale({ id: 'b', proposal_number: '555555', premium: 3000, gross_commission: 600 })]
  const { rows } = reconcile({ items, sales, previousKeys: new Set(), keyOf: itemKey, referenceMonth: '2026-10-01' })
  assert.deepEqual(rows.map(r => [r.sale_id, r.classification]), [['a', 'conferido'], ['b', 'conferido']])
})

// ---- Relatório real: DIGITAL SUHAI - ITALLO CESAR - OUTUBRO (como o PDF chega) ----
const REAL = `PARCEIROS: DIGITAL SUHAI - ITALLO CESAR
ANÁLISE DE PRODUÇÃO - Apólices e endossos
Início de vigência: 01/10/2026 a 31/10/2026
Valores expressos em R$ Incluídos documentos emitidos cancelados, Não incluídos propostas Canceladas, Incluídos documentos cancelados por perda total, e Incluidos endossos de cancelamento
Cliente Dt.In.Vig Proposta Apolice Endosso Produto Neg/Itens Vigência Parc Prêmio (%) Comissão
SUHAI SEGURADORA S.A.
SEVERINO RAMOS LOURENCO BARBOSA30/10/2026 333171 AUTOMOVEL R 1 30/10/2026 30/10/2027 10 890,75 27,00 240,52
LUCIANO ALBUQUERQUE DA SILVA 30/10/2026 333175 AUTOMOVEL N 1 30/10/2026 30/10/2027 12 578,56 20,00 115,71
LUCIANO LUCAS SOUSA DE OLIVEIRA 27/10/2026 333016 AUTOMOVEL N 1 27/10/2026 27/10/2027 3 735,04 10,00 73,50
MATEUS DE OLIVEIRA LUNA 15/10/2026 332269 1003112784538 AUTOMOVEL N 0 15/10/2026 15/10/2027 3 349,43 10,00 34,94
MATEUS DE OLIVEIRA LUNA 19/10/2026 332761 1003112784538 4387812 AUTOMOVEL EN 1 19/10/2026 15/10/2027 0 0,00 10,00 0,00
MARCIO BARROSO 13/10/2026 332362 1003112786507 AUTOMOVEL N 1 13/10/2026 13/10/2027 3 1.560,06 10,00 156,01
JOSE GABRIEL ALVES SOARES 16/10/2026 332346 1003112793908 AUTOMOVEL N 1 16/10/2026 16/10/2027 3 518,57 15,00 77,79
MIRELA DE SOUZA BARBOSA 16/10/2026 332344 1003112793910 AUTOMOVEL N 1 16/10/2026 16/10/2027 6 258,60 25,00 64,65
PAULO ROBERTO RODRIGUES DE ALBUQUERQUE 17/10/2026 332367 1003112795050 AUTOMOVEL N 1 17/10/2026 17/10/2027 6 1.183,58 10,00 118,36
PEDRO GABRIEL CARDOSO DE ARAUJO 19/10/2026 332400 1003112801451 AUTOMOVEL N 1 19/10/2026 19/10/2027 12 617,01 15,00 92,55
MARCOS DAVI GOMES DOS SANTOS 22/10/2026 332610 1003112821211 AUTOMOVEL N 1 22/10/2026 22/10/2027 12 920,48 15,00 138,08
EVERTON MARQUES PEDRO 27/10/2026 332852 1003112841195 AUTOMOVEL N 1 27/10/2026 27/10/2027 11 2.798,89 10,00 279,89
JOAO JOSE DE SANTANA FILHO 23/10/2026 332690 12405323 AUTOMOVEL N 1 23/10/2026 23/10/2027 12 600,37 10,00 60,04
JOAO JOSE DE SANTANA FILHO 29/10/2026 332995 12405323 01 AUTOMOVEL CN 0 29/10/2026 23/10/2027 1 -600,37 10,00 -60,04
Total seguradora: 12 14 10.410,97 13,37 1.392,00
Total divisão: 12 14 10.410,97 13,37 1.392,00
Total Seguros Novos: 11 13 9.520,22 12,10 1.151,48
Total Renovações: 1 1 890,75 27,00 240,52
Total período: 12 14 10.410,97 13,37 1.392,00
Legenda - Tipos de negócio
N = Seguro novo / Renovação de outra corretora
EN = Endosso/Fatura de seguro novo ou de renovação de outra corretora
CN = Endosso de cancelamento de seguro novo ou de renovação de outra corretora
R = Renovação da própria corretora
ER = Endosso/Fatura de renovação da própria corretora
CR = Endosso de cancelamento de renovação da própria corretora
03/11/2026 19:52:20 Pág. 1/1`.split('\n')

test('relatório real de outubro: 14 documentos, nada sobra, bate com o total do PDF', () => {
  const r = parseReportText(REAL)
  assert.equal(r.items.length, 14)
  assert.deepEqual(r.unparsed, [])
  assert.equal(r.period_start, '2026-10-01'); assert.equal(r.period_end, '2026-10-31'); assert.equal(r.reference_month, '2026-10-01')
  assert.deepEqual(r.totals, { policies: 12, documents: 14, premium: 10410.97, commission: 1392 })
  const round = (n: number) => Math.round(n * 100) / 100
  assert.equal(round(r.items.reduce((a, i) => a + i.premium, 0)), 10410.97)
  assert.equal(round(r.items.reduce((a, i) => a + i.commission, 0)), 1392)

  const by = (proposal: string) => r.items.find(i => i.proposal_number === proposal)!
  const ren = by('333171')      // nome colado na data + renovação própria + sem apólice
  assert.equal(ren.client_name, 'SEVERINO RAMOS LOURENCO BARBOSA'); assert.equal(ren.movement_code, 'R')
  assert.equal(ren.policy_number, null); assert.equal(ren.installments, 10); assert.equal(ren.commission_percent, 27); assert.equal(ren.needs_review, false)
  assert.equal(by('332269').policy_number, '1003112784538')
  const en = by('332761')
  assert.equal(en.movement_code, 'EN'); assert.equal(en.endorsement_number, '4387812'); assert.equal(en.premium, 0); assert.equal(en.installments, 0); assert.equal(en.needs_review, false)
  assert.equal(by('332690').policy_number, '12405323')
  const cn = by('332995')       // endosso de 2 dígitos ("01") e valores negativos
  assert.equal(cn.movement_code, 'CN'); assert.equal(cn.endorsement_number, '01'); assert.equal(cn.premium, -600.37); assert.equal(cn.commission, -60.04)
  assert.equal(cn.vigencia_start, '2026-10-29'); assert.equal(cn.vigencia_end, '2027-10-23'); assert.equal(cn.needs_review, false)
  assert.equal(r.items.filter(i => i.needs_review).length, 0)
})
