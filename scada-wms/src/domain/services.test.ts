import { beforeEach, describe, expect, it } from 'vitest'
import { emptyDB, initStore, DomainError, getDB } from './db'
import * as S from './services'
import { seedDemo } from './seed'
import type { Ctx } from './types'

function fresh() {
  initStore(emptyDB, null)
  const { orgId, userId } = S.registerOrganization({ orgName: 'Тест', userName: 'Владелец', email: 'o@t.ru' })
  const owner: Ctx = { orgId, userId }
  const wh = S.createWarehouse(owner, { name: 'Склад', address: '' })
  S.createCellRange(owner, { warehouseId: wh, zone: 'A', rackFrom: 1, rackTo: 1, placeFrom: 1, placeTo: 2 })
  const tee = S.createProduct(owner, { name: 'Футболка XL', sku: 'SKU-1', article: '', brand: '', category: '', unit: 'шт', barcodes: ['4600000000011'] })
  const other = S.createProduct(owner, { name: 'Футболка L', sku: 'SKU-2', article: '', brand: '', category: '', unit: 'шт', barcodes: ['4600000000028'] })
  const sc = () => S.readScope(owner)
  const cell = (code: string) => sc().cells.find((c) => c.code === code)!
  return { owner, tee, other, sc, cell }
}

const err = (fn: () => unknown) => {
  try { fn() } catch (e) { return e as DomainError }
  throw new Error('expected DomainError')
}

describe('key scenario', () => {
  let t: ReturnType<typeof fresh>
  beforeEach(() => { t = fresh() })

  it('receive → order → pick with wrong product refused → pack → packed', () => {
    const { owner, tee, other, sc, cell } = t
    expect(S.cellRangeCodes({ zone: 'a', rackFrom: 1, rackTo: 1, placeFrom: 1, placeTo: 2 })).toEqual(['A-01-01', 'A-01-02'])
    S.receive(owner, { productId: tee, qty: 20, cellId: cell('A-01-01').id })
    expect(S.productStock(sc(), tee).cells.map((c) => [c.cell.code, c.qty])).toEqual([['A-01-01', 20]])

    const { id: orderId, released } = S.createOrder(owner, { channel: 'manual', customer: 'X', items: [{ productId: tee, qty: 2 }] })
    expect(released).toBe(true)
    expect(S.productStock(sc(), tee)).toMatchObject({ total: 20, reserved: 2, available: 18 })

    const taskId = S.startPicking(owner, orderId)
    expect(err(() => S.confirmPick(owner, { taskId, lineId: 'x', cellId: 'x', productId: tee, qty: 1 })).code).toBe('NO_CONTAINER')
    S.bindContainer(owner, taskId, null)
    const line = sc().pickTasks.find((x) => x.id === taskId)!.lines[0]
    expect(sc().cells.find((c) => c.id === line.cellId)!.code).toBe('A-01-01')

    expect(err(() => S.confirmPick(owner, { taskId, lineId: line.id, cellId: cell('A-01-02').id, productId: tee, qty: 2 })).code).toBe('WRONG_CELL')
    const before = structuredClone(getDB())
    expect(err(() => S.confirmPick(owner, { taskId, lineId: line.id, cellId: line.cellId, productId: other, qty: 1 })).code).toBe('WRONG_PRODUCT')
    expect(getDB()).toEqual(before) // refused op leaves no trace

    S.confirmPick(owner, { taskId, lineId: line.id, cellId: line.cellId, productId: tee, qty: 2 })
    expect(sc().orders[0].status).toBe('picked')

    expect(err(() => S.completePacking(owner, orderId, { [tee]: 1 }, 0)).code).toBe('MISSING')
    expect(err(() => S.completePacking(owner, orderId, { [tee]: 2 }, 1)).code).toBe('EXTRA')
    expect(err(() => S.completePacking(owner, orderId, { [tee]: 2, [other]: 1 }, 0)).code).toBe('EXTRA')
    S.completePacking(owner, orderId, { [tee]: 2 }, 0)
    expect(sc().orders[0].status).toBe('packed')
    expect(S.productStock(sc(), tee)).toMatchObject({ inCells: 18, inBoxes: 2, reserved: 0 })

    S.shipOrders(owner, [orderId])
    expect(S.productStock(sc(), tee).total).toBe(18)
    expect(sc().movements.map((m) => m.type)).toEqual(['receipt', 'pick', 'pack', 'ship'])
  })

  it('order with too little stock stays «Новый»', () => {
    const { owner, tee, cell, sc } = t
    S.receive(owner, { productId: tee, qty: 1, cellId: cell('A-01-01').id })
    const r = S.createOrder(owner, { channel: 'manual', customer: '', items: [{ productId: tee, qty: 3 }] })
    expect(r.released).toBe(false)
    expect(sc().orders[0].status).toBe('new')
  })

  it('move refuses reserved stock and inventory finds foreign goods', () => {
    const { owner, tee, other, cell, sc } = t
    S.receive(owner, { productId: tee, qty: 5, cellId: cell('A-01-01').id })
    S.receive(owner, { productId: other, qty: 3, cellId: cell('A-01-02').id })
    S.createOrder(owner, { channel: 'manual', customer: '', items: [{ productId: tee, qty: 4 }] })
    expect(err(() => S.move(owner, { productId: tee, fromCellId: cell('A-01-01').id, toCellId: cell('A-01-02').id, qty: 2 })).code).toBe('NOT_ENOUGH')
    S.move(owner, { productId: tee, fromCellId: cell('A-01-01').id, toCellId: cell('A-01-02').id, qty: 1 })

    const d = S.diffCell(sc(), cell('A-01-01').id, { [tee]: 4, [other]: 1 })
    expect(d.find((x) => x.productId === other)).toMatchObject({ verdict: 'foreign', elsewhere: [{ qty: 3 }] })
    const sess = S.startInventory(owner)
    expect(S.commitCellCount(owner, sess, cell('A-01-01').id, { [tee]: 4, [other]: 1 })).toBe(1)
    expect(S.cellContents(sc(), cell('A-01-01').id).map((x) => [x.product.sku, x.qty])).toEqual([['SKU-2', 1], ['SKU-1', 4]])
  })

  it('products with history cannot be deleted; tenants are isolated', () => {
    const { owner, tee, cell } = t
    S.receive(owner, { productId: tee, qty: 1, cellId: cell('A-01-01').id })
    expect(err(() => S.deleteProduct(owner, tee)).code).toBe('HAS_HISTORY')
    const b = S.registerOrganization({ orgName: 'Другая', userName: 'B', email: '' })
    expect(S.readScope({ orgId: b.orgId }).products).toHaveLength(0)
    expect(S.resolveCode(S.readScope({ orgId: b.orgId }), '4600000000011').kind).toBe('unknown')
  })

  it('demo seed builds a consistent tenant', () => {
    initStore(emptyDB, null)
    const { orgId } = seedDemo()
    const s = S.readScope({ orgId })
    expect(s.orders.filter((o) => o.status === 'to_pick').length).toBe(8)
    expect(s.orders.filter((o) => o.status === 'new').length).toBe(1)
    expect(s.stock.every((b) => b.qty >= b.reserved && b.qty >= 0)).toBe(true)
  })
})
