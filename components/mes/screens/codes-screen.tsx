"use client"

import { useEffect, useRef, useState } from "react"
import { Check, History, MinusCircle, PlusCircle, ScanLine, ScanSearch, Trash2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  REMOVE_REASONS,
  evaluateCode,
  fmtTime,
  formatSscc,
  parseDataMatrix,
  parseSscc,
  shortCode,
  useMes,
  type CodeEvaluation,
  type ScanMode,
  type Tone,
} from "../store"
import { Btn, ConfirmDialog, EmptyState, Segmented, TONE, TextInput } from "../ui"
import { useMesUi, useScanHandler } from "../ui-context"

const MODE: Record<ScanMode, { label: string; icon: typeof ScanSearch; hint: string }> = {
  check: { label: "Проверить код", icon: ScanSearch, hint: "Покажет, учтён ли код и где он находится" },
  add: { label: "Добавить код", icon: PlusCircle, hint: "Каждый допустимый скан сразу добавляется в конец FIFO партии" },
  remove: { label: "Удалить код", icon: MinusCircle, hint: "После скана выберите причину и подтвердите удаление" },
}

type Outcome = "added" | "removed" | "add_blocked"
interface Current {
  raw: string
  mode: ScanMode
  outcome?: Outcome
  /** Проверки на момент скана (для добавления — до изменения учёта) */
  checks?: CodeEvaluation["checks"]
  id: number
}

