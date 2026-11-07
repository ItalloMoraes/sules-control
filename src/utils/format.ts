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
