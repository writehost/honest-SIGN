import { DomainError, now, scope, transact, uid, getDB } from './db'
import type { Scoped } from './db'
import { PLANS } from './plans'
import type {
  Cell, Channel, Ctx, DB, ID, Loc, MovementType, Order, OrderStatus, Product, Receipt, Role, StockBalance,
} from './types'

// ───────────────────────────── stock primitives ─────────────────────────────
// Only these functions touch StockBalance. Each change writes a StockMovement,
// so the journal and the balances can never disagree.

function balance(db: DB, orgId: ID, productId: ID, loc: Loc): StockBalance {
  let b = db.stock.find(
    (x) => x.orgId === orgId && x.productId === productId && x.locationType === loc.type && x.locationId === loc.id,
  )
  if (!b) {
    b = { orgId, productId, locationType: loc.type, locationId: loc.id, qty: 0, reserved: 0 }
    db.stock.push(b)
  }
  return b
}

function pruneEmpty(db: DB) {
  db.stock = db.stock.filter((b) => b.qty > 0 || b.reserved > 0)
}

function record(
  db: DB, ctx: Ctx, type: MovementType, productId: ID, qty: number,
  from?: Loc, to?: Loc, doc?: { docType: 'order' | 'receipt' | 'inventory'; docId: ID }, note?: string,
) {
  db.movements.push({
    id: uid('mv_'), orgId: ctx.orgId, ts: now(), userId: ctx.userId, type, productId, qty, from, to,
    docType: doc?.docType, docId: doc?.docId, note,
  })
}

function assertQty(qty: number) {
  if (!Number.isInteger(qty) || qty <= 0) throw new DomainError('BAD_QTY', 'Количество должно быть целым числом больше нуля')
}

const cellLoc = (id: ID): Loc => ({ type: 'cell', id })
const boxLoc = (id: ID): Loc => ({ type: 'container', id })

function mustFind<T>(x: T | undefined, what: string): T {
  if (!x) throw new DomainError('NOT_FOUND', `${what} не найден(а)`)
  return x
}

function orgOf(db: DB, ctx: Ctx) {
  return mustFind(db.orgs.find((o) => o.id === ctx.orgId), 'Организация')
}

// ─────────────────────────────── organization ───────────────────────────────

export function registerOrganization(input: { orgName: string; userName: string; email: string }) {
  if (!input.orgName.trim()) throw new DomainError('REQUIRED', 'Укажите название компании')
  if (!input.userName.trim()) throw new DomainError('REQUIRED', 'Укажите ваше имя')
  return transact((db) => {
    const orgId = uid('org_')
    const userId = uid('usr_')
    db.orgs.push({
      id: orgId, name: input.orgName.trim(), plan: 'start', createdAt: now(), onboardingDone: false,
      settings: { sound: true, vibration: true, quickReceive: false, demoScanner: true },
    })
    db.users.push({
      id: userId, orgId, name: input.userName.trim(), email: input.email.trim(), role: 'owner', active: true, createdAt: now(),
    })
    return { orgId, userId }
  })
}

export function updateOrg(ctx: Ctx, patch: Partial<Pick<DB['orgs'][number], 'name' | 'plan' | 'onboardingDone' | 'settings'>>) {
  return transact((db) => {
    const org = orgOf(db, ctx)
    Object.assign(org, patch)
  })
}

export function addUser(ctx: Ctx, input: { name: string; email: string; role: Role }) {
  return transact((db) => {
    const s = scope(db, ctx)
    const plan = PLANS[s.org!.plan]
    if (s.users.filter((u) => u.active).length >= plan.users)
      throw new DomainError('PLAN_LIMIT', `На тарифе ${plan.name} доступно пользователей: ${plan.users}. Перейдите на тариф выше.`)
    if (!input.name.trim()) throw new DomainError('REQUIRED', 'Укажите имя сотрудника')
    const id = uid('usr_')
    db.users.push({ id, orgId: ctx.orgId, name: input.name.trim(), email: input.email.trim(), role: input.role, active: true, createdAt: now() })
    return id
  })
}

export function setUserActive(ctx: Ctx, userId: ID, active: boolean) {
  return transact((db) => {
    const u = mustFind(db.users.find((x) => x.id === userId && x.orgId === ctx.orgId), 'Пользователь')
    if (u.id === ctx.userId) throw new DomainError('SELF', 'Нельзя отключить самого себя')
    u.active = active
  })
}

// ──────────────────────────────── warehouse ─────────────────────────────────

