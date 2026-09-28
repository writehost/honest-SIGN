/* ════════════════════════════════════════════════════════════════════════════
 * Модель производства
 *
 * Камера (одна) ──► уникальный подтверждённый DataMatrix ──► FIFO партии
 * FIFO[0 .. N-1] — текущая группа агрегации (N = 36 | 48, из номенклатуры/запуска)
 * Когда в FIFO ≥ N кодов — система запрашивает SSCC. После проверки SSCC первые N
 * кодов FIFO связываются с палетой, палета закрывается, номер палеты +1.
 * Коды, пришедшие во время ожидания SSCC, просто остаются в FIFO после группы —
 * никакого «физического накопителя» система не знает.
 *
 * Определения счётчиков партии:
 *   Нанесено кодов   = applied  — уникальные коды, подтверждённые камерой (не меняется корректировками)
 *   Всего бутылей    = applied + manualAdded − removed
 *   Палет агрегировано = pallets — закрытые палеты с подтверждённым SSCC
 *   В текущей палете = min(FIFO, N) из N
 *   Последнее нанесение = lastCameraAt — время последнего подтверждённого камерой кода
 * Инвариант: Всего бутылей = Σ бутылей в закрытых палетах партии + длина FIFO
 * ════════════════════════════════════════════════════════════════════════════ */

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

/** queued — в FIFO, ждёт агрегации; aggregated — в закрытой палете; removed — удалён оператором */
export type CodeStatus = "queued" | "aggregated" | "removed"

export interface CodeRecord {
  code: string
  batchId: string
  seq: number // порядковый номер регистрации в партии
  status: CodeStatus
  source: "camera" | "manual"
  at: number // время регистрации (считывание камерой или ручное добавление)
  palletNo?: number
  palletCode?: string
  removedAt?: number
  removeReason?: string
}

export interface PalletRecord {
  code: string // SSCC c префиксом 00
  batchId: string
  no: number
  count: number
  closedAt: number
  partial: boolean
}

export type BatchStatus = "active" | "completed" | "completed_warn"

export interface Batch {
  id: string
  number: string
  nomenclatureId: string
  nomenclatureName: string
  gtin: string
  volume: Volume
  palletSize: PalletSize
  status: BatchStatus
  startedAt: number
  finishedAt?: number
  applied: number
  manualAdded: number
  removed: number
  pallets: number
  noReads: number
  duplicates: number
  foreign: number
  ssccErrors: number
  unaggregated: number // бутылей без палеты на момент завершения
  lastCameraAt?: number
  operator: string
}

export const batchTotal = (b: Batch) => b.applied + b.manualAdded - b.removed

export type EventKind = "batch" | "camera" | "aggregation" | "codes" | "system"
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

/** Событие камеры, требующее действия оператора с конкретной бутылью */
export interface CameraAlert {
  id: string
  at: number
  kind: "noread" | "duplicate" | "foreign"
  title: string
  detail: string
}

export type ScanMode = "check" | "add" | "remove"
export type Tone = "success" | "warning" | "critical" | "info" | "neutral"

export interface ScanHistoryItem {
  id: string
  at: number
  mode: ScanMode
  code: string
  tone: Tone
  title: string
}

export interface Settings {
  lineName: string
  defaultPalletSize: PalletSize
  allowPartialPallet: boolean
  defaultScanMode: ScanMode
  largeText: boolean
  cameraTimeoutSec: number // нет heartbeat дольше — «нет связи с камерой»
  cameraAddress: string
  operator: string
}

export interface SimState {
  flow: boolean // идут ли бутыли под камерой
  intervalMs: number
  cameraLink: boolean // отвечает ли камера (heartbeat)
}

export interface SsccFeedback {
  tone: Tone
  title: string
  message: string
  code: string
  at: number
}

export interface MesState {
  nomenclature: Nomenclature[]
  batches: Batch[]
  activeBatchId: string | null
  fifo: string[]
  palletNo: number
  partialRequested: boolean
  ssccFeedback?: SsccFeedback
  lastClosed?: { no: number; code: string; count: number; at: number; partial: boolean }
  codes: Record<string, CodeRecord>
  pallets: Record<string, PalletRecord>
  events: MesEvent[]
  alerts: CameraAlert[]
  scanHistory: ScanHistoryItem[]
  camera: { lastHeartbeat: number }
  settings: Settings
  sim: SimState
}

/* ─── Формат кодов ─── */

export const uid = () => Math.random().toString(36).slice(2, 10)
const SERIAL = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789"
const rnd = (n: number) => Array.from({ length: n }, () => SERIAL[Math.floor(Math.random() * SERIAL.length)]).join("")

