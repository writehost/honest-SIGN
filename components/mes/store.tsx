"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react"

/* ────────────────────────────────────────────────────────────────────────────
 * Домен
 * ──────────────────────────────────────────────────────────────────────────── */

export type Volume = 11 | 19
export type PalletSize = 36 | 48

export interface Nomenclature {
  id: string
  name: string
  sku: string
  gtin: string
  volume: Volume
  description: string
  active: boolean
  defaultPalletSize: PalletSize
}

/** idle — партии нет; running — линия работает; paused — пауза оператора; stopped — аварийный стоп */
export type LineState = "idle" | "running" | "paused" | "stopped"

/** Состояния палетного кода — ровно те, что видит оператор */
export type PalletState = "filling" | "awaiting_code" | "scan_error" | "code_used" | "closed_ok"

export type CodeStatus = "applied" | "in_pallet" | "aggregated" | "rejected" | "removed"

export interface CodeRecord {
  code: string
  batchId: string
  status: CodeStatus
  palletCode?: string
  at: number
  manual?: boolean
}

export interface PalletRecord {
  code: string
  batchId: string
  count: number
  closedAt: number
  partial?: boolean
}

export type BatchStatus = "active" | "paused" | "completed" | "completed_warn" | "aborted"

export interface Batch {
  id: string
  number: string
  nomenclatureId: string
  nomenclatureName: string
  volume: Volume
  palletSize: PalletSize
  status: BatchStatus
  startedAt: number
  finishedAt?: number
  applied: number
  good: number
  rejected: number
  removed: number
  manualAdded: number
  pallets: number
  errors: number
  operator: string
}

export type EventKind = "batch" | "aggregation" | "code" | "equipment" | "operator"
export type Severity = "info" | "success" | "warning" | "critical"

export interface MesEvent {
  id: string
  at: number
  kind: EventKind
  severity: Severity
  title: string
  detail?: string
  batchNumber?: string
}

export type ScanMode = "check" | "add" | "remove"

export interface ScanHistoryItem {
  id: string
  at: number
  mode: ScanMode
  code: string
  tone: Tone
  title: string
}

export type Tone = "success" | "warning" | "critical" | "info" | "neutral"

export interface Settings {
  lineName: string
  lineSpeed: number // бутылей в минуту (симуляция)
  rejectRate: number // доля брака камеры, 0..0.2
  bufferLimit: number // ёмкость накопителя, пока ждём палетный код
  defaultPalletSize: PalletSize
  autoOpenPalletScan: boolean
  allowPartialPallet: boolean
  confirmRemove: boolean
  defaultScanMode: ScanMode
  sound: boolean
  toastSeconds: number
  largeText: boolean
  operator: string
}

export interface PalletProgress {
  index: number // порядковый номер палеты в партии
  items: string[]
  state: PalletState
  lastScan?: { code: string; message: string; at: number }
  stateSince: number
}

