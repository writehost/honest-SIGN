import type { Scoped } from '@/domain/db'
import type { Loc, MovementType, StockMovement } from '@/domain/types'

export const MOVEMENT_LABEL: Record<MovementType, string> = {
  receipt: 'Приёмка',
  move: 'Перемещение',
  pick: 'Сборка',
  pack: 'Упаковка',
  ship: 'Отгрузка',
  adjust: 'Инвентаризация',
}

export function locCode(s: Scoped, l?: Loc) {
  if (!l) return ''
  if (l.type === 'cell') return s.cells.find((c) => c.id === l.id)?.code ?? '?'
  return s.containers.find((c) => c.id === l.id)?.code ?? '?'
}

export function describe(s: Scoped, m: StockMovement) {
  const product = s.products.find((p) => p.id === m.productId)
  const user = s.users.find((u) => u.id === m.userId)
  const order = m.docType === 'order' ? s.orders.find((o) => o.id === m.docId) : undefined
  const receipt = m.docType === 'receipt' ? s.receipts.find((r) => r.id === m.docId) : undefined
  const doc = order ? `Заказ №${order.number}` : receipt ? `Поставка ${receipt.number}` : m.docType === 'inventory' ? 'Инвентаризация' : m.note ?? ''
  return {
    product,
    user,
    from: locCode(s, m.from),
    to: locCode(s, m.to),
    fromType: m.from?.type,
    toType: m.to?.type,
    doc,
    sign: m.type === 'adjust' ? (m.to ? '+' : '−') : m.type === 'ship' ? '−' : m.type === 'receipt' ? '+' : '',
  }
}
