"use client"

import { useEffect, useRef, useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  History,
  Info,
  MinusCircle,
  PlusCircle,
  RotateCcw,
  ScanLine,
  ScanSearch,
  Trash2,
  XCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  CODE_STATUS_LABEL,
  evaluateCode,
  fmtTime,
  formatSscc,
  parseDataMatrix,
  shortCode,
  useMes,
  type CodeEvaluation,
  type ScanMode,
  type Tone,
} from "../store"
import { Btn, Card, ConfirmDialog, EmptyState, PageHeader, Segmented, StatusPill, TONE, TextInput } from "../ui"
import { useMesUi } from "../ui-context"

const MODE: Record<ScanMode, { label: string; icon: typeof ScanSearch; hint: string }> = {
  check: { label: "Проверить код", icon: ScanSearch, hint: "Скан показывает статус кода. Действия — по кнопкам под результатом." },
  add: { label: "Добавить код", icon: PlusCircle, hint: "Каждый скан сразу добавляет код в текущую партию, если это допустимо." },
  remove: { label: "Удалить код", icon: MinusCircle, hint: "Скан находит код, удаление — после подтверждения." },
}

const RESULT_ICON: Record<Tone, typeof CheckCircle2> = { success: CheckCircle2, warning: AlertTriangle, critical: XCircle, info: Info, neutral: Info }

interface Result {
  ev: CodeEvaluation
  mode: ScanMode
  action?: "added" | "removed"
}