/** DataMatrix «Честного знака» для упакованной воды: 01 + GTIN(14) + 21 + серийный номер(13) [+ GS 93 + крипто] */
export function makeDataMatrix(gtin: string) {
  return `01${gtin}21${rnd(13)}\u001d93${rnd(4)}`
}

const DM_RE = /^01(\d{14})21([\x21-\x7e]{13})(?:\u001d?93[\x21-\x7e]{4})?$/

/** Нормализация: сканеры по-разному передают GS; ключ кода — 01+GTIN+21+серийник */
export function parseDataMatrix(raw: string) {
  const s = raw.replace(/[\r\n]/g, "").replace(/<GS>|\\x1d|\\u001d/gi, "\u001d").trim()
  const m = DM_RE.exec(s.replace(/\u001d(?!93)/g, ""))
  if (!m) return null
  return { key: `01${m[1]}21${m[2]}`, gtin: m[1], serial: m[2] }
}

export function isDataMatrixLike(raw: string) {
  return /^01\d{14}21/.test(raw.trim())
}

function gs1CheckDigit(body: string) {
  let sum = 0
  for (let i = 0; i < body.length; i++) {
    const d = Number(body[body.length - 1 - i])
    sum += i % 2 === 0 ? d * 3 : d
  }
  return (10 - (sum % 10)) % 10
}

/** SSCC = (00) + 18 цифр, последняя — контрольная GS1 */
export function makeSscc() {
  const body = "1460712" + String(Math.floor(Math.random() * 1e10)).padStart(10, "0")
  return `00${body}${gs1CheckDigit(body)}`
}

export function parseSscc(raw: string): { ok: true; code: string } | { ok: false; reason: string } {
  const s = raw.replace(/[\s()]/g, "").replace(/^\]C1/, "")
  const digits = s.length === 20 && s.startsWith("00") ? s.slice(2) : s
  if (!/^\d{18}$/.test(digits)) return { ok: false, reason: "Это не SSCC: ожидается 18 цифр с префиксом (00)" }
  if (gs1CheckDigit(digits.slice(0, 17)) !== Number(digits[17])) return { ok: false, reason: "Неверная контрольная цифра SSCC — этикетка повреждена или считана с ошибкой" }
  return { ok: true, code: `00${digits}` }
}

export const shortCode = (code: string) => {
  const p = parseDataMatrix(code)
  return p ? `${p.serial}` : code.length > 20 ? `${code.slice(0, 16)}…` : code
}
export const formatSscc = (code: string) => {
  const c = code.length === 20 ? code.slice(2) : code
  return `(00) ${c.slice(0, 1)} ${c.slice(1, 8)} ${c.slice(8, 17)} ${c.slice(17)}`
}

