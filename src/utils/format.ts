export const TZ = 'America/Recife'

export function brl(v: number | null | undefined): string {
  return (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
export function pct(v: number | null | undefined, digits = 1): string {
  return `${(v ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: digits })}%`
}
/** 'YYYY-MM-DD' -> 'DD/MM/AAAA' sem passar por Date (evita deslocamento de fuso). */
export function dateBR(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}
export function todayISO(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
}
export function monthStart(iso: string): string { return iso.slice(0, 7) + '-01' }
export function monthEnd(iso: string): string {
  const [y, m] = iso.slice(0, 7).split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return `${iso.slice(0, 7)}-${String(last).padStart(2, '0')}`
}
export function addMonths(iso: string, n: number): string {
  const [y, m] = iso.slice(0, 7).split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + n, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`
}
export function monthLabel(iso: string): string {
  const [y, m] = iso.slice(0, 7).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' })
}

export const onlyDigits = (v?: string | null) => (v ?? '').replace(/\D/g, '')
/** Máscara de CPF enquanto digita: 000.000.000-00 */
export function maskCpf(v?: string | null): string {
  const d = onlyDigits(v).slice(0, 11)
  return d.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1-$2')
}
/** CPF para exibir e copiar: formatado quando tem 11 dígitos, do contrário como está. */
export function formatCpf(v?: string | null): string {
  return onlyDigits(v).length === 11 ? maskCpf(v) : (v ?? '')
}
/** Lê valores no padrão brasileiro: "1.234,56", "R$ 1.234,56", "1234,5", "1.234" e também "12.5". */
export function parseBRL(s: string): number {
  let t = s.replace(/[^\d.,-]/g, '')
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '')
  const n = parseFloat(t)
  return Number.isFinite(n) ? n : 0
}
