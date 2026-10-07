import type { Scoped } from '@/domain/db'
import type { DemoCode } from '@/scan/ScanPad'
import type { ID } from '@/domain/types'

// Builds the list behind the «Демо-скан» button: the right code first,
// then a plausible wrong one, so the protection can be tried without labels.

export const barcodeOf = (s: Scoped, productId: ID) =>
  s.barcodes.find((b) => b.productId === productId)?.code ?? s.products.find((p) => p.id === productId)?.sku ?? ''

export function productCodes(s: Scoped, expectId?: ID, limit = 6): DemoCode[] {
  const list = s.products.filter((p) => !p.archived)
  const sorted = expectId ? [...list.filter((p) => p.id === expectId), ...similar(list, expectId)] : list
  return sorted.slice(0, limit).map((p, i) => ({
    code: barcodeOf(s, p.id),
    label: p.name,
    tone: expectId ? (i === 0 ? 'ok' : 'bad') : 'neutral',
  }))
}

function similar(list: Scoped['products'], id: ID) {
  const p = list.find((x) => x.id === id)
  const rest = list.filter((x) => x.id !== id)
  if (!p) return rest
  const score = (x: typeof p) => (x.brand === p.brand ? 2 : 0) + (x.category === p.category ? 1 : 0)
  return rest.sort((a, b) => score(b) - score(a))
}

export function cellCodes(s: Scoped, expectId?: ID, limit = 6): DemoCode[] {
  const cells = [...s.cells].sort((a, b) => a.code.localeCompare(b.code))
  const exp = cells.find((c) => c.id === expectId)
  const others = cells.filter((c) => c.id !== expectId)
  const pick = exp ? [exp, ...others.filter((c) => c.zoneId === exp.zoneId).slice(0, 2), ...others.filter((c) => c.zoneId !== exp.zoneId).slice(0, 1)] : cells.slice(0, limit)
  return pick.slice(0, limit).map((c, i) => ({ code: c.code, label: exp ? (i === 0 ? 'Нужная ячейка' : 'Соседняя ячейка') : 'Ячейка', tone: exp ? (i === 0 ? 'ok' : 'bad') : 'neutral' }))
}