export const fmtTime = (t: number) => new Date(t).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
export const fmtDate = (t: number) => new Date(t).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" })
export const fmtDateTime = (t: number) => `${fmtDate(t)} ${new Date(t).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`
export const fmtNum = (n: number) => n.toLocaleString("ru-RU")
export function fmtAgo(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  if (s < 60) return `${s} с назад`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} мин назад`
  return `${Math.floor(m / 60)} ч ${m % 60} мин назад`
}
export function fmtDuration(ms: number) {
  const m = Math.max(0, Math.floor(ms / 60000))
  return m >= 60 ? `${Math.floor(m / 60)} ч ${String(m % 60).padStart(2, "0")} мин` : `${m} мин`
}

export const BATCH_STATUS_LABEL: Record<BatchStatus, { label: string; tone: Tone }> = {
  active: { label: "В работе", tone: "success" },
  completed: { label: "Завершена", tone: "neutral" },
  completed_warn: { label: "Завершена с корректировками", tone: "warning" },
}

export const EVENT_KIND_LABEL: Record<EventKind, string> = {
  batch: "Партия",
  camera: "Камера",
  aggregation: "Агрегация",
  codes: "Коды",
  system: "Система",
}

export const REMOVE_REASONS = ["Бутыль снята с линии (брак)", "Повреждён код / крышка", "Код ошибочно учтён", "Другое"] as const

/* ════════════════════════════════════════════════════════════════════════════
 * Проверки (чистые функции — одни и те же для UI и reducer)
 * ════════════════════════════════════════════════════════════════════════════ */

export const getActive = (s: MesState) => s.batches.find((b) => b.id === s.activeBatchId)

export function palletView(s: MesState) {
  const b = getActive(s)
  if (!b) return null
  const size = b.palletSize
  const inPallet = Math.min(s.fifo.length, size)
  const queuedNext = Math.max(0, s.fifo.length - size)
  const full = s.fifo.length >= size
  return { no: s.palletNo, size, inPallet, queuedNext, full, awaiting: full || (s.partialRequested && s.fifo.length > 0) }
}

export interface CodeCheck {
  label: string
  ok: boolean
  text: string
}

export interface CodeEvaluation {
  raw: string
  key?: string
  /** Крупное слово результата */
  verdict: "НАНЕСЁН" | "НЕ НАЙДЕН" | "УДАЛЁН" | "АГРЕГИРОВАН" | "НЕВЕРНЫЙ КОД"
  tone: Tone
  record?: CodeRecord
  batch?: Batch
  inActiveBatch: boolean
  /** Для кода в FIFO: какая палета и позиция */
  queue?: { palletNo: number; position: number; size: number }
  pallet?: PalletRecord
  details: string
  checks: CodeCheck[]
  canAdd: boolean
  addBlockedReason?: string
  canRemove: boolean
  removeBlockedReason?: string
}

export function evaluateCode(s: MesState, raw: string): CodeEvaluation {
  const active = getActive(s)
  const parsed = parseDataMatrix(raw)
  const base = { raw, inActiveBatch: false, checks: [] as CodeCheck[], canAdd: false, canRemove: false }
  if (!parsed) {
    return {
      ...base,
      verdict: "НЕВЕРНЫЙ КОД",
      tone: "critical",
      details: isDataMatrixLike(raw) ? "Код обрезан или считан не полностью. Отсканируйте ещё раз." : "Это не код маркировки «Честного знака». Сканируйте DataMatrix на крышке бутыли.",
      checks: [{ label: "Формат", ok: false, text: "не DataMatrix ЧЗ" }],
      addBlockedReason: "Неверный формат кода",
      removeBlockedReason: "Неверный формат кода",
    }
  }
  const rec = s.codes[parsed.key]
  const batch = rec ? s.batches.find((b) => b.id === rec.batchId) : undefined
  const inActiveBatch = !!rec && rec.batchId === s.activeBatchId
  const gtinOk = !!active && active.gtin === parsed.gtin

  const checks: CodeCheck[] = [
    { label: "Формат", ok: true, text: "DataMatrix ЧЗ" },
    { label: "Номенклатура", ok: gtinOk, text: active ? (gtinOk ? `GTIN ${parsed.gtin}` : `GTIN ${parsed.gtin} ≠ ${active.gtin}`) : "нет активной партии" },
    {
      label: "Партия",
      ok: !rec || inActiveBatch,
      text: !rec ? (active ? `№ ${active.number}` : "—") : inActiveBatch ? `№ ${batch?.number}` : `код из партии № ${batch?.number}`,
    },
    { label: "Дубликат", ok: !rec || rec.status === "removed", text: !rec ? "код не зарегистрирован" : rec.status === "removed" ? "код был удалён" : "код уже учтён" },
  ]

  let canAdd = false
  let addBlockedReason: string | undefined
  if (!active) addBlockedReason = "Нет активной партии"
  else if (!gtinOk) addBlockedReason = "Код другой номенклатуры"
  else if (rec && !inActiveBatch) addBlockedReason = `Код принадлежит партии № ${batch?.number}`
  else if (rec && rec.status !== "removed") addBlockedReason = "Код уже учтён в партии"
  else canAdd = true

  let canRemove = false
  let removeBlockedReason: string | undefined
  if (!rec) removeBlockedReason = "Код не найден — удалять нечего"
  else if (!inActiveBatch) removeBlockedReason = `Код из партии № ${batch?.number}. Корректировка закрытых партий — через мастера`
  else if (rec.status === "removed") removeBlockedReason = "Код уже удалён"
  else if (rec.status === "aggregated") removeBlockedReason = `Код в закрытой палете № ${rec.palletNo}. Удаление возможно только через корректировку агрегации (расформирование палеты мастером)`
  else canRemove = true

  const common = { ...base, key: parsed.key, record: rec, batch, inActiveBatch, checks, canAdd, addBlockedReason, canRemove, removeBlockedReason }

  if (!rec) {
    return { ...common, verdict: "НЕ НАЙДЕН", tone: "warning", details: gtinOk ? "Код не зарегистрирован камерой. Если бутыль на линии — его можно добавить." : active ? "Код не зарегистрирован и относится к другой номенклатуре." : "Код не зарегистрирован ни в одной партии." }
  }
  const src = rec.source === "camera" ? "камера" : "вручную"
  if (rec.status === "removed") {
    return { ...common, verdict: "УДАЛЁН", tone: "critical", details: `Партия № ${batch?.number}. Удалён ${fmtTime(rec.removedAt ?? rec.at)}: ${rec.removeReason ?? "—"}.` }
  }
  if (rec.status === "aggregated") {
    const pallet = rec.palletCode ? s.pallets[rec.palletCode] : undefined
    return { ...common, pallet, verdict: "АГРЕГИРОВАН", tone: "success", details: `Палета № ${rec.palletNo} · SSCC ${rec.palletCode ? formatSscc(rec.palletCode) : "—"} · партия № ${batch?.number}` }
  }
  // queued
  if (!inActiveBatch) {
    return { ...common, verdict: "НАНЕСЁН", tone: "success", details: `Партия № ${batch?.number} (закрыта), в палету не агрегирован. Считан ${fmtTime(rec.at)} (${src}).` }
  }
  const idx = s.fifo.indexOf(rec.code)
  const size = active!.palletSize
  const queue = idx >= 0 ? { palletNo: s.palletNo + Math.floor(idx / size), position: (idx % size) + 1, size } : undefined
  return { ...common, queue, verdict: "НАНЕСЁН", tone: "success", details: `Партия № ${active!.number}. Считан ${fmtTime(rec.at)} (${src}). ${queue ? `Ожидает агрегации: палета № ${queue.palletNo}, позиция ${queue.position} из ${size}.` : ""}` }
}

export interface SsccCheck {
  ok: boolean
  code: string
  tone: Tone
  title: string
  message: string
}

export function validateSscc(s: MesState, raw: string): SsccCheck {
  const pv = palletView(s)
  const shown = raw.trim()
  if (!pv) return { ok: false, code: shown, tone: "critical", title: "Нет активной партии", message: "Палетный код принимается только в рамках запущенной партии." }
  const parsed = parseSscc(raw)
  if (!parsed.ok) {
    if (parseDataMatrix(raw)) return { ok: false, code: shown, tone: "critical", title: "Отсканирован код бутылки", message: "Ожидается палетная этикетка SSCC, а не DataMatrix бутыли." }
    return { ok: false, code: shown, tone: "critical", title: "Ошибка сканирования", message: parsed.reason }
  }
  const used = s.pallets[parsed.code]
  if (used) {
    const same = s.lastClosed?.code === parsed.code
    const b = s.batches.find((x) => x.id === used.batchId)
    return same
      ? { ok: false, code: parsed.code, tone: "info", title: "Повторный скан", message: `Палета № ${used.no} уже закрыта этим SSCC. Ничего не изменено.` }
      : { ok: false, code: parsed.code, tone: "critical", title: "Палетный код уже использован", message: `SSCC присвоен палете № ${used.no} партии № ${b?.number ?? "—"}. Возьмите новую этикетку.` }
  }
  if (!pv.awaiting) return { ok: false, code: parsed.code, tone: "warning", title: "Палета ещё не собрана", message: `В палете ${pv.inPallet} из ${pv.size}. SSCC принимается после набора палеты.` }
  return { ok: true, code: parsed.code, tone: "success", title: "SSCC принят", message: "" }
}

/* ════════════════════════════════════════════════════════════════════════════
 * Reducer
 * ════════════════════════════════════════════════════════════════════════════ */

type Action =
  | { type: "CAMERA_READ"; raw: string; at: number }
  | { type: "CAMERA_NOREAD"; at: number }
  | { type: "CAMERA_HEARTBEAT"; at: number }
  | { type: "START_BATCH"; nomenclatureId: string; palletSize: PalletSize; number: string; at: number }
  | { type: "FINISH_BATCH"; at: number }
  | { type: "REQUEST_PARTIAL"; on: boolean; at: number }
  | { type: "SCAN_SSCC"; raw: string; at: number }
  | { type: "MANUAL_ADD"; raw: string; at: number }
  | { type: "MANUAL_REMOVE"; raw: string; reason: string; at: number }
  | { type: "DISMISS_ALERT"; id: string }
  | { type: "SCAN_RECORD"; item: ScanHistoryItem }
  | { type: "UPSERT_NOMENCLATURE"; item: Nomenclature; at: number }
  | { type: "UPDATE_SETTINGS"; patch: Partial<Settings> }
  | { type: "SIM"; patch: Partial<SimState>; at: number }

function log(s: MesState, e: Omit<MesEvent, "id">): MesState {
  return { ...s, events: [{ id: uid(), ...e }, ...s.events].slice(0, 1000) }
}
function patchActive(s: MesState, f: (b: Batch) => Partial<Batch>): MesState {
  return { ...s, batches: s.batches.map((b) => (b.id === s.activeBatchId ? { ...b, ...f(b) } : b)) }
}
function alert(s: MesState, a: Omit<CameraAlert, "id">): MesState {
  return { ...s, alerts: [{ id: uid(), ...a }, ...s.alerts].slice(0, 20) }
}

/** Добавить код в конец FIFO и отметить набор палеты */
function enqueue(s: MesState, code: string, at: number): MesState {
  const b = getActive(s)!
  const before = s.fifo.length
  let next: MesState = { ...s, fifo: [...s.fifo, code] }
  if (before < b.palletSize && next.fifo.length >= b.palletSize) {
    next = log(next, { at, kind: "aggregation", severity: "warning", title: `Палета № ${s.palletNo} собрана — ожидание SSCC`, detail: `${b.palletSize} из ${b.palletSize}`, batchNumber: b.number })
  }
  return next
}

/** Порядковый номер регистрации: каждая регистрация (камера или вручную) увеличивает счётчик */
function nextSeq(s: MesState) {
  const b = getActive(s)!
  return b.applied + b.manualAdded + 1
}

export function reducer(s: MesState, a: Action): MesState {
  switch (a.type) {
    case "CAMERA_HEARTBEAT":
      return { ...s, camera: { lastHeartbeat: a.at } }

    case "CAMERA_READ": {
      const b = getActive(s)
      if (!b) return log(s, { at: a.at, kind: "camera", severity: "info", title: "Считывание вне партии — не учтено" })
      const p = parseDataMatrix(a.raw)
      if (!p) return reducer(s, { type: "CAMERA_NOREAD", at: a.at })
      if (p.gtin !== b.gtin) {
        const n = patchActive(s, (x) => ({ foreign: x.foreign + 1 }))
        return log(alert(n, { at: a.at, kind: "foreign", title: "Код другой номенклатуры", detail: `GTIN ${p.gtin} не соответствует партии. Бутыль не учтена — снимите её с линии.` }), {
          at: a.at, kind: "camera", severity: "warning", title: "Камера: код другой номенклатуры, не учтён", detail: p.serial, batchNumber: b.number,
        })
      }
      const ex = s.codes[p.key]
      if (ex) {
        const n = patchActive(s, (x) => ({ duplicates: x.duplicates + 1 }))
        const where = ex.status === "aggregated" ? `палета № ${ex.palletNo}` : ex.status === "removed" ? "удалён ранее" : `№ ${ex.seq} в очереди`
        return log(alert(n, { at: a.at, kind: "duplicate", title: "Повторный код", detail: `Код уже зарегистрирован (${where}). Бутыль не учтена — проверьте её ручным сканером.` }), {
          at: a.at, kind: "camera", severity: "warning", title: "Камера: повторное считывание кода, не учтено", detail: p.serial, batchNumber: b.number,
        })
      }
      let n: MesState = {
        ...s,
        camera: { lastHeartbeat: a.at },
        codes: { ...s.codes, [p.key]: { code: p.key, batchId: b.id, seq: nextSeq(s), status: "queued", source: "camera", at: a.at } },
      }
      n = patchActive(n, (x) => ({ applied: x.applied + 1, lastCameraAt: a.at }))
      return enqueue(n, p.key, a.at)
    }

    case "CAMERA_NOREAD": {
      const b = getActive(s)
      if (!b) return s
      const n = patchActive(s, (x) => ({ noReads: x.noReads + 1 }))
      return log(alert({ ...n, camera: { lastHeartbeat: a.at } }, { at: a.at, kind: "noread", title: "Камера не прочитала код", detail: "Бутыль прошла без учёта. Снимите её или проверьте ручным сканером и добавьте код." }), {
        at: a.at, kind: "camera", severity: "warning", title: "Камера: код не прочитан (NoRead)", batchNumber: b.number,
      })
    }

    case "START_BATCH": {
      const nom = s.nomenclature.find((n) => n.id === a.nomenclatureId)
      if (!nom || s.activeBatchId) return s
      const b: Batch = {
        id: uid(), number: a.number, nomenclatureId: nom.id, nomenclatureName: nom.name, gtin: nom.gtin, volume: nom.volume, palletSize: a.palletSize,
        status: "active", startedAt: a.at, applied: 0, manualAdded: 0, removed: 0, pallets: 0, noReads: 0, duplicates: 0, foreign: 0, ssccErrors: 0, unaggregated: 0, operator: s.settings.operator,
      }
      const n: MesState = { ...s, batches: [b, ...s.batches], activeBatchId: b.id, fifo: [], palletNo: 1, partialRequested: false, ssccFeedback: undefined, lastClosed: undefined, alerts: [] }
      return log(n, { at: a.at, kind: "batch", severity: "success", title: `Партия № ${b.number} запущена`, detail: `${nom.name} · ${nom.volume} л · палета ${a.palletSize}`, batchNumber: b.number })
    }

    case "FINISH_BATCH": {
      const b = getActive(s)
      if (!b) return s
      const left = s.fifo.length
      const corrected = b.removed > 0 || b.manualAdded > 0 || left > 0
      let n = patchActive(s, () => ({ status: corrected ? "completed_warn" : "completed", finishedAt: a.at, unaggregated: left }))
      n = { ...n, activeBatchId: null, fifo: [], palletNo: 1, partialRequested: false, ssccFeedback: undefined, lastClosed: undefined, alerts: [] }
      const done = n.batches.find((x) => x.id === b.id)!
      return log(n, {
        at: a.at, kind: "batch", severity: left ? "warning" : "success", title: `Партия № ${b.number} завершена`,
        detail: `Всего бутылей ${batchTotal(done)}, палет ${done.pallets}${left ? `, без агрегации ${left}` : ""}`, batchNumber: b.number,
      })
    }

    case "REQUEST_PARTIAL": {
      const b = getActive(s)
      if (!b || (a.on && s.fifo.length === 0)) return s
      const n = { ...s, partialRequested: a.on, ssccFeedback: undefined }
      return a.on ? log(n, { at: a.at, kind: "aggregation", severity: "warning", title: `Закрытие неполной палеты № ${s.palletNo}: ожидание SSCC`, detail: `${Math.min(s.fifo.length, b.palletSize)} из ${b.palletSize}`, batchNumber: b.number }) : n
    }

    case "SCAN_SSCC": {
      const b = getActive(s)
      const v = validateSscc(s, a.raw)
      const feedback: SsccFeedback = { tone: v.tone, title: v.title, message: v.message, code: v.code, at: a.at }
      if (!b) return s
      if (!v.ok) {
        let n: MesState = { ...s, ssccFeedback: feedback }
        if (v.tone === "critical") n = patchActive(n, (x) => ({ ssccErrors: x.ssccErrors + 1 }))
        return log(n, { at: a.at, kind: "aggregation", severity: v.tone === "critical" ? "critical" : "info", title: `SSCC отклонён: ${v.title.toLowerCase()}`, detail: v.message, batchNumber: b.number })
      }
      const group = s.fifo.slice(0, b.palletSize)
      const partial = group.length < b.palletSize
      const codes = { ...s.codes }
      for (const c of group) codes[c] = { ...codes[c], status: "aggregated", palletNo: s.palletNo, palletCode: v.code }
      const pallet: PalletRecord = { code: v.code, batchId: b.id, no: s.palletNo, count: group.length, closedAt: a.at, partial }
      let n: MesState = {
        ...s,
        codes,
        pallets: { ...s.pallets, [v.code]: pallet },
        fifo: s.fifo.slice(group.length),
        palletNo: s.palletNo + 1,
        partialRequested: false,
        ssccFeedback: undefined,
        lastClosed: { no: s.palletNo, code: v.code, count: group.length, at: a.at, partial },
      }
      n = patchActive(n, (x) => ({ pallets: x.pallets + 1 }))
      n = log(n, { at: a.at, kind: "aggregation", severity: "success", title: `Палета № ${s.palletNo} закрыта${partial ? " (неполная)" : ""}`, detail: `${formatSscc(v.code)} · ${group.length} бут.`, batchNumber: b.number })
      if (n.fifo.length >= b.palletSize) n = log(n, { at: a.at, kind: "aggregation", severity: "warning", title: `Палета № ${n.palletNo} собрана — ожидание SSCC`, detail: `${b.palletSize} из ${b.palletSize}`, batchNumber: b.number })
      return n
    }

    case "MANUAL_ADD": {
      const v = evaluateCode(s, a.raw)
      const b = getActive(s)
      if (!v.canAdd || !v.key || !b) return s
      const prev = s.codes[v.key]
      let n: MesState = {
        ...s,
        codes: { ...s.codes, [v.key]: { code: v.key, batchId: b.id, seq: prev?.seq ?? nextSeq(s), status: "queued", source: "manual", at: a.at } },
      }
      n = patchActive(n, (x) => ({ manualAdded: x.manualAdded + 1 }))
      n = enqueue(n, v.key, a.at)
      return log(n, { at: a.at, kind: "codes", severity: "info", title: prev ? "Удалённый код возвращён в партию" : "Код добавлен вручную", detail: shortCode(v.key), batchNumber: b.number })
    }

    case "MANUAL_REMOVE": {
      const v = evaluateCode(s, a.raw)
      const b = getActive(s)
      if (!v.canRemove || !v.key || !b) return s
      const wasFull = s.fifo.length >= b.palletSize
      let n: MesState = {
        ...s,
        codes: { ...s.codes, [v.key]: { ...s.codes[v.key], status: "removed", removedAt: a.at, removeReason: a.reason } },
        fifo: s.fifo.filter((c) => c !== v.key),
        ssccFeedback: undefined,
      }
      if (n.fifo.length === 0) n = { ...n, partialRequested: false }
      n = patchActive(n, (x) => ({ removed: x.removed + 1 }))
      n = log(n, { at: a.at, kind: "codes", severity: "warning", title: "Код удалён из партии", detail: `${shortCode(v.key)} · ${a.reason}`, batchNumber: b.number })
      if (wasFull && n.fifo.length < b.palletSize) n = log(n, { at: a.at, kind: "aggregation", severity: "info", title: `Палета № ${s.palletNo}: после удаления ${n.fifo.length} из ${b.palletSize}, ожидание SSCC снято`, batchNumber: b.number })
      return n
    }

    case "DISMISS_ALERT":
      return { ...s, alerts: s.alerts.filter((x) => x.id !== a.id) }

    case "SCAN_RECORD":
      return { ...s, scanHistory: [a.item, ...s.scanHistory].slice(0, 50) }

    case "UPSERT_NOMENCLATURE": {
      const exists = s.nomenclature.some((n) => n.id === a.item.id)
      const n = { ...s, nomenclature: exists ? s.nomenclature.map((x) => (x.id === a.item.id ? a.item : x)) : [a.item, ...s.nomenclature] }
      return log(n, { at: a.at, kind: "system", severity: "info", title: exists ? "Номенклатура изменена" : "Номенклатура создана", detail: `${a.item.name} · ${a.item.volume} л` })
    }

    case "UPDATE_SETTINGS":
      return { ...s, settings: { ...s.settings, ...a.patch } }

    case "SIM": {
      let n: MesState = { ...s, sim: { ...s.sim, ...a.patch } }
      if (a.patch.cameraLink !== undefined && a.patch.cameraLink !== s.sim.cameraLink) {
        n = log(n, { at: a.at, kind: "system", severity: "info", title: `Симуляция: связь с камерой ${a.patch.cameraLink ? "восстановлена" : "прервана"}` })
        if (a.patch.cameraLink) n = { ...n, camera: { lastHeartbeat: a.at } }
      }
      return n
    }
  }
}

/** Связь с камерой определяется по heartbeat, а не по наличию считываний: простой линии — не авария */
export function cameraSilenceMs(s: MesState, now: number) {
  return now - s.camera.lastHeartbeat
}
export function isCameraOnline(s: MesState, now: number) {
  return cameraSilenceMs(s, now) < s.settings.cameraTimeoutSec * 1000
}

/** Проверка согласованности счётчиков: используется в тестовом сценарии и в dev-режиме */
export function checkInvariants(s: MesState): string[] {
  const errs: string[] = []
  for (const b of s.batches) {
    const recs = Object.values(s.codes).filter((c) => c.batchId === b.id)
    if (recs.length === 0) continue // архивные партии без детализации
    const cam = recs.filter((c) => c.source === "camera").length
    const inPallets = Object.values(s.pallets).filter((p) => p.batchId === b.id).reduce((a, p) => a + p.count, 0)
    const aggregated = recs.filter((c) => c.status === "aggregated").length
    const queued = recs.filter((c) => c.status === "queued").length
    const removed = recs.filter((c) => c.status === "removed").length
    if (inPallets !== aggregated) errs.push(`${b.number}: в палетах ${inPallets}, агрегированных кодов ${aggregated}`)
    if (batchTotal(b) !== aggregated + queued) errs.push(`${b.number}: всего ${batchTotal(b)} ≠ агрегировано ${aggregated} + в очереди ${queued}`)
    if (b.removed < removed) errs.push(`${b.number}: удалено ${b.removed} < удалённых кодов ${removed}`)
    if (cam > b.applied) errs.push(`${b.number}: камерных кодов ${cam} > нанесено ${b.applied}`)
    if (b.id === s.activeBatchId && queued !== s.fifo.length) errs.push(`${b.number}: в очереди ${queued} ≠ FIFO ${s.fifo.length}`)
  }
  return errs
}

/* ════════════════════════════════════════════════════════════════════════════
 * Демо-данные: строятся прогоном reducer — счётчики согласованы по построению
 * ════════════════════════════════════════════════════════════════════════════ */

export const SEED_NOMENCLATURE: Nomenclature[] = [
  { id: "n1", name: "Вода питьевая «Горный родник»", sku: "GR-19-001", gtin: "04607123450019", volume: 19, description: "Артезианская, высшей категории. Поликарбонатная бутыль.", active: true, defaultPalletSize: 48 },
  { id: "n2", name: "Вода питьевая «Горный родник»", sku: "GR-11-001", gtin: "04607123450118", volume: 11, description: "Артезианская, высшей категории. ПЭТ-бутыль.", active: true, defaultPalletSize: 48 },
  { id: "n3", name: "Вода «Кристальная» негазированная", sku: "KR-19-002", gtin: "04607123450217", volume: 19, description: "Первой категории. Бутыль ПЭТ многоразовая.", active: true, defaultPalletSize: 36 },
  { id: "n4", name: "Вода детская «Малыш»", sku: "ML-11-003", gtin: "04607123450316", volume: 11, description: "Для детского питания с 0 месяцев.", active: true, defaultPalletSize: 36 },
  { id: "n5", name: "Вода «Кристальная» с йодом", sku: "KR-19-004", gtin: "04607123450415", volume: 19, description: "Снята с производства.", active: false, defaultPalletSize: 48 },
]

export function emptyState(now = Date.now()): MesState {
  return {
    nomenclature: SEED_NOMENCLATURE,
    batches: [],
    activeBatchId: null,
    fifo: [],
    palletNo: 1,
    partialRequested: false,
    codes: {},
    pallets: {},
    events: [],
    alerts: [],
    scanHistory: [],
    camera: { lastHeartbeat: now },
    settings: {
      lineName: "Линия розлива № 1",
      defaultPalletSize: 48,
      allowPartialPallet: true,
      defaultScanMode: "check",
      largeText: false,
      cameraTimeoutSec: 10,
      cameraAddress: "192.168.10.22:2001",
      operator: "Смирнова Е.",
    },
    sim: { flow: true, intervalMs: 2500, cameraLink: true },
  }
}

/** Прогон партии через reducer: n бутылей, закрытие палет, редкие NoRead */
function runBatch(s: MesState, nomId: string, size: PalletSize, number: string, start: number, bottles: number, stepMs: number, finish: boolean) {
  s = reducer(s, { type: "START_BATCH", nomenclatureId: nomId, palletSize: size, number, at: start })
  const gtin = s.nomenclature.find((n) => n.id === nomId)!.gtin
  let t = start
  for (let i = 0; i < bottles; i++) {
    t += stepMs
    s = reducer(s, { type: "CAMERA_READ", raw: makeDataMatrix(gtin), at: t })
    if (i % 157 === 77) s = reducer(s, { type: "CAMERA_NOREAD", at: t + 900 })
    if (s.fifo.length >= size) s = reducer(s, { type: "SCAN_SSCC", raw: makeSscc(), at: t + 25_000 })
  }
  if (finish) s = reducer(s, { type: "FINISH_BATCH", at: t + 60_000 })
  return { s, t }
}

export function seed(): MesState {
  const now = Date.now()
  const H = 3600_000
  let s = emptyState(now)
  const hist: [string, PalletSize, string, number, number][] = [
    ["n3", 36, "2609-031", 98, 36 * 26],
    ["n1", 48, "2609-034", 74, 48 * 36 + 11],
    ["n2", 48, "2609-037", 54, 48 * 25],
    ["n4", 36, "2709-040", 30, 36 * 15],
    ["n3", 36, "2709-041", 26, 36 * 36],
    ["n1", 48, "2809-042", 7, 48 * 22],
  ]
  for (const [nom, size, num, ago, n] of hist) {
    s = runBatch(s, nom, size, num, now - ago * H, n, 5200, true).s
    // Архивные партии в прототипе не храним покодово — детализация остаётся только у последней
    const keep = s.batches[0].id
    s = { ...s, codes: Object.fromEntries(Object.entries(s.codes).filter(([, c]) => c.batchId === keep)) }
  }
  s = { ...s, events: s.events.filter((e) => e.kind !== "camera") }

  // Активная партия: 7 палет закрыто, в текущей 43 из 48
  const r = runBatch(s, "n1", 48, "2809-043", now - 50 * 60_000, 48 * 7 + 43, 5500, false)
  s = r.s
  // Одна перемаркированная бутыль, добавленная вручную
  const manual = makeDataMatrix("04607123450019")
  s = reducer(s, { type: "MANUAL_ADD", raw: manual, at: r.t + 1000 })
  // Шаги по времени сдвигаем так, чтобы последний код был ~20 с назад
  const lastRead = r.t
  const shift = now - 20_000 - lastRead
  const sh = (t: number) => t + shift
  s = {
    ...s,
    codes: Object.fromEntries(Object.entries(s.codes).map(([k, c]) => [k, c.batchId === s.activeBatchId ? { ...c, at: sh(c.at) } : c])),
    batches: s.batches.map((b) => (b.id === s.activeBatchId ? { ...b, lastCameraAt: b.lastCameraAt && sh(b.lastCameraAt), startedAt: sh(b.startedAt) } : b)),
    pallets: Object.fromEntries(Object.entries(s.pallets).map(([k, p]) => [k, p.batchId === s.activeBatchId ? { ...p, closedAt: sh(p.closedAt) } : p])),
    events: s.events.map((e) => (e.batchNumber === "2809-043" ? { ...e, at: sh(e.at) } : e)).sort((a, b) => b.at - a.at),
    lastClosed: s.lastClosed && { ...s.lastClosed, at: sh(s.lastClosed.at) },
    alerts: [],
    camera: { lastHeartbeat: now },
  }
  return s
}

