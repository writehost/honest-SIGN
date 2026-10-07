import { useSyncExternalStore } from 'react'

// Connectivity + outbox.
//
// Production contract: each warehouse operation is POSTed to /api/v1/ops with
// a client-generated id (idempotency key). Without a connection the op goes
// to this outbox (persisted on the device) and is replayed in order when the
// network returns; the server re-validates each op and rejects what no longer
// fits (e.g. the stock was moved meanwhile). No CRDTs, no merge engine.
//
// In the prototype the "server" lives in the same tab, so ops are applied
// immediately and the outbox only tracks what still has to be delivered.

export interface OutboxItem {
  id: string
  ts: string
  label: string
}

const KEY = 'scada-wms/outbox'
const SIM_KEY = 'scada-wms/simulate-offline'

let simulated = read(SIM_KEY, false)
let browserOnline = typeof navigator === 'undefined' ? true : navigator.onLine
let queue: OutboxItem[] = read(KEY, [])
let syncing = false
let lastSynced = 0
let snap = make()
const listeners = new Set<() => void>()

function read<T>(k: string, d: T): T {
  try {
    const v = localStorage.getItem(k)
    return v ? (JSON.parse(v) as T) : d
  } catch {
    return d
  }
}
function write(k: string, v: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(v))
  } catch { /* ignore */ }
}

function make() {
  return { online: browserOnline && !simulated, simulated, queue, syncing, lastSynced }
}
function emit() {
  snap = make()
  listeners.forEach((l) => l())
}

export function isOnline() {
  return browserOnline && !simulated
}

/** Wrap every warehouse operation. Throws exactly what the operation throws. */
export function runOp<T>(label: string, fn: () => T): T {
  const result = fn()
  if (!isOnline()) {
    queue = [...queue, { id: crypto.randomUUID(), ts: new Date().toISOString(), label }]
    write(KEY, queue)
    emit()
  }
  return result
}

async function flush() {
  if (!queue.length || syncing || !isOnline()) return
  syncing = true
  emit()
  await new Promise((r) => setTimeout(r, 900))
  lastSynced = queue.length
  queue = []
  write(KEY, queue)
  syncing = false
  emit()
  setTimeout(() => { lastSynced = 0; emit() }, 4000)
}

export function setSimulatedOffline(v: boolean) {
  simulated = v
  write(SIM_KEY, v)
  emit()
  if (!v) void flush()
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { browserOnline = true; emit(); void flush() })
  window.addEventListener('offline', () => { browserOnline = false; emit() })
  setTimeout(() => void flush(), 500)
}

export function useNet() {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l) }, () => snap)
}
