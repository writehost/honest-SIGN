import type { DB, Ctx } from './types'

// In the browser prototype the "server" is this store. Every mutation runs
// through transact(): it works on a copy, and only a fully successful
// operation replaces the committed state — the same contract a PostgreSQL
// transaction gives the real backend.

export const DB_VERSION = 3
const KEY = 'scada-wms/db/v3'

export function emptyDB(): DB {
  return {
    version: DB_VERSION,
    orgs: [], users: [], warehouses: [], zones: [], cells: [],
    products: [], barcodes: [], stock: [], movements: [],
    orders: [], orderItems: [], pickTasks: [], containers: [],
    receipts: [], invSessions: [], invLines: [],
  }
}

/** Business-rule violation with a message written for the person holding the phone. */
export class DomainError extends Error {
  constructor(
    public code: string,
    message: string,
    public details: Record<string, unknown> = {},
  ) {
    super(message)
  }
}

let state: DB = emptyDB()
const listeners = new Set<() => void>()
let storage: Pick<Storage, 'getItem' | 'setItem'> | null = null

export function initStore(initial: () => DB, store?: Pick<Storage, 'getItem' | 'setItem'> | null) {
  storage = store ?? null
  let loaded: DB | null = null
  try {
    const raw = storage?.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as DB
      if (parsed.version === DB_VERSION) loaded = parsed
    }
  } catch {
    loaded = null
  }
  state = loaded ?? initial()
  persist()
  // Another tab of the same browser (e.g. cabinet + terminal side by side) wrote the store
  if (typeof window !== 'undefined' && store === window.localStorage) {
    window.addEventListener('storage', (e) => {
      if (e.key !== KEY || !e.newValue) return
      try {
        state = JSON.parse(e.newValue) as DB
        listeners.forEach((l) => l())
      } catch { /* ignore partial writes */ }
    })
  }
}

export function getDB(): DB {
  return state
}

export function replaceDB(next: DB) {
  state = next
  persist()
  listeners.forEach((l) => l())
}

export function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

function persist() {
  try {
    storage?.setItem(KEY, JSON.stringify(state))
  } catch {
    // Quota exceeded (large photos) — keep working in memory.
  }
}

export function transact<T>(fn: (draft: DB) => T): T {
  const draft = structuredClone(state)
  const result = fn(draft)
  replaceDB(draft)
  return result
}

let seq = 0
export function uid(prefix = ''): string {
  seq = (seq + 1) % 1e6
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7) + seq.toString(36)
}

export const now = () => new Date().toISOString()

/** Tenant-scoped view: the only way services read collections. */
export function scope(db: DB, ctx: Pick<Ctx, 'orgId'>) {
  const o = ctx.orgId
  const f = <T extends { orgId: string }>(xs: T[]) => xs.filter((x) => x.orgId === o)
  return {
    org: db.orgs.find((x) => x.id === o),
    users: f(db.users),
    warehouses: f(db.warehouses),
    zones: f(db.zones),
    cells: f(db.cells),
    products: f(db.products),
    barcodes: f(db.barcodes),
    stock: f(db.stock),
    movements: f(db.movements),
    orders: f(db.orders),
    orderItems: f(db.orderItems),
    pickTasks: f(db.pickTasks),
    containers: f(db.containers),
    receipts: f(db.receipts),
    invSessions: f(db.invSessions),
    invLines: f(db.invLines),
  }
}
export type Scoped = ReturnType<typeof scope>
