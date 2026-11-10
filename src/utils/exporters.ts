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
export function toXLSXBook(tables: Table[], name: string) {
  const wb = XLSX.utils.book_new()
  for (const t of tables) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([t.headers, ...t.rows]), t.title.slice(0, 31))
  XLSX.writeFile(wb, name + '.xlsx')
}
export function toXLSX(t: Table, name: string) {
  const ws = XLSX.utils.aoa_to_sheet([t.headers, ...t.rows])
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, t.title.slice(0, 31))
  XLSX.writeFile(wb, name + '.xlsx')
}
async function imgData(url: string): Promise<string | null> {
  try {
    const blob = await (await fetch(url)).blob()
    return await new Promise(res => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(blob) })
  } catch { return null }
}
/** PDF no visual do site: cabeçalho com marca e mascote, tabela verde com linhas alternadas e rodapé numerado. */
export async function toPDF(t: Table, name: string, subtitle = '', author = '', email = '') {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight()
  const G: [number, number, number] = [30, 138, 68], INK: [number, number, number] = [29, 29, 31], MUTE: [number, number, number] = [110, 110, 115]
  const mascot = await imgData('/mascote.png')
  const header = () => {
    doc.setFillColor(245, 247, 245); doc.rect(0, 0, W, 26, 'F'); doc.setFillColor(...G); doc.rect(0, 26, W, 1, 'F')
    let x = 12
    if (mascot) { const p = doc.getImageProperties(mascot), h = 18, w = (h * p.width) / p.height; doc.addImage(mascot, 'PNG', 12, 4, w, h); x += w + 4 }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(...G); doc.text('Su', x, 15)
    const sw = doc.getTextWidth('Su'); doc.setTextColor(...INK); doc.text('les Control', x + sw, 15)
    doc.setFontSize(9); doc.setTextColor(...MUTE); if (author) doc.text(`Corretor: ${author}${email ? '  ·  ' + email : ''}`, x, 21)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...INK); doc.text(t.title, W - 12, 12, { align: 'right' })
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...MUTE)
    if (subtitle) doc.text(subtitle, W - 12, 19, { align: 'right' })
  }
  autoTable(doc, {
    head: [t.headers], body: t.rows.map(r => r.map(String)), startY: 34, margin: { top: 34, left: 12, right: 12, bottom: 16 },
    theme: 'plain', styles: { fontSize: t.headers.length > 10 ? 6.5 : 8.5, cellPadding: 2.6, textColor: INK },
    headStyles: { fillColor: G, textColor: [255, 255, 255], fontStyle: 'bold' }, alternateRowStyles: { fillColor: [244, 248, 245] },
    didDrawPage: header,
  })
  const n = doc.getNumberOfPages()
  for (let i = 1; i <= n; i++) {
    doc.setPage(i); doc.setFontSize(8); doc.setTextColor(...MUTE)
    doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')} · Sules Control`, 12, H - 8)
    doc.text(`Página ${i} de ${n}`, W - 12, H - 8, { align: 'right' })
  }
  doc.save(name + '.pdf')
}