export function CodesScreen() {
  const mes = useMes()
  const { state, active } = mes
  const { toast, pendingScan, consumePendingScan } = useMesUi()
  const [mode, setMode] = useState<ScanMode>(state.settings.defaultScanMode)
  const [value, setValue] = useState("")
  const [result, setResult] = useState<Result | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const stateRef = useRef(state)
  stateRef.current = state

  // Поле сканера всегда в фокусе, пока не открыт диалог
  useEffect(() => {
    if (confirmRemove) return
    const focus = () => {
      const el = document.activeElement
      if (!el || el === document.body) inputRef.current?.focus()
    }
    focus()
    const id = window.setInterval(focus, 800)
    return () => window.clearInterval(id)
  }, [confirmRemove])

  const doRemove = (code: string) => {
    mes.manualRemove(code)
    const ev = evaluateCode({ ...stateRef.current }, code, "remove")
    setResult({ ev: { ...ev, tone: "critical", title: "Код удалён из партии", message: "Код исключён из партии и из текущей палеты. Бутыль должна быть снята с линии." }, mode, action: "removed" })
    mes.recordScan({ mode: "remove", code, tone: "critical", title: "Удалён" })
    toast({ tone: "warning", title: "Код удалён из партии", text: shortCode(code) })
  }

  const handleScan = (raw: string, m: ScanMode = mode) => {
    const code = raw.trim()
    if (!code) return
    const ev = evaluateCode(stateRef.current, code, m)
    const parsed = parseDataMatrix(code)
    const key = parsed?.code ?? code

    if (m === "add" && ev.canAdd) {
      mes.manualAdd(key)
      setResult({ ev: { ...ev, tone: "success", title: "Код добавлен в партию", message: "Код зарегистрирован как нанесённый вручную и направлен в текущую палету." }, mode: m, action: "added" })
      mes.recordScan({ mode: m, code: key, tone: "success", title: "Добавлен" })
    } else if (m === "remove" && ev.canRemove && !stateRef.current.settings.confirmRemove) {
      doRemove(key)
    } else {
      setResult({ ev, mode: m })
      mes.recordScan({ mode: m, code: key, tone: ev.tone, title: ev.title })
      if (m === "remove" && ev.canRemove) setConfirmRemove(key)
    }
    setValue("")
  }

  // Код, пойманный глобальным перехватом сканера на другом экране
  useEffect(() => {
    if (pendingScan) {
      handleScan(pendingScan)
      consumePendingScan()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingScan])

  const session = state.scanHistory.reduce(
    (acc, h) => {
      acc[h.mode]++
      return acc
    },
    { check: 0, add: 0, remove: 0 } as Record<ScanMode, number>,
  )

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Ручная работа с кодами"
        subtitle={active ? `Партия № ${active.number} · ${active.nomenclatureName} · ${active.volume} л` : "Нет активной партии — доступна только проверка кодов"}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Segmented
            size="lg"
            value={mode}
            onChange={(m) => {
              setMode(m)
              setResult(null)
              inputRef.current?.focus()
            }}
            options={(Object.keys(MODE) as ScanMode[]).map((m) => ({ value: m, label: MODE[m].label, icon: MODE[m].icon }))}
          />

          <section className={cn("rounded-2xl border-2 border-dashed bg-mes-card p-5", mode === "remove" ? "border-mes-red/40" : mode === "add" ? "border-mes-olive/50" : "border-mes-line-strong")}>
            <div className="flex items-center gap-4">
              <span className={cn("flex size-16 shrink-0 items-center justify-center rounded-2xl", mode === "remove" ? "bg-mes-red-soft" : "bg-mes-olive-soft")}>
                <ScanLine className={cn("size-9", mode === "remove" ? "text-mes-red-strong" : "text-mes-olive-strong")} />
              </span>
              <div>
                <p className="text-[22px] font-bold text-mes-ink">Отсканируйте DataMatrix ручным сканером</p>
                <p className="text-[16px] text-mes-ink-2">{MODE[mode].hint}</p>
              </div>
            </div>
            <form
              className="mt-4 flex gap-3"
              onSubmit={(e) => {
                e.preventDefault()
                handleScan(value)
              }}
            >
              <TextInput ref={inputRef} value={value} onChange={(e) => setValue(e.target.value)} placeholder="Сканер готов · или вставьте код" className="h-[72px] font-mono text-[20px]" autoComplete="off" spellCheck={false} />
              <Btn type="submit" size="lg" variant="primary" disabled={!value.trim()} className="min-w-40">
                {mode === "check" ? "Проверить" : mode === "add" ? "Добавить" : "Найти"}
              </Btn>
            </form>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="mr-1 text-[13px] font-semibold uppercase tracking-wider text-mes-ink-3">Демо-сканер</span>
              {(
                [
                  ["current", "Из текущей палеты"],
                  ["aggregated", "Агрегированный"],
                  ["new", "Новый код"],
                  ["other_batch", "Другая партия"],
                  ["foreign", "Чужой GTIN"],
                  ["invalid", "Неверный формат"],
                ] as const
              ).map(([k, label]) => (
                <button key={k} type="button" onClick={() => handleScan(mes.demoCode(k))} className="h-11 rounded-xl border border-mes-line-strong bg-mes-card px-3.5 text-[14px] font-semibold text-mes-ink-2 hover:bg-mes-panel">
                  {label}
                </button>
              ))}
            </div>
          </section>

          <ResultPanel
            result={result}
            onAdd={(code) => handleScan(code, "add")}
            onRemove={(code) => (state.settings.confirmRemove ? setConfirmRemove(code) : doRemove(code))}
            onReset={() => {
              setResult(null)
              inputRef.current?.focus()
            }}
          />
        </div>

        <Card
          title="История сканов"
          icon={History}
          bodyClassName="p-0"
          className="xl:max-h-[calc(100dvh-200px)]"
        >
          <div className="grid grid-cols-3 border-b border-mes-line text-center">
            {[
              ["Проверено", session.check, "text-mes-ink"],
              ["Добавлено", session.add, "text-mes-olive-deep"],
              ["Удалено", session.remove, "text-mes-red-strong"],
            ].map(([k, v, c]) => (
              <div key={k as string} className="py-3">
                <p className={cn("text-[24px] font-bold tabular-nums", c as string)}>{v}</p>
                <p className="text-[12px] font-semibold uppercase text-mes-ink-3">{k}</p>
              </div>
            ))}
          </div>
          {state.scanHistory.length === 0 ? (
            <EmptyState icon={ScanLine} title="Сканов пока нет" text="Здесь появятся последние 50 сканов этой смены" />
          ) : (
            <div className="max-h-full divide-y divide-mes-line overflow-y-auto">
              {state.scanHistory.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => {
                    setResult({ ev: evaluateCode(state, h.code, "check"), mode: "check" })
                  }}
                  className="flex min-h-[68px] w-full items-center gap-3 px-5 py-2.5 text-left hover:bg-mes-panel"
                >
                  <span className={cn("h-10 w-1.5 shrink-0 rounded-full", TONE[h.tone].dot)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px] font-semibold text-mes-ink">{h.title}</span>
                    <span className="block truncate font-mono text-[13px] text-mes-ink-3">{shortCode(h.code)}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[12px] font-semibold uppercase text-mes-ink-3">{h.mode === "check" ? "проверка" : h.mode === "add" ? "добавление" : "удаление"}</span>
                    <span className="block text-[13px] tabular-nums text-mes-ink-3">{fmtTime(h.at)}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={!!confirmRemove}
        onClose={() => setConfirmRemove(null)}
        onConfirm={() => {
          if (confirmRemove) doRemove(confirmRemove)
          setConfirmRemove(null)
        }}
        icon={Trash2}
        title="Удалить код из партии?"
        message="Код будет исключён из партии и текущей палеты. Бутыль с этим кодом нужно снять с линии. Действие фиксируется в журнале."
        confirmLabel="Удалить код"
      >
        {confirmRemove && <p className="mt-4 break-all rounded-xl bg-mes-panel p-4 font-mono text-[16px] text-mes-ink ring-1 ring-mes-line">{confirmRemove}</p>}
      </ConfirmDialog>
    </div>
  )
}

function ResultPanel({ result, onAdd, onRemove, onReset }: { result: Result | null; onAdd: (c: string) => void; onRemove: (c: string) => void; onReset: () => void }) {
  if (!result) {
    return (
      <section className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-2xl border border-mes-line bg-mes-card p-8 text-center">
        <ScanSearch className="size-14 text-mes-line-strong" />
        <p className="text-[20px] font-semibold text-mes-ink-2">Результат появится здесь</p>
        <p className="text-[15px] text-mes-ink-3">Найден ли код · относится ли к партии · агрегирован ли · что можно сделать</p>
      </section>
    )
  }
  const { ev, action } = result
  const t = TONE[ev.tone]
  const Icon = action === "removed" ? Trash2 : action === "added" ? PlusCircle : RESULT_ICON[ev.tone]
  const statusKey = action === "removed" ? "removed" : action === "added" ? "in_pallet" : ev.record?.status

  const facts: [string, React.ReactNode][] = [
    ["Код найден", ev.record || action === "added" ? <Yes /> : <No />],
    ["Текущая партия", ev.inCurrentBatch || action === "added" ? <Yes /> : ev.record ? <No text={`№ ${ev.batch?.number}`} /> : <No />],
    ["Агрегирован", ev.record?.status === "aggregated" ? <Yes text="в палете" /> : <No />],
    ["Статус", statusKey ? <StatusPill size="sm" tone={CODE_STATUS_LABEL[statusKey].tone}>{CODE_STATUS_LABEL[statusKey].label}</StatusPill> : <span className="text-mes-ink-3">—</span>],
    ["Палета", ev.record?.palletCode ? <span className="font-mono">{formatSscc(ev.record.palletCode)}</span> : <span className="text-mes-ink-3">—</span>],
    ["Время нанесения", ev.record ? fmtTime(ev.record.at) : <span className="text-mes-ink-3">—</span>],
  ]

  return (
    <section className={cn("mes-fade-up overflow-hidden rounded-2xl border-2 bg-mes-card", t.border)} key={ev.code + (action ?? "") + result.mode}>
      <div className={cn("flex items-center gap-5 p-6", t.soft)}>
        <span className={cn("mes-pop flex size-20 shrink-0 items-center justify-center rounded-3xl", t.solid)}>
          <Icon className="size-11" />
        </span>
        <div className="min-w-0">
          <p className={cn("text-[30px] font-bold leading-tight", t.text)}>{ev.title}</p>
          <p className="mt-1 text-[17px] text-mes-ink-2">{ev.message}</p>
        </div>
      </div>
      <div className="p-6">
        <p className="break-all rounded-xl bg-mes-panel px-4 py-3 font-mono text-[16px] text-mes-ink ring-1 ring-mes-line">{ev.code}</p>
        {ev.valid && (
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-3">
            {facts.map(([k, v]) => (
              <div key={k}>
                <dt className="text-[13px] font-semibold uppercase tracking-[0.04em] text-mes-ink-3">{k}</dt>
                <dd className="mt-1 text-[17px] font-semibold text-mes-ink">{v}</dd>
              </div>
            ))}
          </dl>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          {!action && ev.canAdd && (
            <Btn size="lg" variant="primary" icon={PlusCircle} onClick={() => onAdd(ev.code)}>
              Добавить код в партию
            </Btn>
          )}
          {!action && ev.canRemove && (
            <Btn size="lg" variant="danger" icon={Trash2} onClick={() => onRemove(ev.code)}>
              Удалить код
            </Btn>
          )}
          <Btn size="lg" icon={RotateCcw} onClick={onReset}>
            Новое сканирование
          </Btn>
        </div>
      </div>
    </section>
  )
}

function Yes({ text = "Да" }: { text?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-mes-olive-deep">
      <CheckCircle2 className="size-5" /> {text}
    </span>
  )
}
function No({ text = "Нет" }: { text?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-mes-ink-2">
      <XCircle className="size-5 text-mes-ink-3" /> {text}
    </span>
  )
}
