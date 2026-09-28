"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react"
import {
  SEED_NOMENCLATURE,
  getActive,
  makeDataMatrix,
  makeSscc,
  palletView,
  reducer,
  seed,
  uid,
  validateSscc,
  type Batch,
  type CodeRecord,
  type MesState,
  type Nomenclature,
  type PalletSize,
  type ScanHistoryItem,
  type Settings,
  type SimState,
  type SsccCheck,
} from "./domain"

export * from "./domain"

/* ════════════════════════════════════════════════════════════════════════════
 * Provider
 * ════════════════════════════════════════════════════════════════════════════ */

interface MesApi {
  state: MesState
  active?: Batch
  pallet: ReturnType<typeof palletView>
  startBatch: (nomenclatureId: string, palletSize: PalletSize) => string
  finishBatch: () => void
  requestPartial: (on: boolean) => void
  scanSscc: (raw: string) => SsccCheck
  manualAdd: (raw: string) => void
  manualRemove: (raw: string, reason: string) => void
  dismissAlert: (id: string) => void
  recordScan: (item: Omit<ScanHistoryItem, "id" | "at">) => void
  upsertNomenclature: (item: Nomenclature) => void
  updateSettings: (patch: Partial<Settings>) => void
  /** ─── Симуляция (не производственный режим) ─── */
  sim: {
    set: (patch: Partial<SimState>) => void
    bottle: () => void
    fillPallet: () => void
    noRead: () => void
    duplicate: () => void
    foreign: () => void
    code: (kind: "queued" | "aggregated" | "removed" | "unknown" | "foreign" | "other_batch" | "garbage") => string
    sscc: (kind: "new" | "used" | "last" | "bad_check" | "garbage") => string
  }
}

const MesContext = createContext<MesApi | null>(null)

