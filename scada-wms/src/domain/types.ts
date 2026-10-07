// Domain model. Mirrors backend/schema.sql one-to-one: every tenant-owned
// row carries orgId, and the frontend store never reads across orgs.

export type ID = string
export type ISO = string

export type PlanCode = 'start' | 'seller' | 'pro'
export type Role = 'owner' | 'storekeeper'

export interface Organization {
  id: ID
  name: string
  plan: PlanCode
  createdAt: ISO
  onboardingDone: boolean
  settings: OrgSettings
}

export interface OrgSettings {
  sound: boolean
  vibration: boolean
  /** Quick receiving: товар → количество → ячейка, без экрана подтверждения */
  quickReceive: boolean
  /** Show the demo scanner panel (codes to tap instead of physical scans) */
  demoScanner: boolean
}

export interface User {
  id: ID
  orgId: ID
  name: string
  email: string
  role: Role
  active: boolean
  createdAt: ISO
}

export interface Warehouse {
  id: ID
  orgId: ID
  name: string
  address: string
}

export interface Zone {
  id: ID
  orgId: ID
  warehouseId: ID
  code: string
  name: string
}

export interface Cell {
  id: ID
  orgId: ID
  warehouseId: ID
  zoneId: ID
  code: string
  active: boolean
}

export interface Product {
  id: ID
  orgId: ID
  name: string
  article: string
  sku: string
  brand: string
  category: string
  unit: string
  weight?: number
  size?: string
  color?: string
  /** data: URL or http URL */
  photo?: string
  /** Tile color used when there is no photo */
  swatch?: string
  marketplace: { wb?: string; ozon?: string; ym?: string }
  archived: boolean
  createdAt: ISO
}

export interface ProductBarcode {
  id: ID
  orgId: ID
  productId: ID
  code: string
}

export type LocationType = 'cell' | 'container'

export interface StockBalance {
  orgId: ID
  productId: ID
  locationType: LocationType
  locationId: ID
  qty: number
  /** Units of qty already promised to pick tasks */
  reserved: number
}

export type MovementType = 'receipt' | 'move' | 'pick' | 'pack' | 'ship' | 'adjust'

export interface Loc {
  type: LocationType
  id: ID
}

export interface StockMovement {
  id: ID
  orgId: ID
  ts: ISO
  userId: ID
  type: MovementType
  productId: ID
  qty: number
  from?: Loc
  to?: Loc
  docType?: 'order' | 'receipt' | 'inventory'
  docId?: ID
  note?: string
}

export type OrderStatus = 'new' | 'to_pick' | 'picking' | 'picked' | 'packed' | 'shipped'
export type Channel = 'manual' | 'site' | 'wb' | 'ozon' | 'ym'

export interface OrderEvent {
  ts: ISO
  userId: ID
  text: string
}

export interface Order {
  id: ID
  orgId: ID
  number: string
  channel: Channel
  status: OrderStatus
  customer: string
  createdAt: ISO
  pickerId?: ID
  packerId?: ID
  containerId?: ID
  externalId?: string
  events: OrderEvent[]
}

export interface OrderItem {
  id: ID
  orgId: ID
  orderId: ID
  productId: ID
  qty: number
  pickedQty: number
  packedQty: number
}

export interface PickLine {
  id: ID
  productId: ID
  orderItemId: ID
  cellId: ID
  qty: number
  pickedQty: number
}

export interface PickingTask {
  id: ID
  orgId: ID
  orderId: ID
  status: 'open' | 'in_progress' | 'done'
  assigneeId?: ID
  containerId?: ID
  lines: PickLine[]
  createdAt: ISO
}

export interface Container {
  id: ID
  orgId: ID
  code: string
  orderId?: ID
}

export interface Receipt {
  id: ID
  orgId: ID
  number: string
  supplier: string
  status: 'expected' | 'in_progress' | 'done'
  createdAt: ISO
  lines: { productId: ID; expectedQty: number; receivedQty: number }[]
}

export interface InventorySession {
  id: ID
  orgId: ID
  userId: ID
  status: 'open' | 'done'
  startedAt: ISO
  finishedAt?: ISO
}

export interface InventoryLine {
  id: ID
  orgId: ID
  sessionId: ID
  cellId: ID
  productId: ID
  expectedQty: number
  countedQty: number
}

export interface DB {
  version: number
  orgs: Organization[]
  users: User[]
  warehouses: Warehouse[]
  zones: Zone[]
  cells: Cell[]
  products: Product[]
  barcodes: ProductBarcode[]
  stock: StockBalance[]
  movements: StockMovement[]
  orders: Order[]
  orderItems: OrderItem[]
  pickTasks: PickingTask[]
  containers: Container[]
  receipts: Receipt[]
  invSessions: InventorySession[]
  invLines: InventoryLine[]
}

/** Who performs an operation. Every service call is scoped by it. */
export interface Ctx {
  orgId: ID
  userId: ID
}
