"use client"

import { createContext, useContext, useEffect, useRef } from "react"
import type { Tone } from "./store"

export interface Toast {
  id: string
  tone: Tone
  title: string
  text?: string
}

export type ScanHandler = (raw: string) => void

export interface MesUi {
  openLaunch: (nomenclatureId?: string) => void
  openFinish: () => void
  openMore: () => void
  openSim: () => void
  toast: (t: Omit<Toast, "id">) => void
  /**
   * Шина ручного сканера. Экран регистрирует обработчик, пока он активен.
   * Сюда приходят сканы USB HID-сканера вне полей ввода и сканы из симулятора.
   */
  registerScanHandler: (h: ScanHandler) => () => void
  emitScan: (raw: string) => void
  /** Код, переданный на экран «Коды» с другого экрана */
  pendingScan: string | null
  consumePendingScan: () => void
  inspectCode: (code: string) => void
}

export const MesUiContext = createContext<MesUi | null>(null)

export function useMesUi() {
  const ctx = useContext(MesUiContext)
  if (!ctx) throw new Error("useMesUi must be used inside <MesShell>")
  return ctx
}

/** Подписка экрана на шину сканера; обработчик всегда актуальный, подписка — одна */
export function useScanHandler(handler: ScanHandler, enabled = true) {
  const { registerScanHandler } = useMesUi()
  const ref = useRef(handler)
  ref.current = handler
  useEffect(() => {
    if (!enabled) return
    return registerScanHandler((raw) => ref.current(raw))
  }, [enabled, registerScanHandler])
}
