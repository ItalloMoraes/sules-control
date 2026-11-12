/**
 * Feriados nacionais do Brasil ('AAAA-MM-DD'): datas fixas (Lei 662/1949; Consciência Negra desde 2024, Lei 14.759/2023)
 * mais a Sexta-feira Santa. Carnaval e Corpus Christi são ponto facultativo, então ficam de fora.
 */
function easter(year: number): [number, number] {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451)
  return [Math.floor((h + l - 7 * m + 114) / 31), ((h + l - 7 * m + 114) % 31) + 1]
}
/** data -> nome do feriado */
export function nationalHolidayNames(year: number): Record<string, string> {
  const iso = (m: number, d: number) => `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  const [em, ed] = easter(year)
  const out: Record<string, string> = {
    [iso(1, 1)]: 'Confraternização Universal',
    [new Date(Date.UTC(year, em - 1, ed - 2)).toISOString().slice(0, 10)]: 'Sexta-feira Santa',
    [iso(4, 21)]: 'Tiradentes', [iso(5, 1)]: 'Dia do Trabalho', [iso(9, 7)]: 'Independência do Brasil',
    [iso(10, 12)]: 'Nossa Senhora Aparecida', [iso(11, 2)]: 'Finados', [iso(11, 15)]: 'Proclamação da República', [iso(12, 25)]: 'Natal',
  }
  if (year >= 2024) out[iso(11, 20)] = 'Consciência Negra'
  return out
}
export const nationalHolidays = (year: number): string[] => Object.keys(nationalHolidayNames(year)).sort()
