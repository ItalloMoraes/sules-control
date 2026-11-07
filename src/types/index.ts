export type SaleStatus = 'pendente' | 'emitida' | 'cancelada'
export type Origin = 'digital_suhai' | 'venda_propria'
export type ReversalStatus = 'pendente' | 'efetivado' | 'cancelado'
export type MovementCode = 'N' | 'EN' | 'CN' | 'R' | 'ER' | 'CR'
export type Classification =
  | 'conferido' | 'divergencia' | 'nao_cadastrado'
  | 'nao_consta_no_relatorio' | 'movimentacao_especial' | 'duplicado'

export interface Insurer { id: string; name: string; is_default: boolean; active: boolean }
export interface Product { id: string; name: string; active: boolean }
export interface Client {
  id: string; full_name: string; cpf: string | null; phone: string | null
  email: string | null; notes: string | null; archived_at: string | null; created_at: string
}
export interface Sale {
  id: string; client_id: string; insurer_id: string; product_id: string
  sale_date: string; policy_start_date: string | null
  vehicle_description: string | null; plate: string | null
  proposal_number: string | null; policy_number: string | null; endorsement_number: string | null
  premium: number; insurer_percent: number; broker_percent: number
  gross_commission: number; net_commission: number
  origin: Origin; status: SaleStatus; notes: string | null
  created_at: string; updated_at: string
  clients?: { full_name: string } | null
  insurers?: { name: string } | null
  products?: { name: string } | null
}
export interface Receipt {
  id: string; sale_id: string; amount: number; received_at: string
  reference: string | null; notes: string | null; over_limit_justification: string | null
}
export interface Cancellation {
  id: string; sale_id: string; cancelled_at: string; reason: string | null
  received_at_cancellation: number; net_at_cancellation: number; lost_commission: number
}
export interface Reversal {
  id: string; cancellation_id: string; sale_id: string; amount: number
  reversal_date: string | null; status: ReversalStatus; justification: string
}
export interface Settings {
  broker_name: string | null; broker_percent: number; default_insurer_id: string | null
  suggested_insurer_percent: number | null; theme: 'dark' | 'light'
  goal_net_basis: 'generated' | 'after_reversals'
}
export interface Goal {
  id: string; month: string; target_count: number | null; target_premium: number | null
  target_gross: number | null; target_net: number | null; net_basis: 'generated' | 'after_reversals'
}

export interface ParsedItem {
  line_no: number
  client_name: string
  policy_start_date: string | null
  proposal_number: string | null
  policy_number: string | null
  endorsement_number: string | null
  product: string | null
  movement_code: MovementCode
  vigencia_start: string | null
  vigencia_end: string | null
  installments: number | null
  premium: number
  commission_percent: number
  commission: number
  needs_review: boolean
  raw: string
}
export interface ParsedReport {
  period_start: string | null
  period_end: string | null
  reference_month: string | null
  items: ParsedItem[]
  unparsed: { line_no: number; text: string }[]
  /** "Total período" impresso no próprio relatório, para conferir a leitura. */
  totals: { policies: number; documents: number; premium: number; commission: number } | null
}
export interface Difference { field: string; report: unknown; system: unknown; severity: 'divergencia' | 'info' }
export interface ReconRow {
  item: ParsedItem | null
  sale_id: string | null
  classification: Classification
  match_rule: string | null
  differences: Difference[]
}