export function MesProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, seed)
  const ref = useRef(state)
  ref.current = state
  const active = getActive(state)

  // Симулятор камеры: поток считываний, пока включён поток и есть связь
  useEffect(() => {
    if (!active || !state.sim.flow || !state.sim.cameraLink) return
    const id = window.setInterval(() => {
      const b = getActive(ref.current)
      if (!b) return
      if (Math.random() < 0.015) dispatch({ type: "CAMERA_NOREAD", at: Date.now() })
      else dispatch({ type: "CAMERA_READ", raw: makeDataMatrix(b.gtin), at: Date.now() })
    }, state.sim.intervalMs)
    return () => window.clearInterval(id)
  }, [active?.id, state.sim.flow, state.sim.cameraLink, state.sim.intervalMs]) // eslint-disable-line react-hooks/exhaustive-deps

  // Heartbeat камеры — независимо от наличия бутылей (простой ≠ неисправность)
  useEffect(() => {
    if (!state.sim.cameraLink) return
    const id = window.setInterval(() => dispatch({ type: "CAMERA_HEARTBEAT", at: Date.now() }), 2000)
    return () => window.clearInterval(id)
  }, [state.sim.cameraLink])

  const startBatch = useCallback((nomenclatureId: string, palletSize: PalletSize) => {
    const d = new Date()
    const prefix = `${String(d.getDate()).padStart(2, "0")}${String(d.getMonth() + 1).padStart(2, "0")}`
    const max = Math.max(0, ...ref.current.batches.map((b) => Number(b.number.split("-")[1]) || 0))
    const number = `${prefix}-${String(max + 1).padStart(3, "0")}`
    dispatch({ type: "START_BATCH", nomenclatureId, palletSize, number, at: Date.now() })
    return number
  }, [])

  const scanSscc = useCallback((raw: string) => {
    const v = validateSscc(ref.current, raw)
    dispatch({ type: "SCAN_SSCC", raw, at: Date.now() })
    return v
  }, [])

  const sim = useMemo<MesApi["sim"]>(() => {
    const gtin = () => getActive(ref.current)?.gtin ?? SEED_NOMENCLATURE[0].gtin
    const pick = (f: (c: CodeRecord) => boolean) => {
      const list = Object.values(ref.current.codes).filter(f)
      return list.length ? list[Math.floor(Math.random() * list.length)].code : undefined
    }
    return {
      set: (patch) => dispatch({ type: "SIM", patch, at: Date.now() }),
      bottle: () => dispatch({ type: "CAMERA_READ", raw: makeDataMatrix(gtin()), at: Date.now() }),
      fillPallet: () => {
        const s = ref.current
        const b = getActive(s)
        if (!b) return
        const need = Math.max(0, b.palletSize - s.fifo.length)
        for (let i = 0; i < need; i++) dispatch({ type: "CAMERA_READ", raw: makeDataMatrix(b.gtin), at: Date.now() })
      },
      noRead: () => dispatch({ type: "CAMERA_NOREAD", at: Date.now() }),
      duplicate: () => {
        const c = pick((r) => r.batchId === ref.current.activeBatchId && r.status !== "removed")
        if (c) dispatch({ type: "CAMERA_READ", raw: c, at: Date.now() })
      },
      foreign: () => dispatch({ type: "CAMERA_READ", raw: makeDataMatrix(SEED_NOMENCLATURE.find((n) => n.gtin !== gtin())!.gtin), at: Date.now() }),
      code: (kind) => {
        const s = ref.current
        const cur = (r: CodeRecord) => r.batchId === s.activeBatchId
        switch (kind) {
          case "queued": return s.fifo.length ? s.fifo[Math.floor(Math.random() * Math.min(s.fifo.length, 48))] : makeDataMatrix(gtin())
          case "aggregated": return pick((r) => cur(r) && r.status === "aggregated") ?? makeDataMatrix(gtin())
          case "removed": return pick((r) => cur(r) && r.status === "removed") ?? makeDataMatrix(gtin())
          case "other_batch": return pick((r) => !cur(r)) ?? makeDataMatrix(gtin())
          case "unknown": return makeDataMatrix(gtin())
          case "foreign": return makeDataMatrix(SEED_NOMENCLATURE.find((n) => n.gtin !== gtin())!.gtin)
          case "garbage": return "4607123450019"
        }
      },
      sscc: (kind) => {
        const s = ref.current
        switch (kind) {
          case "new": return makeSscc()
          case "last": return s.lastClosed?.code ?? makeSscc()
          case "used": {
            const list = Object.values(s.pallets).filter((p) => p.code !== s.lastClosed?.code)
            return list.length ? list[0].code : makeSscc()
          }
          case "bad_check": {
            const c = makeSscc()
            return c.slice(0, -1) + String((Number(c.slice(-1)) + 1) % 10)
          }
          case "garbage": return "123456"
        }
      },
    }
  }, [])

  const api = useMemo<MesApi>(() => {
    return {
      state,
      active,
      pallet: palletView(state),
      startBatch,
      finishBatch: () => dispatch({ type: "FINISH_BATCH", at: Date.now() }),
      requestPartial: (on) => dispatch({ type: "REQUEST_PARTIAL", on, at: Date.now() }),
      scanSscc,
      manualAdd: (raw) => dispatch({ type: "MANUAL_ADD", raw, at: Date.now() }),
      manualRemove: (raw, reason) => dispatch({ type: "MANUAL_REMOVE", raw, reason, at: Date.now() }),
      dismissAlert: (id) => dispatch({ type: "DISMISS_ALERT", id }),
      recordScan: (item) => dispatch({ type: "SCAN_RECORD", item: { ...item, id: uid(), at: Date.now() } }),
      upsertNomenclature: (item) => dispatch({ type: "UPSERT_NOMENCLATURE", item, at: Date.now() }),
      updateSettings: (patch) => dispatch({ type: "UPDATE_SETTINGS", patch }),
      sim,
    }
  }, [state, active, startBatch, scanSscc, sim])

  return <MesContext.Provider value={api}>{children}</MesContext.Provider>
}

export function useMes() {
  const ctx = useContext(MesContext)
  if (!ctx) throw new Error("useMes must be used inside <MesProvider>")
  return ctx
}

/** Секундный тик для «N с назад» и контроля связи с камерой */
export function useNow(intervalMs = 1000) {
  const [, force] = useReducer((x: number) => x + 1, 0)
  useEffect(() => {
    const id = window.setInterval(force, intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return Date.now()
}
