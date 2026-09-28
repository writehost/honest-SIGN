"use client"

import { createContext, useContext } from "react"
import type { Tone } from "./store"

export interface Toast {
  id: string
  tone: Tone
  title: string
  text?: string
}

export interface MesUi {
  openLaunch: (nomenclatureId?: string) => void
  openPalletScan: () => void
  openFinish: () => void
  toast: (t: Omit<Toast, "id">) => void
  /** Код, пойманный глобальным перехватом сканера — забирает экран «Коды» */
  pendingScan: string | null
  consumePendingScan: () => void
  /** Открыть код на экране «Коды» (как будто его отсканировали) */
  inspectCode: (code: string) => void
}

export const MesUiContext = createContext<MesUi | null>(null)

export function useMesUi() {
  const ctx = useContext(MesUiContext)
  if (!ctx) throw new Error("useMesUi must be used inside <MesShell>")
  return ctx
}
