import QRCode from 'qrcode'
import { jsPDF } from 'jspdf'

import type { LabelFormat } from './labelFormats'

async function qrPng(text: string) {
  return QRCode.toDataURL(text, { errorCorrectionLevel: 'M', margin: 0, scale: 6, color: { dark: '#000000', light: '#ffffff' } })
}

/** Label = code + QR, nothing else. Big mono code so it reads from 2 metres. */
export async function labelsPdf(codes: string[], format: LabelFormat): Promise<Blob> {
  if (format === 'a4') {
    const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
    const cols = 3, rows = 8, w = 70, h = 37
    for (let i = 0; i < codes.length; i++) {
      if (i > 0 && i % (cols * rows) === 0) doc.addPage()
      const k = i % (cols * rows)
      const x = (k % cols) * w, y = 0.5 + Math.floor(k / cols) * h
      const img = await qrPng(codes[i])
      doc.addImage(img, 'PNG', x + 4, y + 4, 29, 29, undefined, 'FAST')
      doc.setFont('courier', 'bold')
      fitText(doc, codes[i], x + 36, y + h / 2 + 2.5, w - 39, 22)
    }
    return doc.output('blob')
  }
  const h = format === 'thermal58x40' ? 40 : 30
  const doc = new jsPDF({ unit: 'mm', format: [58, h], orientation: 'landscape', compress: true })
  for (let i = 0; i < codes.length; i++) {
    if (i > 0) doc.addPage([58, h], 'landscape')
    const img = await qrPng(codes[i])
    doc.setFont('courier', 'bold')
    if (format === 'thermal58x40') {
      // Code across the top — readable from the aisle; QR under it
      fitText(doc, codes[i], 3, 11, 52, 34, 'center')
      doc.addImage(img, 'PNG', (58 - 25) / 2, 13.5, 25, 25, undefined, 'FAST')
    } else {
      const q = 24
      doc.addImage(img, 'PNG', 3, (h - q) / 2, q, q, undefined, 'FAST')
      fitText(doc, codes[i], q + 6, h / 2 + 2.5, 58 - q - 9, 24)
    }
  }
  return doc.output('blob')
}

function fitText(doc: jsPDF, text: string, x: number, y: number, maxW: number, maxPt: number, align?: 'center') {
  let pt = maxPt
  doc.setFontSize(pt)
  while (doc.getTextWidth(text) > maxW && pt > 6) doc.setFontSize(--pt)
  if (align === 'center') doc.text(text, x + maxW / 2, y, { align: 'center' })
  else doc.text(text, x, y)
}