export function createWarehouse(ctx: Ctx, input: { name: string; address: string }) {
  return transact((db) => {
    const s = scope(db, ctx)
    const plan = PLANS[s.org!.plan]
    if (s.warehouses.length >= plan.warehouses)
      throw new DomainError('PLAN_LIMIT', `На тарифе ${plan.name} доступно складов: ${plan.warehouses}`)
    if (!input.name.trim()) throw new DomainError('REQUIRED', 'Укажите название склада')
    const id = uid('wh_')
    db.warehouses.push({ id, orgId: ctx.orgId, name: input.name.trim(), address: input.address.trim() })
    return id
  })
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0')

export interface CellRangeInput {
  warehouseId: ID
  zone: string
  rackFrom: number
  rackTo: number
  placeFrom: number
  placeTo: number
}

export function cellRangeCodes(i: Omit<CellRangeInput, 'warehouseId'>): string[] {
  const zone = i.zone.trim().toUpperCase()
  const out: string[] = []
  for (let r = Math.min(i.rackFrom, i.rackTo); r <= Math.max(i.rackFrom, i.rackTo); r++)
    for (let p = Math.min(i.placeFrom, i.placeTo); p <= Math.max(i.placeFrom, i.placeTo); p++)
      out.push(`${zone}-${pad(r)}-${pad(p)}`)
  return out
}

/** Creates A-01-01 … A-01-50 style cells. Existing codes are skipped, not duplicated. */
export function createCellRange(ctx: Ctx, input: CellRangeInput) {
  const zoneCode = input.zone.trim().toUpperCase()
  if (!/^[A-ZА-Я0-9]{1,4}$/.test(zoneCode)) throw new DomainError('BAD_ZONE', 'Зона — 1–4 буквы или цифры, например A')
  const codes = cellRangeCodes(input)
  if (codes.length > 2000) throw new DomainError('TOO_MANY', 'За один раз можно создать до 2000 ячеек')
  return transact((db) => {
    mustFind(db.warehouses.find((w) => w.id === input.warehouseId && w.orgId === ctx.orgId), 'Склад')
    let zone = db.zones.find((z) => z.orgId === ctx.orgId && z.warehouseId === input.warehouseId && z.code === zoneCode)
    if (!zone) {
      zone = { id: uid('zn_'), orgId: ctx.orgId, warehouseId: input.warehouseId, code: zoneCode, name: `Зона ${zoneCode}` }
      db.zones.push(zone)
    }
    const existing = new Set(db.cells.filter((c) => c.orgId === ctx.orgId).map((c) => c.code))
    const created: Cell[] = []
    for (const code of codes) {
      if (existing.has(code)) continue
      const c: Cell = { id: uid('cl_'), orgId: ctx.orgId, warehouseId: input.warehouseId, zoneId: zone.id, code, active: true }
      db.cells.push(c)
      created.push(c)
    }
    return { created, skipped: codes.length - created.length }
  })
}

export function createContainers(ctx: Ctx, count: number) {
  if (count < 1 || count > 500) throw new DomainError('BAD_QTY', 'Можно создать от 1 до 500 коробов')
  return transact((db) => {
    const nums = db.containers.filter((c) => c.orgId === ctx.orgId && c.code.startsWith('BOX-')).map((c) => parseInt(c.code.slice(4), 10) || 0)
    let next = Math.max(0, ...nums) + 1
    const created = []
    for (let i = 0; i < count; i++) {
      const c = { id: uid('bx_'), orgId: ctx.orgId, code: `BOX-${pad(next++, 4)}` }
      db.containers.push(c)
      created.push(c)
    }
    return created
  })
}

// ───────────────────────────────── catalog ──────────────────────────────────

export interface ProductInput {
  name: string
  article: string
  sku: string
  brand: string
  category: string
  unit: string
  weight?: number
  size?: string
  color?: string
  photo?: string
  swatch?: string
  marketplace?: Product['marketplace']
  barcodes: string[]
}

function validateProduct(db: DB, ctx: Ctx, input: ProductInput, selfId?: ID) {
  if (!input.name.trim()) throw new DomainError('REQUIRED', 'Укажите название товара')
  if (!input.sku.trim()) throw new DomainError('REQUIRED', 'Укажите SKU')
  const sku = input.sku.trim()
  const clash = db.products.find((p) => p.orgId === ctx.orgId && p.id !== selfId && p.sku.toLowerCase() === sku.toLowerCase())
  if (clash) throw new DomainError('DUPLICATE_SKU', `SKU ${sku} уже есть у товара «${clash.name}»`)
  const codes = input.barcodes.map((b) => b.trim()).filter(Boolean)
  if (new Set(codes).size !== codes.length) throw new DomainError('DUPLICATE_BARCODE', 'Штрихкоды повторяются')
  for (const code of codes) {
    const other = db.barcodes.find((b) => b.orgId === ctx.orgId && b.code === code && b.productId !== selfId)
    if (other) {
      const p = db.products.find((x) => x.id === other.productId)
      throw new DomainError('DUPLICATE_BARCODE', `Штрихкод ${code} уже привязан к «${p?.name}»`)
    }
  }
  return codes
}

export function createProduct(ctx: Ctx, input: ProductInput) {
  return transact((db) => createProductIn(db, ctx, input))
}

function createProductIn(db: DB, ctx: Ctx, input: ProductInput) {
  const s = scope(db, ctx)
  const plan = PLANS[s.org!.plan]
  if (s.products.filter((p) => !p.archived).length >= plan.products)
    throw new DomainError('PLAN_LIMIT', `На тарифе ${plan.name} — до ${plan.products} товаров`)
  const codes = validateProduct(db, ctx, input)
  const id = uid('pr_')
  db.products.push({
    id, orgId: ctx.orgId, name: input.name.trim(), article: input.article.trim(), sku: input.sku.trim(),
    brand: input.brand.trim(), category: input.category.trim(), unit: input.unit || 'шт', weight: input.weight,
    size: input.size?.trim() || undefined, color: input.color?.trim() || undefined, photo: input.photo, swatch: input.swatch,
    marketplace: input.marketplace ?? {}, archived: false, createdAt: now(),
  })
  for (const code of codes) db.barcodes.push({ id: uid('bc_'), orgId: ctx.orgId, productId: id, code })
  return id
}

export function updateProduct(ctx: Ctx, id: ID, input: ProductInput) {
  return transact((db) => {
    const p = mustFind(db.products.find((x) => x.id === id && x.orgId === ctx.orgId), 'Товар')
    const codes = validateProduct(db, ctx, input, id)
    Object.assign(p, {
      name: input.name.trim(), article: input.article.trim(), sku: input.sku.trim(), brand: input.brand.trim(),
      category: input.category.trim(), unit: input.unit || 'шт', weight: input.weight, size: input.size?.trim() || undefined,
      color: input.color?.trim() || undefined, photo: input.photo, marketplace: input.marketplace ?? p.marketplace,
    })
    db.barcodes = db.barcodes.filter((b) => !(b.orgId === ctx.orgId && b.productId === id))
    for (const code of codes) db.barcodes.push({ id: uid('bc_'), orgId: ctx.orgId, productId: id, code })
  })
}

export function setProductArchived(ctx: Ctx, id: ID, archived: boolean) {
  return transact((db) => {
    const p = mustFind(db.products.find((x) => x.id === id && x.orgId === ctx.orgId), 'Товар')
    if (archived && db.stock.some((b) => b.orgId === ctx.orgId && b.productId === id && b.qty > 0))
      throw new DomainError('HAS_STOCK', 'Товар есть на остатках. Сначала спишите или отгрузите его.')
    p.archived = archived
  })
}

/** Physical delete is allowed only for products that never moved. */
export function deleteProduct(ctx: Ctx, id: ID) {
  return transact((db) => {
    if (db.movements.some((m) => m.orgId === ctx.orgId && m.productId === id) ||
        db.orderItems.some((i) => i.orgId === ctx.orgId && i.productId === id))
      throw new DomainError('HAS_HISTORY', 'По товару уже были операции — его можно только архивировать')
    db.products = db.products.filter((p) => !(p.id === id && p.orgId === ctx.orgId))
    db.barcodes = db.barcodes.filter((b) => !(b.productId === id && b.orgId === ctx.orgId))
  })
}

export interface ImportResult { created: number; updated: number; errors: { row: number; message: string }[] }

/** Upsert by SKU. A bad row is reported and skipped; good rows are imported. */
export function importProducts(ctx: Ctx, rows: (ProductInput & { row: number })[]): ImportResult {
  return transact((db) => {
    const res: ImportResult = { created: 0, updated: 0, errors: [] }
    for (const r of rows) {
      try {
        const existing = db.products.find((p) => p.orgId === ctx.orgId && p.sku.toLowerCase() === r.sku.trim().toLowerCase())
        if (existing) {
          const merged = [...new Set([...db.barcodes.filter((b) => b.productId === existing.id).map((b) => b.code), ...r.barcodes])]
          const codes = validateProduct(db, ctx, { ...r, barcodes: merged }, existing.id)
          Object.assign(existing, {
            name: r.name.trim() || existing.name, article: r.article || existing.article, brand: r.brand || existing.brand,
            category: r.category || existing.category, size: r.size || existing.size, color: r.color || existing.color,
          })
          db.barcodes = db.barcodes.filter((b) => b.productId !== existing.id)
          for (const code of codes) db.barcodes.push({ id: uid('bc_'), orgId: ctx.orgId, productId: existing.id, code })
          res.updated++
        } else {
          createProductIn(db, ctx, r)
          res.created++
        }
      } catch (e) {
        res.errors.push({ row: r.row, message: e instanceof Error ? e.message : String(e) })
      }
    }
    return res
  })
}

// ─────────────────────────────── code lookup ────────────────────────────────

export type Resolved =
  | { kind: 'cell'; cell: Cell }
  | { kind: 'product'; product: Product; via: 'barcode' | 'sku' | 'article' }
  | { kind: 'container'; container: DB['containers'][number] }
  | { kind: 'order'; order: Order }
  | { kind: 'unknown'; code: string }

export function normalizeCode(raw: string) {
  return raw.trim().replace(/^(CELL|BOX|ORDER):/i, '')
}

/** One resolver for every scan box and the global search. */
export function resolveCode(s: Scoped, raw: string): Resolved {
  const code = normalizeCode(raw)
  const up = code.toUpperCase()
  if (!code) return { kind: 'unknown', code }
  const cell = s.cells.find((c) => c.code.toUpperCase() === up)
  if (cell) return { kind: 'cell', cell }
  const box = s.containers.find((c) => c.code.toUpperCase() === up)
  if (box) return { kind: 'container', container: box }
  const bc = s.barcodes.find((b) => b.code === code)
  if (bc) {
    const product = s.products.find((p) => p.id === bc.productId)
    if (product) return { kind: 'product', product, via: 'barcode' }
  }
  const num = up.replace(/^(ORD-|#|№)/, '')
  const order = s.orders.find((o) => o.number.toUpperCase() === num)
  if (order) return { kind: 'order', order }
  const bySku = s.products.find((p) => p.sku.toUpperCase() === up)
  if (bySku) return { kind: 'product', product: bySku, via: 'sku' }
  const byArt = s.products.find((p) => p.article && p.article.toUpperCase() === up)
  if (byArt) return { kind: 'product', product: byArt, via: 'article' }
  return { kind: 'unknown', code }
}

export function productStock(s: Scoped, productId: ID) {
  const rows = s.stock.filter((b) => b.productId === productId)
  const cells = rows
    .filter((b) => b.locationType === 'cell' && b.qty > 0)
    .map((b) => ({ cell: s.cells.find((c) => c.id === b.locationId)!, qty: b.qty, reserved: b.reserved }))
    .filter((x) => x.cell)
    .sort((a, b) => a.cell.code.localeCompare(b.cell.code))
  const inCells = cells.reduce((a, c) => a + c.qty, 0)
  const reserved = cells.reduce((a, c) => a + c.reserved, 0)
  const inBoxes = rows.filter((b) => b.locationType === 'container').reduce((a, b) => a + b.qty, 0)
  return { total: inCells + inBoxes, inCells, inBoxes, reserved, available: inCells - reserved, cells }
}

export function cellContents(s: Scoped, cellId: ID) {
  return s.stock
    .filter((b) => b.locationType === 'cell' && b.locationId === cellId && b.qty > 0)
    .map((b) => ({ product: s.products.find((p) => p.id === b.productId)!, qty: b.qty, reserved: b.reserved }))
    .filter((x) => x.product)
    .sort((a, b) => a.product.name.localeCompare(b.product.name))
}

/** Where to put received goods: a cell that already holds the SKU, else the first empty cell. */
export function suggestCell(s: Scoped, productId: ID): Cell | undefined {
  const own = s.stock
    .filter((b) => b.productId === productId && b.locationType === 'cell' && b.qty > 0)
    .sort((a, b) => b.qty - a.qty)[0]
  if (own) return s.cells.find((c) => c.id === own.locationId)
  const busy = new Set(s.stock.filter((b) => b.locationType === 'cell' && b.qty > 0).map((b) => b.locationId))
  const active = s.cells.filter((c) => c.active).sort((a, b) => a.code.localeCompare(b.code))
  return active.find((c) => !busy.has(c.id)) ?? active[0]
}

// ──────────────────────────────── receiving ─────────────────────────────────

export function createReceipt(ctx: Ctx, input: { supplier: string; lines: { productId: ID; expectedQty: number }[] }) {
  return transact((db) => {
    if (!input.lines.length) throw new DomainError('EMPTY', 'Добавьте хотя бы одну позицию')
    input.lines.forEach((l) => assertQty(l.expectedQty))
    const nums = db.receipts.filter((r) => r.orgId === ctx.orgId).map((r) => parseInt(r.number.replace(/\D/g, ''), 10) || 0)
    const number = `П-${pad(Math.max(0, ...nums) + 1, 4)}`
    const r: Receipt = {
      id: uid('rc_'), orgId: ctx.orgId, number, supplier: input.supplier.trim() || 'Без поставщика', status: 'expected',
      createdAt: now(), lines: input.lines.map((l) => ({ ...l, receivedQty: 0 })),
    }
    db.receipts.push(r)
    return r.id
  })
}

export function receive(ctx: Ctx, input: { productId: ID; qty: number; cellId: ID; receiptId?: ID }) {
  assertQty(input.qty)
  return transact((db) => {
    const p = mustFind(db.products.find((x) => x.id === input.productId && x.orgId === ctx.orgId), 'Товар')
    if (p.archived) throw new DomainError('ARCHIVED', `Товар «${p.name}» в архиве`)
    mustFind(db.cells.find((c) => c.id === input.cellId && c.orgId === ctx.orgId && c.active), 'Ячейка')
    balance(db, ctx.orgId, p.id, cellLoc(input.cellId)).qty += input.qty
    let doc: { docType: 'receipt'; docId: ID } | undefined
    if (input.receiptId) {
      const r = mustFind(db.receipts.find((x) => x.id === input.receiptId && x.orgId === ctx.orgId), 'Поставка')
      let line = r.lines.find((l) => l.productId === p.id)
      if (!line) {
        line = { productId: p.id, expectedQty: 0, receivedQty: 0 }
        r.lines.push(line)
      }
      line.receivedQty += input.qty
      r.status = 'in_progress'
      doc = { docType: 'receipt', docId: r.id }
    }
    record(db, ctx, 'receipt', p.id, input.qty, undefined, cellLoc(input.cellId), doc)
  })
}

export function closeReceipt(ctx: Ctx, receiptId: ID) {
  return transact((db) => {
    const r = mustFind(db.receipts.find((x) => x.id === receiptId && x.orgId === ctx.orgId), 'Поставка')
    r.status = 'done'
  })
}

// ───────────────────────────────── moving ───────────────────────────────────

export function move(ctx: Ctx, input: { productId: ID; fromCellId: ID; toCellId: ID; qty: number }) {
  assertQty(input.qty)
  return transact((db) => {
    if (input.fromCellId === input.toCellId) throw new DomainError('SAME_CELL', 'Ячейка назначения совпадает с исходной')
    const from = mustFind(db.cells.find((c) => c.id === input.fromCellId && c.orgId === ctx.orgId), 'Исходная ячейка')
    mustFind(db.cells.find((c) => c.id === input.toCellId && c.orgId === ctx.orgId && c.active), 'Ячейка назначения')
    const src = balance(db, ctx.orgId, input.productId, cellLoc(from.id))
    const free = src.qty - src.reserved
    if (input.qty > free)
      throw new DomainError('NOT_ENOUGH', src.reserved > 0
        ? `В ${from.code} свободно ${free} шт. — ещё ${src.reserved} шт. зарезервировано под заказы`
        : `В ${from.code} только ${src.qty} шт.`, { free })
    src.qty -= input.qty
    balance(db, ctx.orgId, input.productId, cellLoc(input.toCellId)).qty += input.qty
    record(db, ctx, 'move', input.productId, input.qty, cellLoc(input.fromCellId), cellLoc(input.toCellId))
    pruneEmpty(db)
  })
}

// ───────────────────────────────── orders ───────────────────────────────────

export const STATUS_LABEL: Record<OrderStatus, string> = {
  new: 'Новый', to_pick: 'К сборке', picking: 'Собирается', picked: 'Собран', packed: 'Упакован', shipped: 'Отгружен',
}

export const CHANNEL_LABEL: Record<Channel, string> = {
  manual: 'Вручную', site: 'Сайт', wb: 'Wildberries', ozon: 'Ozon', ym: 'Яндекс Маркет',
}

function event(db: DB, ctx: Ctx, order: Order, text: string) {
  order.events.push({ ts: now(), userId: ctx.userId, text })
  void db
}

function nextOrderNumber(db: DB, orgId: ID) {
  const nums = db.orders.filter((o) => o.orgId === orgId).map((o) => parseInt(o.number, 10) || 0)
  return String(Math.max(1580, ...nums) + 1)
}

export interface OrderInput {
  number?: string
  channel: Channel
  customer: string
  externalId?: string
  items: { productId: ID; qty: number }[]
}

function createOrderIn(db: DB, ctx: Ctx, input: OrderInput) {
  if (!input.items.length) throw new DomainError('EMPTY', 'В заказе нет позиций')
  input.items.forEach((i) => assertQty(i.qty))
  const number = input.number?.trim() || nextOrderNumber(db, ctx.orgId)
  if (db.orders.some((o) => o.orgId === ctx.orgId && o.number === number))
    throw new DomainError('DUPLICATE', `Заказ №${number} уже существует`)
  const merged = new Map<ID, number>()
  for (const i of input.items) {
    mustFind(db.products.find((p) => p.id === i.productId && p.orgId === ctx.orgId), 'Товар')
    merged.set(i.productId, (merged.get(i.productId) ?? 0) + i.qty)
  }
  const order: Order = {
    id: uid('or_'), orgId: ctx.orgId, number, channel: input.channel, status: 'new',
    customer: input.customer.trim(), createdAt: now(), externalId: input.externalId, events: [],
  }
  event(db, ctx, order, 'Заказ создан')
  db.orders.push(order)
  for (const [productId, qty] of merged)
    db.orderItems.push({ id: uid('oi_'), orgId: ctx.orgId, orderId: order.id, productId, qty, pickedQty: 0, packedQty: 0 })
  return order
}

export function createOrder(ctx: Ctx, input: OrderInput, release = true) {
  // Two steps on purpose: the order must survive even when stock is short.
  const id = transact((db) => createOrderIn(db, ctx, input).id)
  if (release) {
    try {
      releaseOrder(ctx, id)
    } catch (e) {
      if (!(e instanceof DomainError && e.code === 'SHORTAGE')) throw e
      return { id, released: false, shortage: e.message }
    }
  }
  return { id, released: release, shortage: undefined as string | undefined }
}

export function importOrders(ctx: Ctx, orders: (OrderInput & { row: number })[]): ImportResult {
  const res: ImportResult = { created: 0, updated: 0, errors: [] }
  for (const o of orders) {
    try {
      const r = createOrder(ctx, o, true)
      res.created++
      if (!r.released) res.errors.push({ row: o.row, message: `Заказ №${o.number} создан, но не передан в сборку: ${r.shortage}` })
    } catch (e) {
      res.errors.push({ row: o.row, message: e instanceof Error ? e.message : String(e) })
    }
  }
  return res
}

/**
 * Новый → К сборке. Reserves stock per cell and builds the pick route.
 * Allocation: one cell that covers the whole line if possible, otherwise the
 * fullest cells first — fewer stops for the picker.
 */
export function releaseOrder(ctx: Ctx, orderId: ID) {
  return transact((db) => {
    const order = mustFind(db.orders.find((o) => o.id === orderId && o.orgId === ctx.orgId), 'Заказ')
    if (order.status !== 'new') throw new DomainError('BAD_STATUS', `Заказ уже в статусе «${STATUS_LABEL[order.status]}»`)
    const items = db.orderItems.filter((i) => i.orderId === order.id)
    const lines: DB['pickTasks'][number]['lines'] = []
    const shortages: string[] = []
    for (const it of items) {
      const cand = db.stock
        .filter((b) => b.orgId === ctx.orgId && b.productId === it.productId && b.locationType === 'cell' && b.qty - b.reserved > 0)
        .map((b) => ({ b, free: b.qty - b.reserved, code: db.cells.find((c) => c.id === b.locationId)?.code ?? '' }))
      const single = cand.filter((c) => c.free >= it.qty).sort((a, b) => a.free - b.free || a.code.localeCompare(b.code))[0]
      const plan = single ? [single] : cand.sort((a, b) => b.free - a.free)
      let need = it.qty
      for (const c of plan) {
        if (need <= 0) break
        const take = Math.min(need, c.free)
        c.b.reserved += take
        need -= take
        lines.push({ id: uid('pl_'), productId: it.productId, orderItemId: it.id, cellId: c.b.locationId, qty: take, pickedQty: 0 })
      }
      if (need > 0) {
        const p = db.products.find((x) => x.id === it.productId)
        shortages.push(`${p?.sku ?? ''} «${p?.name}» — не хватает ${need} шт.`)
      }
    }
    if (shortages.length) throw new DomainError('SHORTAGE', shortages.join('; '), { shortages })
    const cellCode = (id: ID) => db.cells.find((c) => c.id === id)?.code ?? ''
    lines.sort((a, b) => cellCode(a.cellId).localeCompare(cellCode(b.cellId)))
    db.pickTasks.push({ id: uid('pt_'), orgId: ctx.orgId, orderId: order.id, status: 'open', lines, createdAt: now() })
    order.status = 'to_pick'
    event(db, ctx, order, 'Передан в сборку, товар зарезервирован')
  })
}

export function taskForOrder(s: Scoped, orderId: ID) {
  return s.pickTasks.find((t) => t.orderId === orderId && t.status !== 'done') ?? s.pickTasks.find((t) => t.orderId === orderId)
}

/** К сборке → Собирается. Returns the task id. */
export function startPicking(ctx: Ctx, orderId: ID) {
  return transact((db) => {
    const order = mustFind(db.orders.find((o) => o.id === orderId && o.orgId === ctx.orgId), 'Заказ')
    const task = mustFind(db.pickTasks.find((t) => t.orderId === orderId && t.status !== 'done'), 'Задание на сборку')
    if (order.status === 'picking' && task.assigneeId && task.assigneeId !== ctx.userId) {
      const who = db.users.find((u) => u.id === task.assigneeId)?.name
      throw new DomainError('TAKEN', `Заказ №${order.number} уже собирает ${who}`)
    }
    if (order.status !== 'to_pick' && order.status !== 'picking')
      throw new DomainError('BAD_STATUS', `Заказ в статусе «${STATUS_LABEL[order.status]}» — собирать нечего`)
    if (order.status === 'to_pick') event(db, ctx, order, 'Сборка начата')
    task.assigneeId = ctx.userId
    task.status = 'in_progress'
    order.status = 'picking'
    order.pickerId = ctx.userId
    return task.id
  })
}

/**
 * Bind the order to a tote. `code` = BOX-xxxx label, or null to use the
 * order's own QR (a virtual container named after the order).
 */
export function bindContainer(ctx: Ctx, taskId: ID, code: string | null) {
  return transact((db) => {
    const task = mustFind(db.pickTasks.find((t) => t.id === taskId && t.orgId === ctx.orgId), 'Задание')
    const order = mustFind(db.orders.find((o) => o.id === task.orderId), 'Заказ')
    let box
    if (code === null) {
      const vcode = `ORD-${order.number}`
      box = db.containers.find((c) => c.orgId === ctx.orgId && c.code === vcode)
      if (!box) {
        box = { id: uid('bx_'), orgId: ctx.orgId, code: vcode }
        db.containers.push(box)
      }
    } else {
      const up = normalizeCode(code).toUpperCase()
      box = db.containers.find((c) => c.orgId === ctx.orgId && c.code.toUpperCase() === up)
      if (!box) throw new DomainError('NOT_CONTAINER', `Это не короб. Отсканировано: ${code}`)
      if (box.orderId && box.orderId !== order.id) {
        const other = db.orders.find((o) => o.id === box!.orderId)
        throw new DomainError('CONTAINER_BUSY', `Короб ${box.code} уже занят заказом №${other?.number}. Возьмите пустой короб.`)
      }
    }
    box.orderId = order.id
    task.containerId = box.id
    order.containerId = box.id
    event(db, ctx, order, `Привязан короб ${box.code}`)
    return box.code
  })
}

/**
 * Confirms `qty` units of a pick line. The scanned cell and product are
 * re-checked here, so a wrong scan is refused even if the UI was bypassed.
 */
export function confirmPick(ctx: Ctx, input: { taskId: ID; lineId: ID; cellId: ID; productId: ID; qty: number }) {
  assertQty(input.qty)
  return transact((db) => {
    const task = mustFind(db.pickTasks.find((t) => t.id === input.taskId && t.orgId === ctx.orgId), 'Задание')
    const order = mustFind(db.orders.find((o) => o.id === task.orderId), 'Заказ')
    if (!task.containerId) throw new DomainError('NO_CONTAINER', 'Сначала привяжите короб заказа')
    const line = mustFind(task.lines.find((l) => l.id === input.lineId), 'Строка сборки')
    const cell = db.cells.find((c) => c.id === line.cellId)
    if (input.cellId !== line.cellId) throw new DomainError('WRONG_CELL', `Это не ячейка ${cell?.code}`)
    if (input.productId !== line.productId) throw new DomainError('WRONG_PRODUCT', 'Неверный товар')
    if (line.pickedQty + input.qty > line.qty)
      throw new DomainError('TOO_MANY', `Нужно только ${line.qty} шт. — уже взято ${line.pickedQty}`)
    const src = balance(db, ctx.orgId, line.productId, cellLoc(line.cellId))
    if (src.qty < input.qty) throw new DomainError('NOT_ENOUGH', `По системе в ${cell?.code} только ${src.qty} шт.`)
    src.qty -= input.qty
    src.reserved = Math.max(0, src.reserved - input.qty)
    balance(db, ctx.orgId, line.productId, boxLoc(task.containerId)).qty += input.qty
    line.pickedQty += input.qty
    const item = db.orderItems.find((i) => i.id === line.orderItemId)
    if (item) item.pickedQty += input.qty
    record(db, ctx, 'pick', line.productId, input.qty, cellLoc(line.cellId), boxLoc(task.containerId), { docType: 'order', docId: order.id })
    if (task.lines.every((l) => l.pickedQty >= l.qty)) {
      task.status = 'done'
      order.status = 'picked'
      event(db, ctx, order, 'Заказ собран')
    }
    pruneEmpty(db)
  })
}

/**
 * Собран → Упакован. Called with what the packer actually scanned; any
 * mismatch is refused, so the UI cannot "force" an incomplete parcel.
 */
export function completePacking(ctx: Ctx, orderId: ID, scanned: Record<ID, number>, extras: number) {
  return transact((db) => {
    const order = mustFind(db.orders.find((o) => o.id === orderId && o.orgId === ctx.orgId), 'Заказ')
    if (order.status !== 'picked') throw new DomainError('BAD_STATUS', `Заказ в статусе «${STATUS_LABEL[order.status]}», упаковать нельзя`)
    if (extras > 0) throw new DomainError('EXTRA', 'В коробе есть лишний товар — уберите его')
    const items = db.orderItems.filter((i) => i.orderId === order.id)
    for (const it of items) {
      const got = scanned[it.productId] ?? 0
      const p = db.products.find((x) => x.id === it.productId)
      if (got < it.qty) throw new DomainError('MISSING', `Не хватает ${it.qty - got} шт.: ${p?.name}`)
      if (got > it.qty) throw new DomainError('EXTRA', `Лишние ${got - it.qty} шт.: ${p?.name}`)
    }
    for (const id of Object.keys(scanned))
      if (!items.some((i) => i.productId === id)) throw new DomainError('EXTRA', 'В коробе есть товар не из этого заказа')
    for (const it of items) {
      it.packedQty = it.qty
      record(db, ctx, 'pack', it.productId, it.qty, order.containerId ? boxLoc(order.containerId) : undefined, undefined, { docType: 'order', docId: order.id })
    }
    order.status = 'packed'
    order.packerId = ctx.userId
    event(db, ctx, order, 'Упакован, комплектность проверена')
  })
}

/** Упакован → Отгружен: goods leave the warehouse, the tote is freed. */
export function shipOrders(ctx: Ctx, orderIds: ID[]) {
  return transact((db) => {
    let n = 0
    for (const id of orderIds) {
      const order = db.orders.find((o) => o.id === id && o.orgId === ctx.orgId)
      if (!order || order.status !== 'packed') continue
      const box = order.containerId
      if (box) {
        for (const b of db.stock.filter((x) => x.orgId === ctx.orgId && x.locationType === 'container' && x.locationId === box)) {
          record(db, ctx, 'ship', b.productId, b.qty, boxLoc(box), undefined, { docType: 'order', docId: order.id })
          b.qty = 0
        }
        const c = db.containers.find((x) => x.id === box)
        if (c) c.orderId = undefined
      }
      order.status = 'shipped'
      event(db, ctx, order, 'Отгружен')
      n++
    }
    pruneEmpty(db)
    return n
  })
}

// ──────────────────────────────── inventory ─────────────────────────────────

export function startInventory(ctx: Ctx) {
  return transact((db) => {
    const open = db.invSessions.find((s) => s.orgId === ctx.orgId && s.userId === ctx.userId && s.status === 'open')
    if (open) return open.id
    const id = uid('inv_')
    db.invSessions.push({ id, orgId: ctx.orgId, userId: ctx.userId, status: 'open', startedAt: now() })
    return id
  })
}

export type InvVerdict = 'ok' | 'missing' | 'surplus' | 'foreign'

/** Compare a cell count with the system. Pure: used live on the phone and on commit. */
export function diffCell(s: Scoped, cellId: ID, counted: Record<ID, number>) {
  const expected = cellContents(s, cellId)
  const ids = new Set([...expected.map((e) => e.product.id), ...Object.keys(counted)])
  return [...ids].map((productId) => {
    const exp = expected.find((e) => e.product.id === productId)?.qty ?? 0
    const cnt = counted[productId] ?? 0
    const verdict: InvVerdict = exp === 0 ? 'foreign' : cnt === exp ? 'ok' : cnt < exp ? 'missing' : 'surplus'
    const elsewhere = verdict === 'foreign'
      ? productStock(s, productId).cells.filter((c) => c.cell.id !== cellId)
      : []
    return { productId, product: s.products.find((p) => p.id === productId)!, expected: exp, counted: cnt, verdict, elsewhere }
  })
}

/** Saves the count and posts adjustments so the system matches the shelf. */
export function commitCellCount(ctx: Ctx, sessionId: ID, cellId: ID, counted: Record<ID, number>) {
  return transact((db) => {
    const sess = mustFind(db.invSessions.find((x) => x.id === sessionId && x.orgId === ctx.orgId && x.status === 'open'), 'Инвентаризация')
    const rows = diffCell(scope(db, ctx), cellId, counted)
    db.invLines = db.invLines.filter((l) => !(l.sessionId === sess.id && l.cellId === cellId))
    let adjusted = 0
    for (const r of rows) {
      db.invLines.push({ id: uid('il_'), orgId: ctx.orgId, sessionId: sess.id, cellId, productId: r.productId, expectedQty: r.expected, countedQty: r.counted })
      const delta = r.counted - r.expected
      if (delta === 0) continue
      const b = balance(db, ctx.orgId, r.productId, cellLoc(cellId))
      b.qty += delta
      b.reserved = Math.min(b.reserved, b.qty)
      record(db, ctx, 'adjust', r.productId, Math.abs(delta),
        delta < 0 ? cellLoc(cellId) : undefined, delta > 0 ? cellLoc(cellId) : undefined,
        { docType: 'inventory', docId: sess.id }, delta > 0 ? 'Излишек' : 'Недостача')
      adjusted++
    }
    pruneEmpty(db)
    return adjusted
  })
}

export function finishInventory(ctx: Ctx, sessionId: ID) {
  return transact((db) => {
    const sess = mustFind(db.invSessions.find((x) => x.id === sessionId && x.orgId === ctx.orgId), 'Инвентаризация')
    sess.status = 'done'
    sess.finishedAt = now()
  })
}

// ───────────────────────────── initial balances ─────────────────────────────

export function importStock(ctx: Ctx, rows: { row: number; code: string; cell: string; qty: number }[]): ImportResult {
  return transact((db) => {
    const res: ImportResult = { created: 0, updated: 0, errors: [] }
    const s = scope(db, ctx)
    for (const r of rows) {
      const p = resolveCode(s, r.code)
      const c = s.cells.find((x) => x.code.toUpperCase() === r.cell.trim().toUpperCase())
      if (p.kind !== 'product') { res.errors.push({ row: r.row, message: `Товар «${r.code}» не найден` }); continue }
      if (!c) { res.errors.push({ row: r.row, message: `Ячейка «${r.cell}» не найдена` }); continue }
      if (!Number.isInteger(r.qty) || r.qty <= 0) { res.errors.push({ row: r.row, message: 'Неверное количество' }); continue }
      balance(db, ctx.orgId, p.product.id, cellLoc(c.id)).qty += r.qty
      record(db, ctx, 'receipt', p.product.id, r.qty, undefined, cellLoc(c.id), undefined, 'Начальные остатки')
      res.created++
    }
    return res
  })
}

export const readScope = (ctx: Pick<Ctx, 'orgId'>) => scope(getDB(), ctx)
