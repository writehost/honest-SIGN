import { getDB, replaceDB } from './db'
import * as S from './services'
import type { Ctx } from './types'

export function ean13(base12: string) {
  const d = base12.split('').map(Number)
  const sum = d.reduce((a, n, i) => a + n * (i % 2 ? 3 : 1), 0)
  return base12 + ((10 - (sum % 10)) % 10)
}

const P = (
  n: number, name: string, sku: string, brand: string, category: string, swatch: string,
  size?: string, color?: string,
): S.ProductInput => ({
  name, sku, article: `ART-${4400 + n}`, brand, category, unit: 'шт', size, color, swatch,
  barcodes: [ean13(`46070012${String(3000 + n).padStart(4, '0')}`)],
  marketplace: n % 3 === 0 ? { wb: String(152340000 + n * 17), ozon: `OZ-${880000 + n}` } : {},
})

export const DEMO_PRODUCTS: S.ProductInput[] = [
  P(1, 'Футболка Nike чёрная XL', 'SKU-10023', 'Nike', 'Одежда', '#1c1d1f', 'XL', 'Чёрный'),
  P(2, 'Футболка Nike чёрная L', 'SKU-10025', 'Nike', 'Одежда', '#2a2b2e', 'L', 'Чёрный'),
  P(3, 'Футболка Nike белая M', 'SKU-10031', 'Nike', 'Одежда', '#ecebe6', 'M', 'Белый'),
  P(4, 'Худи Basic серое L', 'SKU-11002', 'Basic Lab', 'Одежда', '#8d9196', 'L', 'Серый'),
  P(5, 'Носки спортивные 3 пары', 'SKU-12040', 'Basic Lab', 'Одежда', '#d9d4c7', '39–42', 'Белый'),
  P(6, 'Крем для рук 75 мл', 'SKU-20110', 'Natura', 'Косметика', '#c9b48f'),
  P(7, 'Шампунь мягкий 400 мл', 'SKU-20145', 'Natura', 'Косметика', '#6f8f7a'),
  P(8, 'Бутылка для воды 750 мл', 'SKU-30012', 'AquaGo', 'Спорт', '#2f5d8a'),
  P(9, 'Коврик для йоги 6 мм', 'SKU-30077', 'AquaGo', 'Спорт', '#7a5c8f'),
  P(10, 'Кружка керамическая 350 мл', 'SKU-40001', 'Home&Co', 'Дом', '#b5523b'),
  P(11, 'Органайзер для кабелей', 'SKU-40018', 'Home&Co', 'Дом', '#3d3f44'),
  P(12, 'Чехол iPhone 15 прозрачный', 'SKU-50210', 'ClearCase', 'Аксессуары', '#cfd8dc'),
  P(13, 'Кабель USB-C 1 м', 'SKU-50233', 'ClearCase', 'Аксессуары', '#e6e2d8'),
  P(14, 'Свеча ароматическая «Лён»', 'SKU-40102', 'Home&Co', 'Дом', '#e3d5b8'),
]