export interface MesState {
  line: LineState
  nomenclature: Nomenclature[]
  batches: Batch[]
  activeBatchId: string | null
  pallet: PalletProgress
  buffer: string[]
  codes: Record<string, CodeRecord>
  pallets: Record<string, PalletRecord>
  events: MesEvent[]
  scanHistory: ScanHistoryItem[]
  settings: Settings
  equipment: { printer: boolean; camera: boolean; scanner: boolean; gis: boolean }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Генераторы и форматирование
 * ──────────────────────────────────────────────────────────────────────────── */

const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!\"%&'*+-./_,:;=<>?"
const SAFE = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"

export const uid = () => Math.random().toString(36).slice(2, 10)

function randomFrom(chars: string, len: number) {
  let s = ""
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

/** DataMatrix кода «Честного знака» для упакованной воды: 01 + GTIN(14) + 21 + серийный номер(13). Криптохвост опущен. */
export function makeDataMatrix(gtin: string) {
  return `01${gtin}21${randomFrom(SAFE, 1)}${randomFrom(ALPHA.replace(/[^A-Za-z0-9]/g, ""), 12)}`
}

function gs1Check(digits: string) {
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    const d = Number(digits[digits.length - 1 - i])
    sum += i % 2 === 0 ? d * 3 : d
  }
  return String((10 - (sum % 10)) % 10)
}

/** SSCC палеты: 00 + 18 цифр */
export function makeSscc() {
  const body = "1460712" + String(Math.floor(Math.random() * 1e10)).padStart(10, "0")
  return `00${body}${gs1Check(body)}`
}

export const DM_RE = /^01(\d{14})21([\x21-\x7e]{6,20})/
export const SSCC_RE = /^(00)?\d{18}$/

export function parseDataMatrix(raw: string) {
  const code = raw.trim().replace(/[\u001d\s]/g, "")
  const m = DM_RE.exec(code)
  return m ? { code, gtin: m[1], serial: m[2] } : null
}

export function shortCode(code: string) {
  const p = parseDataMatrix(code)
  if (!p) return code.length > 24 ? `${code.slice(0, 12)}…${code.slice(-8)}` : code
  return `…${p.gtin.slice(-6)} · ${p.serial}`
}

export function formatSscc(code: string) {
  const c = code.startsWith("00") && code.length === 20 ? code.slice(2) : code
  return `(00) ${c.slice(0, 1)} ${c.slice(1, 8)} ${c.slice(8, 17)} ${c.slice(17)}`
}

export const fmtTime = (t: number) =>
  new Date(t).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
export const fmtDate = (t: number) =>
  new Date(t).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" })
export const fmtDateTime = (t: number) =>
  `${fmtDate(t)} ${new Date(t).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`
export const fmtNum = (n: number) => n.toLocaleString("ru-RU")

export function fmtDuration(ms: number) {
  const m = Math.max(0, Math.floor(ms / 60000))
  const h = Math.floor(m / 60)
  return h > 0 ? `${h} ч ${String(m % 60).padStart(2, "0")} мин` : `${m} мин`
}

/* ────────────────────────────────────────────────────────────────────────────
 * Словари подписей
 * ──────────────────────────────────────────────────────────────────────────── */

export const LINE_LABEL: Record<LineState, { label: string; tone: Tone }> = {
  idle: { label: "Ожидание партии", tone: "neutral" },
  running: { label: "Линия работает", tone: "success" },
  paused: { label: "Пауза", tone: "warning" },
  stopped: { label: "Аварийный стоп", tone: "critical" },
}

export const PALLET_LABEL: Record<PalletState, { label: string; tone: Tone }> = {
  filling: { label: "Набор палеты", tone: "info" },
  awaiting_code: { label: "Ожидание палетного кода", tone: "warning" },
  scan_error: { label: "Ошибка сканирования", tone: "critical" },
  code_used: { label: "Палетный код уже использован", tone: "critical" },
  closed_ok: { label: "Палета успешно агрегирована", tone: "success" },
}

export const CODE_STATUS_LABEL: Record<CodeStatus, { label: string; tone: Tone }> = {
  applied: { label: "Нанесён", tone: "info" },
  in_pallet: { label: "В текущей палете", tone: "info" },
  aggregated: { label: "Агрегирован", tone: "success" },
  rejected: { label: "Отбракован камерой", tone: "warning" },
  removed: { label: "Удалён оператором", tone: "critical" },
}

export const BATCH_STATUS_LABEL: Record<BatchStatus, { label: string; tone: Tone }> = {
  active: { label: "В работе", tone: "success" },
  paused: { label: "Пауза", tone: "warning" },
  completed: { label: "Завершена", tone: "neutral" },
  completed_warn: { label: "Завершена с замечаниями", tone: "warning" },
  aborted: { label: "Прервана", tone: "critical" },
}

export const EVENT_KIND_LABEL: Record<EventKind, string> = {
  batch: "Партия",
  aggregation: "Агрегация",
  code: "Коды",
  equipment: "Оборудование",
  operator: "Оператор",
}

/* ────────────────────────────────────────────────────────────────────────────
 * Оценка кода для ручного сканера (чистая функция)
 * ──────────────────────────────────────────────────────────────────────────── */

export interface CodeEvaluation {
  code: string
  valid: boolean
  record?: CodeRecord
  batch?: Batch
  inCurrentBatch: boolean
  gtinMatch: boolean
  canAdd: boolean
  canRemove: boolean
  tone: Tone
  title: string
  message: string
}

export function evaluateCode(state: MesState, raw: string, mode: ScanMode): CodeEvaluation {
  const parsed = parseDataMatrix(raw)
  const active = state.batches.find((b) => b.id === state.activeBatchId)
  const activeNom = active ? state.nomenclature.find((n) => n.id === active.nomenclatureId) : undefined
  const base = { code: raw.trim(), inCurrentBatch: false, gtinMatch: false, canAdd: false, canRemove: false }

  if (!parsed) {
    return { ...base, valid: false, tone: "critical", title: "Неверный формат кода", message: "Это не код маркировки «Честного знака». Проверьте, что сканируется DataMatrix на крышке бутыли." }
  }
  const record = state.codes[parsed.code]
  const batch = record ? state.batches.find((b) => b.id === record.batchId) : undefined
  const inCurrentBatch = !!record && record.batchId === state.activeBatchId
  const gtinMatch = !!activeNom && activeNom.gtin === parsed.gtin
  const canRemove = !!record && inCurrentBatch && (record.status === "applied" || record.status === "in_pallet")
  const canAdd = !record && !!active && gtinMatch
  const common = { ...base, code: parsed.code, valid: true, record, batch, inCurrentBatch, gtinMatch, canAdd, canRemove }

  if (!record) {
    if (!active) return { ...common, tone: "warning", title: "Код не найден", message: "Код не нанесён ни в одной партии. Нет активной партии — добавить код нельзя." }
    if (!gtinMatch) return { ...common, tone: "critical", title: "Чужая номенклатура", message: `GTIN кода не совпадает с текущей номенклатурой «${activeNom?.name}». Бутыль не относится к партии.` }
    return { ...common, tone: mode === "add" ? "info" : "warning", title: "Код не найден в партии", message: "Код соответствует номенклатуре партии, но не зарегистрирован как нанесённый. Его можно добавить вручную." }
  }
  if (!inCurrentBatch) {
    return { ...common, tone: "warning", title: "Код из другой партии", message: `Код принадлежит партии № ${batch?.number ?? "—"} (${CODE_STATUS_LABEL[record.status].label.toLowerCase()}). Действия с ним недоступны.` }
  }
  switch (record.status) {
    case "aggregated":
      return { ...common, tone: "success", title: "Код агрегирован", message: `Бутыль в закрытой палете ${formatSscc(record.palletCode ?? "")}. Удаление запрещено — сначала расформируйте палету.` }
    case "in_pallet":
      return { ...common, tone: "success", title: "Код нанесён · в текущей палете", message: "Код учтён и входит в собираемую палету. Можно удалить, если бутыль снята с линии." }
    case "applied":
      return { ...common, tone: "success", title: "Код нанесён", message: "Код учтён в партии, ожидает попадания в палету (накопитель)." }
    case "rejected":
      return { ...common, tone: "warning", title: "Код отбракован", message: "Камера не подтвердила нанесение, бутыль ушла в брак. Код уже исключён из партии." }
    case "removed":
      return { ...common, tone: "critical", title: "Код удалён", message: "Код ранее удалён оператором и не участвует в агрегации." }
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Reducer
 * ──────────────────────────────────────────────────────────────────────────── */

type Action =
  | { type: "TICK"; code: string; rejected: boolean; at: number }
  | { type: "START_BATCH"; nomenclatureId: string; palletSize: PalletSize; number: string; at: number }
  | { type: "PAUSE"; at: number }
  | { type: "RESUME"; at: number }
  | { type: "FINISH_BATCH"; at: number; partialPalletCode?: string }
  | { type: "SCAN_PALLET"; code: string; at: number; partial?: boolean }
  | { type: "PALLET_SETTLE"; at: number }
  | { type: "MANUAL_ADD"; code: string; at: number }
  | { type: "MANUAL_REMOVE"; code: string; at: number }
  | { type: "SCAN_RECORD"; item: ScanHistoryItem }
  | { type: "UPSERT_NOMENCLATURE"; item: Nomenclature; at: number }
  | { type: "UPDATE_SETTINGS"; patch: Partial<Settings> }
  | { type: "TOGGLE_EQUIPMENT"; key: keyof MesState["equipment"]; at: number }
  | { type: "LOG"; event: Omit<MesEvent, "id"> }

function log(state: MesState, e: Omit<MesEvent, "id">): MesState {
  return { ...state, events: [{ id: uid(), ...e }, ...state.events].slice(0, 500) }
}

function patchActive(state: MesState, patch: (b: Batch) => Partial<Batch>): MesState {
  return {
    ...state,
    batches: state.batches.map((b) => (b.id === state.activeBatchId ? { ...b, ...patch(b) } : b)),
  }
}

function activeBatch(state: MesState) {
  return state.batches.find((b) => b.id === state.activeBatchId)
}

/** Зачисляет годную бутыль в палету или, если палета полная, в накопитель */
function placeGood(state: MesState, code: string, size: number): MesState {
  const canFill = state.pallet.state === "filling" || state.pallet.state === "closed_ok"
  if (canFill && state.pallet.items.length < size) {
    const items = [...state.pallet.items, code]
    const codes = { ...state.codes, [code]: { ...state.codes[code], status: "in_pallet" as const } }
    // closed_ok сохраняется, пока не истечёт показ сообщения об успехе (PALLET_SETTLE)
    let next: MesState = { ...state, codes, pallet: { ...state.pallet, items } }
    if (items.length >= size) {
      next = { ...next, pallet: { ...next.pallet, state: "awaiting_code", stateSince: state.codes[code].at, lastScan: undefined } }
      next = log(next, {
        at: state.codes[code].at,
        kind: "aggregation",
        severity: "warning",
        title: `Палета № ${state.pallet.index} собрана — ожидание палетного кода`,
        detail: `${size} из ${size} бутылей`,
        batchNumber: activeBatch(state)?.number,
      })
    }
    return next
  }
  return { ...state, buffer: [...state.buffer, code] }
}

function reducer(state: MesState, action: Action): MesState {
  switch (action.type) {
    case "TICK": {
      const batch = activeBatch(state)
      if (!batch || state.line !== "running") return state
      let next: MesState = {
        ...state,
        codes: { ...state.codes, [action.code]: { code: action.code, batchId: batch.id, status: action.rejected ? "rejected" : "applied", at: action.at } },
      }
      next = patchActive(next, (b) => ({
        applied: b.applied + 1,
        good: b.good + (action.rejected ? 0 : 1),
        rejected: b.rejected + (action.rejected ? 1 : 0),
      }))
      if (action.rejected) {
        return log(next, { at: action.at, kind: "code", severity: "warning", title: "Камера: код не подтверждён, бутыль отбракована", detail: shortCode(action.code), batchNumber: batch.number })
      }
      next = placeGood(next, action.code, batch.palletSize)
      if (next.buffer.length >= state.settings.bufferLimit) {
        next = { ...next, line: "stopped" }
        next = patchActive(next, (b) => ({ status: "paused", errors: b.errors + 1 }))
        next = log(next, { at: action.at, kind: "aggregation", severity: "critical", title: "Накопитель заполнен — линия остановлена", detail: "Отсканируйте палетный код, чтобы продолжить", batchNumber: batch.number })
      }
      return next
    }

    case "START_BATCH": {
      const nom = state.nomenclature.find((n) => n.id === action.nomenclatureId)
      if (!nom || state.activeBatchId) return state
      const batch: Batch = {
        id: uid(),
        number: action.number,
        nomenclatureId: nom.id,
        nomenclatureName: nom.name,
        volume: nom.volume,
        palletSize: action.palletSize,
        status: "active",
        startedAt: action.at,
        applied: 0,
        good: 0,
        rejected: 0,
        removed: 0,
        manualAdded: 0,
        pallets: 0,
        errors: 0,
        operator: state.settings.operator,
      }
      const next: MesState = {
        ...state,
        line: "running",
        batches: [batch, ...state.batches],
        activeBatchId: batch.id,
        pallet: { index: 1, items: [], state: "filling", stateSince: action.at },
        buffer: [],
      }
      return log(next, { at: action.at, kind: "batch", severity: "success", title: `Партия № ${batch.number} запущена`, detail: `${nom.name} · ${nom.volume} л · палета ${action.palletSize} шт.`, batchNumber: batch.number })
    }

    case "PAUSE": {
      const batch = activeBatch(state)
      if (!batch || state.line !== "running") return state
      return log(patchActive({ ...state, line: "paused" }, () => ({ status: "paused" })), { at: action.at, kind: "operator", severity: "warning", title: "Линия поставлена на паузу", batchNumber: batch.number })
    }

    case "RESUME": {
      const batch = activeBatch(state)
      if (!batch || state.line === "running") return state
      if (state.buffer.length >= state.settings.bufferLimit) return state
      return log(patchActive({ ...state, line: "running" }, () => ({ status: "active" })), { at: action.at, kind: "operator", severity: "info", title: "Работа линии возобновлена", batchNumber: batch.number })
    }

    case "FINISH_BATCH": {
      const batch = activeBatch(state)
      if (!batch) return state
      let next = state
      if (action.partialPalletCode && state.pallet.items.length > 0) {
        next = reducer(next, { type: "SCAN_PALLET", code: action.partialPalletCode, at: action.at, partial: true })
      }
      // Незакрытые бутыли остаются «нанесёнными» без агрегации
      const leftovers = next.pallet.items.length + next.buffer.length
      const codes = { ...next.codes }
      for (const c of [...next.pallet.items, ...next.buffer]) codes[c] = { ...codes[c], status: "applied" }
      const warn = batch.errors > 0 || batch.removed > 0 || leftovers > 0
      next = patchActive({ ...next, codes }, () => ({ status: warn ? "completed_warn" : "completed", finishedAt: action.at }))
      next = {
        ...next,
        line: "idle",
        activeBatchId: null,
        buffer: [],
        pallet: { index: 1, items: [], state: "filling", stateSince: action.at },
      }
      const b = next.batches.find((x) => x.id === batch.id)!
      return log(next, {
        at: action.at,
        kind: "batch",
        severity: warn ? "warning" : "success",
        title: `Партия № ${batch.number} завершена`,
        detail: `Нанесено ${b.applied}, палет ${b.pallets}${leftovers ? `, без агрегации ${leftovers}` : ""}`,
        batchNumber: batch.number,
      })
    }

    case "SCAN_PALLET": {
      const batch = activeBatch(state)
      if (!batch) return state
      const code = action.code.trim().replace(/\s/g, "")
      const full = state.pallet.items.length >= batch.palletSize
      if (!full && !action.partial) {
        return log({ ...state, pallet: { ...state.pallet, lastScan: { code, message: "Палета ещё не собрана", at: action.at } } }, { at: action.at, kind: "aggregation", severity: "warning", title: "Скан палетного кода отклонён: палета не собрана", detail: `${state.pallet.items.length} из ${batch.palletSize}`, batchNumber: batch.number })
      }
      if (!SSCC_RE.test(code)) {
        const next = patchActive({ ...state, pallet: { ...state.pallet, state: "scan_error", stateSince: action.at, lastScan: { code, message: "Код не является SSCC палеты (18 цифр)", at: action.at } } }, (b) => ({ errors: b.errors + 1 }))
        return log(next, { at: action.at, kind: "aggregation", severity: "critical", title: "Ошибка сканирования палетного кода", detail: "Неверный формат, ожидается SSCC", batchNumber: batch.number })
      }
      const sscc = code.length === 18 ? `00${code}` : code
      if (state.pallets[sscc]) {
        const next = patchActive({ ...state, pallet: { ...state.pallet, state: "code_used", stateSince: action.at, lastScan: { code: sscc, message: "Этот палетный код уже присвоен другой палете", at: action.at } } }, (b) => ({ errors: b.errors + 1 }))
        return log(next, { at: action.at, kind: "aggregation", severity: "critical", title: "Палетный код уже использован", detail: formatSscc(sscc), batchNumber: batch.number })
      }
      const codes = { ...state.codes }
      for (const c of state.pallet.items) codes[c] = { ...codes[c], status: "aggregated", palletCode: sscc }
      const pallets = { ...state.pallets, [sscc]: { code: sscc, batchId: batch.id, count: state.pallet.items.length, closedAt: action.at, partial: !full } }
      const moved = state.buffer.slice(0, batch.palletSize)
      for (const c of moved) codes[c] = { ...codes[c], status: "in_pallet" }
      let next: MesState = {
        ...state,
        codes,
        pallets,
        buffer: state.buffer.slice(batch.palletSize),
        pallet: { index: state.pallet.index + 1, items: moved, state: "closed_ok", stateSince: action.at, lastScan: { code: sscc, message: `Палета № ${state.pallet.index} закрыта`, at: action.at } },
      }
      next = patchActive(next, (b) => ({ pallets: b.pallets + 1 }))
      next = log(next, { at: action.at, kind: "aggregation", severity: "success", title: `Палета № ${state.pallet.index} успешно агрегирована${full ? "" : " (неполная)"}`, detail: `${formatSscc(sscc)} · ${state.pallet.items.length} бут.`, batchNumber: batch.number })
      if (moved.length >= batch.palletSize) next = { ...next, pallet: { ...next.pallet, state: "awaiting_code" } }
      return next
    }

    case "PALLET_SETTLE":
      return state.pallet.state === "closed_ok" ? { ...state, pallet: { ...state.pallet, state: "filling", stateSince: action.at } } : state

    case "MANUAL_ADD": {
      const batch = activeBatch(state)
      if (!batch || state.codes[action.code]) return state
      let next: MesState = { ...state, codes: { ...state.codes, [action.code]: { code: action.code, batchId: batch.id, status: "applied", at: action.at, manual: true } } }
      next = patchActive(next, (b) => ({ applied: b.applied + 1, good: b.good + 1, manualAdded: b.manualAdded + 1 }))
      next = placeGood(next, action.code, batch.palletSize)
      return log(next, { at: action.at, kind: "operator", severity: "info", title: "Код добавлен вручную", detail: shortCode(action.code), batchNumber: batch.number })
    }

    case "MANUAL_REMOVE": {
      const batch = activeBatch(state)
      const rec = state.codes[action.code]
      if (!batch || !rec || rec.batchId !== batch.id || (rec.status !== "applied" && rec.status !== "in_pallet")) return state
      let next: MesState = {
        ...state,
        codes: { ...state.codes, [action.code]: { ...rec, status: "removed" } },
        buffer: state.buffer.filter((c) => c !== action.code),
        pallet: { ...state.pallet, items: state.pallet.items.filter((c) => c !== action.code) },
      }
      if (next.pallet.state === "awaiting_code" && next.pallet.items.length < batch.palletSize) {
        next = { ...next, pallet: { ...next.pallet, state: "filling" } }
      }
      next = patchActive(next, (b) => ({ good: b.good - 1, removed: b.removed + 1 }))
      return log(next, { at: action.at, kind: "operator", severity: "warning", title: "Код удалён из партии", detail: shortCode(action.code), batchNumber: batch.number })
    }

    case "SCAN_RECORD":
      return { ...state, scanHistory: [action.item, ...state.scanHistory].slice(0, 50) }

    case "UPSERT_NOMENCLATURE": {
      const exists = state.nomenclature.some((n) => n.id === action.item.id)
      const next = { ...state, nomenclature: exists ? state.nomenclature.map((n) => (n.id === action.item.id ? action.item : n)) : [action.item, ...state.nomenclature] }
      return log(next, { at: action.at, kind: "operator", severity: "info", title: exists ? "Номенклатура изменена" : "Номенклатура создана", detail: `${action.item.name} · ${action.item.volume} л` })
    }

    case "UPDATE_SETTINGS":
      return { ...state, settings: { ...state.settings, ...action.patch } }

    case "TOGGLE_EQUIPMENT": {
      const on = !state.equipment[action.key]
      const names = { printer: "Принтер-аппликатор", camera: "Камера контроля", scanner: "Ручной сканер", gis: "Связь с ГИС МТ" }
      let next: MesState = { ...state, equipment: { ...state.equipment, [action.key]: on } }
      if (!on && (action.key === "printer" || action.key === "camera") && state.line === "running") {
        next = patchActive({ ...next, line: "stopped" }, (b) => ({ status: "paused", errors: b.errors + 1 }))
      }
      return log(next, { at: action.at, kind: "equipment", severity: on ? "success" : "critical", title: `${names[action.key]}: ${on ? "связь восстановлена" : "нет связи"}` })
    }

    case "LOG":
      return log(state, action.event)
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Демо-данные
 * ──────────────────────────────────────────────────────────────────────────── */

const SEED_NOMENCLATURE: Nomenclature[] = [
  { id: "n1", name: "Вода питьевая «Горный родник»", sku: "GR-19-001", gtin: "04607123450019", volume: 19, description: "Артезианская, высшей категории. Поликарбонатная бутыль.", active: true, defaultPalletSize: 48 },
  { id: "n2", name: "Вода питьевая «Горный родник»", sku: "GR-11-001", gtin: "04607123450118", volume: 11, description: "Артезианская, высшей категории. ПЭТ-бутыль.", active: true, defaultPalletSize: 48 },
  { id: "n3", name: "Вода «Кристальная» негазированная", sku: "KR-19-002", gtin: "04607123450217", volume: 19, description: "Первой категории. Бутыль ПЭТ многоразовая.", active: true, defaultPalletSize: 36 },
  { id: "n4", name: "Вода детская «Малыш»", sku: "ML-11-003", gtin: "04607123450316", volume: 11, description: "Для детского питания с 0 месяцев.", active: true, defaultPalletSize: 36 },
  { id: "n5", name: "Вода «Кристальная» с йодом", sku: "KR-19-004", gtin: "04607123450415", volume: 19, description: "Снята с производства.", active: false, defaultPalletSize: 48 },
]

function seed(): MesState {
  const now = Date.now()
  const H = 3600_000
  const codes: Record<string, CodeRecord> = {}
  const pallets: Record<string, PalletRecord> = {}

  const hist: Array<[string, number, PalletSize, BatchStatus, number, number, number, number, number, number, number]> = [
    // nomId, hoursAgo, palletSize, status, durationH, pallets, rejected, removed, manual, errors, leftovers
    ["n2", 7, 48, "completed", 2.2, 22, 14, 2, 1, 0, 0],
    ["n1", 11, 48, "completed_warn", 3.1, 31, 26, 5, 3, 2, 17],
    ["n3", 26, 36, "completed", 2.8, 36, 9, 0, 0, 0, 0],
    ["n4", 30, 36, "completed", 1.4, 15, 4, 1, 0, 0, 0],
    ["n1", 50, 48, "aborted", 0.6, 4, 41, 6, 2, 5, 12],
    ["n2", 54, 48, "completed", 2.5, 25, 11, 0, 0, 0, 0],
    ["n1", 74, 48, "completed", 3.4, 36, 18, 3, 2, 1, 0],
    ["n3", 98, 36, "completed_warn", 2.1, 26, 12, 4, 6, 3, 5],
  ]
  const batches: Batch[] = hist.map(([nid, ago, ps, status, dur, pl, rej, rem, man, err, left], i) => {
    const nom = SEED_NOMENCLATURE.find((n) => n.id === nid)!
    const good = pl * ps + left
    return {
      id: `b${i + 1}`,
      number: `2609-${String(40 - i * 3).padStart(3, "0")}`,
      nomenclatureId: nid,
      nomenclatureName: nom.name,
      volume: nom.volume,
      palletSize: ps,
      status,
      startedAt: now - ago * H,
      finishedAt: now - ago * H + dur * H,
      applied: good + rej + rem - man,
      good,
      rejected: rej,
      removed: rem,
      manualAdded: man,
      pallets: pl,
      errors: err,
      operator: i % 3 === 0 ? "Петров А." : "Смирнова Е.",
    }
  })
  // Немного реальных кодов у предыдущей партии — чтобы ручной сканер находил «код из другой партии»
  const prev = batches[0]
  const prevNom = SEED_NOMENCLATURE.find((n) => n.id === prev.nomenclatureId)!
  for (let p = 0; p < 2; p++) {
    const sscc = makeSscc()
    pallets[sscc] = { code: sscc, batchId: prev.id, count: 48, closedAt: prev.finishedAt! - (2 - p) * 600_000 }
    for (let i = 0; i < 48; i++) {
      const c = makeDataMatrix(prevNom.gtin)
      codes[c] = { code: c, batchId: prev.id, status: "aggregated", palletCode: sscc, at: pallets[sscc].closedAt }
    }
  }

  // Активная партия: 19 л, палета 48, уже 7 палет и 43 бутыли в текущей
  const nom = SEED_NOMENCLATURE[0]
  const start = now - 52 * 60_000
  const active: Batch = {
    id: "active",
    number: "2609-043",
    nomenclatureId: nom.id,
    nomenclatureName: nom.name,
    volume: nom.volume,
    palletSize: 48,
    status: "active",
    startedAt: start,
    applied: 0,
    good: 0,
    rejected: 0,
    removed: 0,
    manualAdded: 0,
    pallets: 0,
    errors: 0,
    operator: "Смирнова Е.",
  }
  const events: MesEvent[] = []
  const ev = (e: Omit<MesEvent, "id">) => events.unshift({ id: uid(), ...e })
  ev({ at: start - 60_000, kind: "equipment", severity: "success", title: "Оборудование линии готово", detail: "Принтер, камера, сканер, ГИС МТ" })
  ev({ at: start, kind: "batch", severity: "success", title: `Партия № ${active.number} запущена`, detail: `${nom.name} · 19 л · палета 48 шт.`, batchNumber: active.number })
  let t = start
  for (let p = 0; p < 7; p++) {
    const sscc = makeSscc()
    for (let i = 0; i < 48; i++) {
      t += 5500
      const c = makeDataMatrix(nom.gtin)
      codes[c] = { code: c, batchId: active.id, status: "aggregated", palletCode: sscc, at: t }
      active.applied++
      active.good++
      if (Math.random() < 0.02) {
        const r = makeDataMatrix(nom.gtin)
        codes[r] = { code: r, batchId: active.id, status: "rejected", at: t }
        active.applied++
        active.rejected++
      }
    }
    pallets[sscc] = { code: sscc, batchId: active.id, count: 48, closedAt: t + 20_000 }
    active.pallets++
    ev({ at: t, kind: "aggregation", severity: "warning", title: `Палета № ${p + 1} собрана — ожидание палетного кода`, detail: "48 из 48 бутылей", batchNumber: active.number })
    ev({ at: t + 20_000, kind: "aggregation", severity: "success", title: `Палета № ${p + 1} успешно агрегирована`, detail: `${formatSscc(sscc)} · 48 бут.`, batchNumber: active.number })
    if (p === 3) {
      ev({ at: t + 15_000, kind: "aggregation", severity: "critical", title: "Палетный код уже использован", detail: "Повторный скан этикетки предыдущей палеты", batchNumber: active.number })
      active.errors++
    }
  }
  const items: string[] = []
  for (let i = 0; i < 43; i++) {
    t += 5500
    const c = makeDataMatrix(nom.gtin)
    codes[c] = { code: c, batchId: active.id, status: "in_pallet", at: t }
    items.push(c)
    active.applied++
    active.good++
  }
  ev({ at: t - 200_000, kind: "operator", severity: "info", title: "Код добавлен вручную", detail: "Бутыль перемаркирована после сбоя принтера", batchNumber: active.number })
  active.manualAdded = 1

  return {
    line: "running",
    nomenclature: SEED_NOMENCLATURE,
    batches: [active, ...batches],
    activeBatchId: active.id,
    pallet: { index: 8, items, state: "filling", stateSince: t },
    buffer: [],
    codes,
    pallets,
    events,
    scanHistory: [],
    settings: {
      lineName: "Линия розлива № 1",
      lineSpeed: 40,
      rejectRate: 0.03,
      bufferLimit: 12,
      defaultPalletSize: 48,
      autoOpenPalletScan: true,
      allowPartialPallet: true,
      confirmRemove: true,
      defaultScanMode: "check",
      sound: true,
      toastSeconds: 4,
      largeText: false,
      operator: "Смирнова Е.",
    },
    equipment: { printer: true, camera: true, scanner: true, gis: true },
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Provider + хуки
 * ──────────────────────────────────────────────────────────────────────────── */

interface MesApi {
  state: MesState
  active?: Batch
  activeNomenclature?: Nomenclature
  startBatch: (nomenclatureId: string, palletSize: PalletSize) => string
  pause: () => void
  resume: () => void
  finishBatch: (partialPalletCode?: string) => void
  scanPallet: (code: string, partial?: boolean) => void
  manualAdd: (code: string) => void
  manualRemove: (code: string) => void
  recordScan: (item: Omit<ScanHistoryItem, "id" | "at">) => void
  upsertNomenclature: (item: Nomenclature) => void
  updateSettings: (patch: Partial<Settings>) => void
  toggleEquipment: (key: keyof MesState["equipment"]) => void
  /** Демо: сгенерировать код, как если бы его отсканировали */
  demoCode: (kind: "current" | "aggregated" | "new" | "foreign" | "other_batch" | "invalid") => string
}

const MesContext = createContext<MesApi | null>(null)

export function MesProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, seed)
  const stateRef = useRef(state)
  stateRef.current = state

  // Симуляция конвейера: одна бутыль каждые 60/lineSpeed секунд
  useEffect(() => {
    if (state.line !== "running") return
    const nom = state.nomenclature.find((n) => n.id === state.batches.find((b) => b.id === state.activeBatchId)?.nomenclatureId)
    if (!nom) return
    const id = window.setInterval(() => {
      const s = stateRef.current.settings
      dispatch({ type: "TICK", code: makeDataMatrix(nom.gtin), rejected: Math.random() < s.rejectRate, at: Date.now() })
    }, Math.max(150, 60_000 / state.settings.lineSpeed))
    return () => window.clearInterval(id)
  }, [state.line, state.activeBatchId, state.settings.lineSpeed, state.nomenclature, state.batches])

  // «Палета успешно агрегирована» держится 3 секунды, затем — снова «Набор палеты»
  useEffect(() => {
    if (state.pallet.state !== "closed_ok") return
    const id = window.setTimeout(() => dispatch({ type: "PALLET_SETTLE", at: Date.now() }), 3000)
    return () => window.clearTimeout(id)
  }, [state.pallet.state, state.pallet.stateSince])

  const active = state.batches.find((b) => b.id === state.activeBatchId)
  const activeNomenclature = active ? state.nomenclature.find((n) => n.id === active.nomenclatureId) : undefined

  const startBatch = useCallback((nomenclatureId: string, palletSize: PalletSize) => {
    const d = new Date()
    const seq = String(44 + stateRef.current.batches.filter((b) => b.startedAt > Date.now() - 86400_000).length).padStart(3, "0")
    const number = `${String(d.getDate()).padStart(2, "0")}${String(d.getMonth() + 1).padStart(2, "0")}-${seq}`
    dispatch({ type: "START_BATCH", nomenclatureId, palletSize, number, at: Date.now() })
    return number
  }, [])

  const demoCode = useCallback<MesApi["demoCode"]>((kind) => {
    const s = stateRef.current
    const act = s.batches.find((b) => b.id === s.activeBatchId)
    const nom = act ? s.nomenclature.find((n) => n.id === act.nomenclatureId) : s.nomenclature[0]
    const pick = (pred: (r: CodeRecord) => boolean) => {
      const list = Object.values(s.codes).filter(pred)
      return list.length ? list[Math.floor(Math.random() * list.length)].code : makeDataMatrix(nom!.gtin)
    }
    switch (kind) {
      case "current":
        return s.pallet.items.length ? s.pallet.items[Math.floor(Math.random() * s.pallet.items.length)] : pick((r) => r.batchId === s.activeBatchId && r.status === "applied")
      case "aggregated":
        return pick((r) => r.batchId === s.activeBatchId && r.status === "aggregated")
      case "other_batch":
        return pick((r) => r.batchId !== s.activeBatchId)
      case "new":
        return makeDataMatrix(nom!.gtin)
      case "foreign":
        return makeDataMatrix(s.nomenclature.find((n) => n.id !== nom!.id)!.gtin)
      case "invalid":
        return "4607123450019"
    }
  }, [])

  const api = useMemo<MesApi>(
    () => ({
      state,
      active,
      activeNomenclature,
      startBatch,
      pause: () => dispatch({ type: "PAUSE", at: Date.now() }),
      resume: () => dispatch({ type: "RESUME", at: Date.now() }),
      finishBatch: (partialPalletCode) => dispatch({ type: "FINISH_BATCH", at: Date.now(), partialPalletCode }),
      scanPallet: (code, partial) => dispatch({ type: "SCAN_PALLET", code, partial, at: Date.now() }),
      manualAdd: (code) => dispatch({ type: "MANUAL_ADD", code, at: Date.now() }),
      manualRemove: (code) => dispatch({ type: "MANUAL_REMOVE", code, at: Date.now() }),
      recordScan: (item) => dispatch({ type: "SCAN_RECORD", item: { ...item, id: uid(), at: Date.now() } }),
      upsertNomenclature: (item) => dispatch({ type: "UPSERT_NOMENCLATURE", item, at: Date.now() }),
      updateSettings: (patch) => dispatch({ type: "UPDATE_SETTINGS", patch }),
      toggleEquipment: (key) => dispatch({ type: "TOGGLE_EQUIPMENT", key, at: Date.now() }),
      demoCode,
    }),
    [state, active, activeNomenclature, startBatch, demoCode],
  )

  return <MesContext.Provider value={api}>{children}</MesContext.Provider>
}

export function useMes() {
  const ctx = useContext(MesContext)
  if (!ctx) throw new Error("useMes must be used inside <MesProvider>")
  return ctx
}