export function CodesScreen() {
  const mes = useMes()
  const { state, active } = mes
  const { pendingScan, consumePendingScan, toast } = useMesUi()
  const [mode, setMode] = useState<ScanMode>(state.settings.defaultScanMode)
  const [value, setValue] = useState("")
  const [cur, setCur] = useState<Current | null>(null)
  const [reason, setReason] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const stateRef = useRef(state)
  stateRef.current = state
  const modeRef = useRef(mode)
  modeRef.current = mode

  const focus = () => window.setTimeout(() => inputRef.current?.focus(), 0)

  // Поле сканера держит фокус, пока не открыт диалог подтверждения
  useEffect(() => {
    if (confirm) return
    const id = window.setInterval(() => {
      const el = document.activeElement
      if (!el || el === document.body) inputRef.current?.focus()
    }, 600)
    inputRef.current?.focus()
    return () => window.clearInterval(id)
  }, [confirm])

  const handleScan = (raw: string, m: ScanMode = modeRef.current) => {
    const code = raw.replace(/[\r\n]+$/g, "")
    if (!code.trim()) return
    const ev = evaluateCode(stateRef.current, code)
    let outcome: Outcome | undefined
    if (m === "add") {
      if (ev.canAdd) {
        mes.manualAdd(code)
        outcome = "added"
        toast({ tone: "success", title: "Код добавлен в партию", text: shortCode(ev.key!) })
      } else outcome = "add_blocked"
    }
    setCur((c) => ({ raw: code, mode: m, outcome, checks: m === "add" ? ev.checks : undefined, id: (c?.id ?? 0) + 1 }))
    setReason(null)
    mes.recordScan({ mode: m, code: ev.key ?? code, tone: outcome === "added" ? "success" : outcome === "add_blocked" ? "critical" : ev.tone, title: outcome === "added" ? "Добавлен" : outcome === "add_blocked" ? `Не добавлен: ${ev.addBlockedReason}` : ev.verdict })
    setValue("")
    focus()
  }

  useScanHandler((raw) => handleScan(raw))

  useEffect(() => {
    if (pendingScan) {
      handleScan(pendingScan, "check")
      setMode("check")
      consumePendingScan()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingScan])

  const doRemove = () => {
    if (!cur || !reason) return
    mes.manualRemove(cur.raw, reason)
    const key = parseDataMatrix(cur.raw)?.key ?? cur.raw
    mes.recordScan({ mode: "remove", code: key, tone: "critical", title: `Удалён: ${reason}` })
    toast({ tone: "warning", title: "Код удалён из партии", text: `${shortCode(key)} · ${reason}` })
    setCur({ ...cur, mode: "remove", outcome: "removed", id: cur.id + 1 })
    setConfirm(false)
    setReason(null)
    focus()
  }

  const ev = cur ? evaluateCode(state, cur.raw) : null

  return (
    <div className="grid gap-5 xl:h-full xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="flex min-w-0 flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-[26px] font-bold text-mes-ink">Работа с кодами</h1>
          <p className="text-[16px] text-mes-ink-2">{active ? `Партия № ${active.number} · ${active.nomenclatureName} · ${active.volume} л` : "Партия не запущена — доступна только проверка"}</p>
        </div>

        <Segmented
          size="lg"
          value={mode}
          onChange={(m) => {
            setMode(m)
            setCur(null)
            focus()
          }}
          options={(Object.keys(MODE) as ScanMode[]).map((m) => ({ value: m, label: MODE[m].label, icon: MODE[m].icon }))}
        />

        <form
          className="flex gap-3 rounded-2xl border border-mes-line bg-mes-card p-4"
          onSubmit={(e) => {
            e.preventDefault()
            handleScan(value)
          }}
        >
          <div className="flex size-[68px] shrink-0 items-center justify-center rounded-xl bg-mes-olive-soft">
            <ScanLine className="size-8 text-mes-olive-strong" />
          </div>
          <div className="min-w-0 flex-1">
            <TextInput ref={inputRef} value={value} onChange={(e) => setValue(e.target.value)} placeholder="Отсканируйте DataMatrix ручным сканером" className="h-[68px] font-mono text-[20px]" autoComplete="off" spellCheck={false} />
          </div>
          <Btn type="submit" size="lg" variant="primary" disabled={!value.trim()} className="min-w-40">
            {mode === "add" ? "Добавить" : mode === "remove" ? "Найти" : "Проверить"}
          </Btn>
        </form>
        <p className="-mt-3 px-1 text-[15px] text-mes-ink-3">{MODE[mode].hint}. Сканер работает в режиме клавиатуры: код вводится автоматически, Enter завершает скан.</p>

        {!cur || !ev ? (
          <section className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-mes-line-strong bg-mes-card p-10 text-center">
            <ScanSearch className="size-14 text-mes-line-strong" />
            <p className="text-[22px] font-semibold text-mes-ink-2">Ожидание скана</p>
          </section>
        ) : (
          <Result
            key={cur.id}
            ev={ev}
            cur={cur}
            reason={reason}
            onReason={setReason}
            onRemove={() => setConfirm(true)}
            onAdd={() => handleScan(cur.raw, "add")}
            onStartRemove={() => {
              setMode("remove")
              setCur({ ...cur, mode: "remove", outcome: undefined, id: cur.id + 1 })
            }}
          />
        )}
      </div>

      <ScanHistory onPick={(code) => setCur((c) => ({ raw: code, mode: "check", id: (c?.id ?? 0) + 1 }))} />

      <ConfirmDialog
        open={confirm}
        onClose={() => {
          setConfirm(false)
          focus()
        }}
        onConfirm={doRemove}
        icon={Trash2}
        title="Удалить код из партии?"
        confirmLabel="Удалить код"
      >
        {ev && (
          <div className="flex flex-col gap-3 text-[18px]">
            <p className="text-mes-ink-2">
              Код будет исключён из FIFO палеты № {ev.queue?.palletNo}. «Всего бутылей в партии» уменьшится на 1, «Нанесено кодов» не изменится. Бутыль с этим кодом должна быть снята с линии.
            </p>
            <p>
              Причина: <b>{reason}</b>
            </p>
            <p className="break-all rounded-xl bg-mes-panel p-3 font-mono text-[15px] ring-1 ring-mes-line">{ev.key}</p>
          </div>
        )}
      </ConfirmDialog>
    </div>
  )
}

/* ─── Результат скана ─── */

function Result({
  ev,
  cur,
  reason,
  onReason,
  onRemove,
  onAdd,
  onStartRemove,
}: {
  ev: CodeEvaluation
  cur: Current
  reason: string | null
  onReason: (r: string) => void
  onRemove: () => void
  onAdd: () => void
  onStartRemove: () => void
}) {
  const sscc = !parseDataMatrix(cur.raw) && parseSscc(cur.raw).ok
  const headline =
    cur.outcome === "added" ? { text: "Код добавлен в партию", tone: "success" as Tone } :
    cur.outcome === "removed" ? { text: "Код удалён из партии", tone: "critical" as Tone } :
    cur.outcome === "add_blocked" ? { text: `Добавление невозможно: ${ev.addBlockedReason}`, tone: "critical" as Tone } : null
  const tone = headline?.tone ?? ev.tone
  const t = TONE[tone]
  const r = ev.record

  const facts: [string, string][] = []
  if (r) {
    facts.push(["Партия", `№ ${ev.batch?.number ?? "—"}${ev.inActiveBatch ? " (текущая)" : ""}`])
    if (r.status === "aggregated") facts.push(["Палета", `№ ${r.palletNo} · закрыта`], ["SSCC", r.palletCode ? formatSscc(r.palletCode) : "—"])
    if (r.status === "queued") facts.push(["Палета", ev.queue ? `№ ${ev.queue.palletNo} · позиция ${ev.queue.position} из ${ev.queue.size}` : "не агрегирован"])
    facts.push(["Зарегистрирован", `${fmtTime(r.at)} · ${r.source === "camera" ? "камера" : "вручную"}`])
    if (r.status === "removed") facts.push(["Удалён", `${fmtTime(r.removedAt ?? r.at)} · ${r.removeReason ?? "—"}`])
  }

  return (
    <section className={cn("flex flex-col overflow-hidden rounded-2xl border-2 bg-mes-card", t.border)}>
      <div className={cn("px-6 py-5", t.soft)}>
        {headline && <p className={cn("mb-1 text-[20px] font-bold", t.text)}>{headline.text}</p>}
        <p className={cn("text-[64px] font-black leading-none tracking-tight", TONE[ev.tone].text)}>{ev.verdict}</p>
        <p className="mt-3 text-[18px] text-mes-ink-2">{sscc ? "Отсканирован палетный код SSCC. Подтверждение палеты выполняется на экране «Линия»." : ev.details}</p>
      </div>

      <div className="flex flex-col gap-5 px-6 py-5">
        {facts.length > 0 && (
          <dl className="grid grid-cols-2 gap-x-8 gap-y-3 lg:grid-cols-3">
            {facts.map(([k, v]) => (
              <div key={k}>
                <dt className="text-[13px] font-semibold uppercase tracking-[0.04em] text-mes-ink-3">{k}</dt>
                <dd className="mt-0.5 text-[18px] font-semibold text-mes-ink">{v}</dd>
              </div>
            ))}
          </dl>
        )}

        {cur.mode === "add" && (
          <ul className="grid gap-2 sm:grid-cols-2">
            {(cur.checks ?? ev.checks).map((c) => (
              <li key={c.label} className="flex items-center gap-3 rounded-xl bg-mes-panel px-4 py-3 ring-1 ring-mes-line">
                {c.ok ? <Check className="size-6 shrink-0 text-mes-olive-strong" /> : <X className="size-6 shrink-0 text-mes-red" />}
                <span className="text-[16px] font-semibold text-mes-ink">{c.label}</span>
                <span className="ml-auto truncate text-[15px] text-mes-ink-2">{c.text}</span>
              </li>
            ))}
          </ul>
        )}

        {cur.mode === "remove" && cur.outcome !== "removed" && (
          ev.canRemove ? (
            <div className="flex flex-col gap-3">
              <p className="text-[14px] font-semibold uppercase tracking-[0.04em] text-mes-ink-2">Причина удаления</p>
              <div className="grid grid-cols-2 gap-2">
                {REMOVE_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => onReason(r)}
                    className={cn("min-h-16 rounded-xl border-2 px-4 text-left text-[17px] font-semibold", reason === r ? "border-mes-red bg-mes-red-soft text-mes-red-strong" : "border-mes-line bg-mes-card text-mes-ink hover:bg-mes-panel")}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <Btn size="lg" variant="danger" icon={Trash2} disabled={!reason} onClick={onRemove} className="self-start">
                Удалить код…
              </Btn>
            </div>
          ) : (
            <p className="rounded-xl bg-mes-panel px-4 py-3 text-[17px] font-semibold text-mes-ink-2 ring-1 ring-mes-line">Удаление недоступно: {ev.removeBlockedReason}</p>
          )
        )}

        {cur.mode === "check" && (ev.canAdd || ev.canRemove || ev.record?.status === "aggregated") && (
          <div className="flex flex-wrap items-center gap-3">
            {ev.canAdd && (
              <Btn size="lg" variant="primary" icon={PlusCircle} onClick={onAdd}>
                Добавить в партию
              </Btn>
            )}
            {ev.canRemove && (
              <Btn size="lg" variant="danger" icon={MinusCircle} onClick={onStartRemove}>
                Удалить код…
              </Btn>
            )}
            {ev.record?.status === "aggregated" && ev.inActiveBatch && <p className="text-[15px] text-mes-ink-3">{ev.removeBlockedReason}</p>}
          </div>
        )}
      </div>
    </section>
  )
}

function ScanHistory({ onPick }: { onPick: (code: string) => void }) {
  const { state } = useMes()
  return (
    <section className="flex min-h-[360px] flex-col overflow-hidden rounded-2xl border border-mes-line bg-mes-card xl:min-h-0">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-mes-line px-4">
        <History className="size-5 text-mes-ink-3" />
        <h2 className="text-[14px] font-semibold uppercase tracking-[0.05em] text-mes-ink-2">История сканов смены</h2>
      </header>
      {state.scanHistory.length === 0 ? (
        <EmptyState icon={ScanLine} title="Сканов пока нет" />
      ) : (
        <div className="min-h-0 flex-1 divide-y divide-mes-line overflow-y-auto">
          {state.scanHistory.map((h) => (
            <button key={h.id} type="button" onClick={() => onPick(h.code)} className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left hover:bg-mes-panel">
              <span className={cn("h-9 w-1.5 shrink-0 rounded-full", TONE[h.tone].dot)} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] font-semibold text-mes-ink">{h.title}</span>
                <span className="block truncate font-mono text-[13px] text-mes-ink-3">{shortCode(h.code)}</span>
              </span>
              <span className="shrink-0 text-right text-[13px] text-mes-ink-3">
                <span className="block font-semibold uppercase">{h.mode === "check" ? "проверка" : h.mode === "add" ? "добавление" : "удаление"}</span>
                <span className="tabular-nums">{fmtTime(h.at)}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
