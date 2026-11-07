import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export interface Table { title: string; headers: string[]; rows: (string | number)[][] }

function download(blob: Blob, name: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
export function toCSV(t: Table, name: string) {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
  const body = [t.headers, ...t.rows].map(r => r.map(esc).join(';')).join('\n')
  download(new Blob(['\ufeff' + body], { type: 'text/csv;charset=utf-8' }), name + '.csv')
}
export function toXLSX(t: Table, name: string) {
  const ws = XLSX.utils.aoa_to_sheet([t.headers, ...t.rows])
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, t.title.slice(0, 31))
  XLSX.writeFile(wb, name + '.xlsx')
}
export function toPDF(t: Table, name: string, subtitle = '') {
  const doc = new jsPDF({ orientation: 'landscape' })
  doc.setFontSize(14); doc.text(t.title, 14, 15)
  if (subtitle) { doc.setFontSize(9); doc.text(subtitle, 14, 21) }
  autoTable(doc, { head: [t.headers], body: t.rows.map(r => r.map(String)), startY: 25, styles: { fontSize: 8 } })
  doc.save(name + '.pdf')
}