/** Builds the demo tenant by running the real services — the seed obeys every rule a user does. */
export function seedDemo() {
  const { orgId, userId: owner } = S.registerOrganization({ orgName: 'ИП Котова · Kotova Store', userName: 'Анна Котова', email: 'anna@kotova.store' })
  const own: Ctx = { orgId, userId: owner }
  const ivan = S.addUser(own, { name: 'Иван Петров', email: 'ivan@kotova.store', role: 'storekeeper' })
  S.updateOrg(own, { plan: 'seller', onboardingDone: true })
  const iv: Ctx = { orgId, userId: ivan }
  const maria = S.addUser(own, { name: 'Мария Лебедева', email: 'maria@kotova.store', role: 'storekeeper' })
  const mr: Ctx = { orgId, userId: maria }

  const wh = S.createWarehouse(own, { name: 'Склад на Складской', address: 'Москва, ул. Складская, 12, бокс 4' })
  S.createCellRange(own, { warehouseId: wh, zone: 'A', rackFrom: 1, rackTo: 3, placeFrom: 1, placeTo: 6 })
  S.createCellRange(own, { warehouseId: wh, zone: 'B', rackFrom: 1, rackTo: 2, placeFrom: 1, placeTo: 4 })
  S.createContainers(own, 12)

  const ids = DEMO_PRODUCTS.map((p) => S.createProduct(own, p))
  const s = () => S.readScope(own)
  const cell = (code: string) => s().cells.find((c) => c.code === code)!.id

  const put: [number, string, number][] = [
    [0, 'A-01-03', 18], [0, 'B-01-01', 6], [1, 'A-01-04', 14], [2, 'A-01-05', 9], [3, 'A-02-01', 11],
    [4, 'A-02-02', 40], [5, 'A-02-03', 26], [6, 'A-02-04', 4], [7, 'A-03-01', 15], [8, 'A-03-02', 7],
    [9, 'A-03-03', 22], [10, 'A-03-04', 3], [11, 'B-01-02', 31], [12, 'B-01-03', 48], [13, 'B-02-01', 12],
  ]
  for (const [i, c, q] of put) S.receive(iv, { productId: ids[i], qty: q, cellId: cell(c) })
  S.move(mr, { productId: ids[4], fromCellId: cell('A-02-02'), toCellId: cell('B-02-02'), qty: 10 })

  S.createReceipt(own, { supplier: 'ООО «ТекстильПро»', lines: [{ productId: ids[0], expectedQty: 30 }, { productId: ids[1], expectedQty: 20 }, { productId: ids[3], expectedQty: 12 }] })
  S.createReceipt(own, { supplier: 'Natura Cosmetics', lines: [{ productId: ids[5], expectedQty: 24 }, { productId: ids[6], expectedQty: 24 }] })
  S.createReceipt(own, { supplier: 'AquaGo', lines: [{ productId: ids[7], expectedQty: 40 }] })

  const ord = (channel: S.OrderInput['channel'], customer: string, items: [number, number][]) =>
    S.createOrder(own, { channel, customer, items: items.map(([i, qty]) => ({ productId: ids[i], qty })) }).id

  // A few finished orders for history
  const done1 = ord('wb', 'WB · Коледино', [[11, 2], [12, 3]])
  const done2 = ord('ozon', 'Ozon · Хоругвино', [[9, 1]])
  for (const [id, who] of [[done1, iv], [done2, mr]] as const) {
    const t = S.startPicking(who, id)
    S.bindContainer(who, t, null)
    const task = s().pickTasks.find((x) => x.id === t)!
    for (const l of task.lines) S.confirmPick(who, { taskId: t, lineId: l.id, cellId: l.cellId, productId: l.productId, qty: l.qty })
    const scanned: Record<string, number> = {}
    for (const it of s().orderItems.filter((x) => x.orderId === id)) scanned[it.productId] = it.qty
    S.completePacking(who, id, scanned, 0)
  }
  S.shipOrders(own, [done1])

  // Picked, waiting for the packer
  const p1 = ord('site', 'Сайт · Ольга Р.', [[5, 1], [6, 1]])
  const t1 = S.startPicking(mr, p1)
  S.bindContainer(mr, t1, 'BOX-0003')
  for (const l of s().pickTasks.find((x) => x.id === t1)!.lines) S.confirmPick(mr, { taskId: t1, lineId: l.id, cellId: l.cellId, productId: l.productId, qty: l.qty })

  // Queue for today
  ord('wb', 'WB · Электросталь', [[0, 2]])
  ord('ozon', 'Ozon · Пушкино', [[1, 1], [12, 2]])
  ord('wb', 'WB · Подольск', [[4, 3]])
  ord('ym', 'Маркет · Софьино', [[7, 1], [8, 1]])
  ord('site', 'Сайт · Дмитрий К.', [[2, 1], [13, 1]])
  ord('wb', 'WB · Коледино', [[11, 1], [12, 1]])
  ord('ozon', 'Ozon · Твердь', [[9, 2]])
  ord('manual', 'Самовывоз · Игорь', [[3, 1]])
  // Not enough stock → stays «Новый»
  ord('wb', 'WB · Казань', [[10, 5]])

  // Spread the history over the past hours so the journal reads like a real day.
  const db = structuredClone(getDB())
  const base = Date.now()
  const mv = db.movements.filter((m) => m.orgId === orgId)
  mv.forEach((m, i) => { m.ts = new Date(base - (mv.length - i) * 7 * 60_000).toISOString() })
  const os = db.orders.filter((o) => o.orgId === orgId)
  os.forEach((o, i) => {
    const t = new Date(base - (os.length - i) * 23 * 60_000).toISOString()
    o.createdAt = t
    o.events.forEach((e, j) => { e.ts = new Date(Date.parse(t) + j * 9 * 60_000).toISOString() })
  })
  replaceDB(db)

  return { orgId, owner, ivan, maria }
}
