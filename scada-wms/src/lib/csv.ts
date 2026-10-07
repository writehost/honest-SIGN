// Minimal RFC-4180 parser. Detects ; or , (Excel in RU locale saves with ;).

export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '')
  const firstLine = src.split(/\r?\n/, 1)[0] ?? ''
  const sep = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ';' : ','
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let q = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (q) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++ }
      else if (ch === '"') q = false
      else cell += ch
    } else if (ch === '"') q = true
    else if (ch === sep) { row.push(cell); cell = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(cell); cell = ''
      if (row.some((c) => c.trim())) rows.push(row)
      row = []
    } else cell += ch
  }
  row.push(cell)
  if (row.some((c) => c.trim())) rows.push(row)
  return rows
}

/** Maps header names (RU/EN, any case) to field keys. */
export function mapHeader(header: string[], aliases: Record<string, string[]>) {
  const norm = (s: string) => s.trim().toLowerCase().replace(/[\s_\-./]+/g, '')
  const map: Record<string, number> = {}
  header.forEach((h, i) => {
    for (const [key, names] of Object.entries(aliases))
      if (map[key] === undefined && names.some((n) => norm(n) === norm(h))) map[key] = i
  })
  return map
}

export function toCsv(rows: (string | number)[][]) {
  return '﻿' + rows.map((r) => r.map((c) => {
    const s = String(c ?? '')
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }).join(';')).join('\n')
}

export function download(name: string, content: string | Blob, type = 'text/csv;charset=utf-8') {
  const blob = typeof content === 'string' ? new Blob([content], { type }) : content
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}
