import { supabase, fail } from './supabase'
import { itemKey } from '@/utils/reportParser'
import { reconcile, compareItem, type SaleLite } from '@/utils/reconcile'
import type { ParsedItem, ParsedReport, Sale, ReconRow } from '@/types'

export function toSaleLite(s: Sale): SaleLite {
  return {
    id: s.id, client_name: s.clients?.full_name ?? '', sale_date: s.sale_date, policy_start_date: s.policy_start_date,
    proposal_number: s.proposal_number, policy_number: s.policy_number, endorsement_number: s.endorsement_number,
    premium: s.premium, insurer_percent: s.insurer_percent, gross_commission: s.gross_commission,
    status: s.status, origin: s.origin, insurer_id: s.insurer_id,
  }
}

export async function findExistingByHash(hash: string): Promise<{ id: string; file_name: string } | null> {
  const { data, error } = await supabase.from('production_reports').select('id,file_name').eq('file_hash', hash).maybeSingle()
  fail(error); return data
}

async function previousKeys(): Promise<Set<string>> {
  const { data, error } = await supabase.from('production_report_items').select('item_key')
  fail(error); return new Set((data ?? []).map((r: { item_key: string }) => r.item_key))
}

/** Importa o relatório já revisado pelo usuário. NÃO cria vendas nem recebimentos. */
export async function importReport(opts: {
  file: File; hash: string; parsed: ParsedReport; items: ParsedItem[]; insurerId: string | null; sales: Sale[]
}): Promise<string> {
  const { file, hash, parsed, items, insurerId, sales } = opts
  const { data: u } = await supabase.auth.getUser()
  const uid = u.user!.id
  const prevKeys = await previousKeys()

  const path = `${uid}/${hash}.pdf`
  const up = await supabase.storage.from('production-reports').upload(path, file, { contentType: 'application/pdf', upsert: false })
  if (up.error && !/exists/i.test(up.error.message)) throw new Error(up.error.message)

  const ref = parsed.reference_month ?? new Date().toISOString().slice(0, 7) + '-01'
  const { data: rep, error } = await supabase.from('production_reports').insert({
    insurer_id: insurerId, reference_month: ref, period_start: parsed.period_start, period_end: parsed.period_end,
    file_name: file.name, file_hash: hash, storage_path: path,
  }).select('id').single()
  fail(error)
  const reportId = rep!.id as string

  const { data: inserted, error: e2 } = await supabase.from('production_report_items').insert(items.map(i => ({
    report_id: reportId, line_no: i.line_no, item_key: itemKey(i), client_name: i.client_name,
    policy_start_date: i.policy_start_date, proposal_number: i.proposal_number, policy_number: i.policy_number,
    endorsement_number: i.endorsement_number, product: i.product, movement_code: i.movement_code,
    vigencia_start: i.vigencia_start, vigencia_end: i.vigencia_end, installments: i.installments,
    premium: i.premium, commission_percent: i.commission_percent, commission: i.commission,
    raw: { line: i.raw, premium: i.premium, commission: i.commission, commission_percent: i.commission_percent, client_name: i.client_name },
  }))).select('id,line_no')
  fail(e2)
  const idByLine = new Map((inserted ?? []).map((r: { id: string; line_no: number }) => [r.line_no, r.id]))

  const { rows, counts } = reconcile({ items, sales: sales.map(toSaleLite), previousKeys: prevKeys, keyOf: itemKey, referenceMonth: ref, insurerId })
  const { data: rec, error: e3 } = await supabase.from('production_reconciliations').insert({ report_id: reportId, summary: counts }).select('id').single()
  fail(e3)
  const out = rows.map((r: ReconRow) => ({
    reconciliation_id: rec!.id, report_item_id: r.item ? idByLine.get(r.item.line_no) : null, sale_id: r.sale_id,
    classification: r.classification, match_rule: r.match_rule, differences: r.differences,
  }))
  if (out.length) fail((await supabase.from('production_reconciliation_items').insert(out)).error)
  return reportId
}

export { compareItem }
