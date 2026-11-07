import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export async function sha256(file: File): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
}

/** Agrupa os fragmentos de texto por posição vertical → uma linha de tabela por registro. */
export async function extractLines(file: File, onProgress?: (msg: string) => void): Promise<{ lines: string[]; usedOcr: boolean }> {
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
  const lines: string[] = []
  for (let p = 1; p <= doc.numPages; p++) {
    onProgress?.(`Lendo página ${p} de ${doc.numPages}…`)
    const page = await doc.getPage(p)
    const content = await page.getTextContent()
    const rows = new Map<number, { x: number; s: string }[]>()
    for (const it of content.items as { str: string; transform: number[] }[]) {
      if (!it.str.trim()) continue
      const y = Math.round(it.transform[5] / 3)           // tolerância vertical
      rows.set(y, [...(rows.get(y) ?? []), { x: it.transform[4], s: it.str }])
    }
    ;[...rows.entries()].sort((a, b) => b[0] - a[0])      // topo → base
      .forEach(([, cells]) => lines.push(cells.sort((a, b) => a.x - b.x).map(c => c.s.trim()).join(' ')))
  }
  if (lines.join('').replace(/\s/g, '').length > 80) return { lines, usedOcr: false }

  // PDF escaneado: OCR (tesseract.js carregado sob demanda)
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('por')
  const ocr: string[] = []
  for (let p = 1; p <= doc.numPages; p++) {
    onProgress?.(`OCR da página ${p} de ${doc.numPages}…`)
    const page = await doc.getPage(p)
    const viewport = page.getViewport({ scale: 2.2 })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width; canvas.height = viewport.height
    await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise
    const { data } = await worker.recognize(canvas)
    ocr.push(...data.text.split('\n'))
  }
  await worker.terminate()
  return { lines: ocr, usedOcr: true }
}
