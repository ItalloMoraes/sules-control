/** Dias úteis (seg–sex) excluindo feriados informados ('YYYY-MM-DD'). */
export function businessDaysBetween(from: string, to: string, holidays: Set<string> = new Set()): number {
  let n = 0
  const [fy, fm, fd] = from.split('-').map(Number)
  const [ty, tm, td] = to.split('-').map(Number)
  const end = Date.UTC(ty, tm - 1, td)
  for (let t = Date.UTC(fy, fm - 1, fd); t <= end; t += 86400000) {
    const d = new Date(t)
    const dow = d.getUTCDay()
    const iso = d.toISOString().slice(0, 10)
    if (dow !== 0 && dow !== 6 && !holidays.has(iso)) n++
  }
  return n
}
