"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Flag, MoreHorizontal, PackageCheck, Play, ScanBarcode, ScanLine, WifiOff } from "lucide-react"
import { cn } from "@/lib/utils"
import { EventRow } from "../event-row"
import {
  batchTotal,
  cameraSilenceMs,
  fmtAgo,
  fmtNum,
  fmtTime,
  formatSscc,
  isCameraOnline,
  parseDataMatrix,
  shortCode,
  useMes,
  useNow,
} from "../store"
import { Btn, TONE, TextInput } from "../ui"
import { useMesUi, useScanHandler } from "../ui-context"

export function LineScreen() {
  const { active, scanSscc } = useMes()
  const { inspectCode } = useMesUi()
  const ssccInput = useRef<HTMLInputElement>(null)

  // Результат приёма SSCC виден в карточке палеты — отдельное уведомление не нужно
  const submitSscc = (raw: string) => {
    scanSscc(raw)
  }

  // Сканы вне поля ввода: DataMatrix → проверка на экране «Коды», остальное — как SSCC
  useScanHandler((raw) => {
    if (parseDataMatrix(raw)) inspectCode(raw)
    else if (active) submitSscc(raw)
  })

  return (
    <div className="grid gap-5 xl:h-full xl:grid-cols-[minmax(0,1fr)_380px_300px]">
      <div className="flex min-h-0 min-w-0 flex-col gap-5">
        <CameraStatus />
        {active ? (
          <>
            <PalletCard inputRef={ssccInput} onSubmit={submitSscc} />
            <Counters />
            <BatchEvents />
          </>
        ) : (
          <IdleCard />
        )}
      </div>
      <PalletCodes />
      <ActionPanel onConfirmPallet={() => ssccInput.current?.focus()} />
    </div>
  )
}

/* ─── Камера: сообщаем только о проблемах ─── */

function CameraStatus() {
  const { state, active, dismissAlert } = useMes()
  const router = useRouter()
  const now = useNow()
  const online = isCameraOnline(state, now)
  if (online && state.alerts.length === 0) return null
  const shown = state.alerts.slice(0, 2)
  return (
    <div className="flex flex-col gap-2">
      {!online && (
        <div className={cn("flex items-center gap-4 rounded-2xl px-5 py-4", TONE.critical.solid)}>
          <WifiOff className="size-8 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[20px] font-bold">Нет связи с камерой — {Math.floor(cameraSilenceMs(state, now) / 1000)} с</p>
            <p className="text-[15px] opacity-95">
              {active ? "Коды не регистрируются. " : ""}Проверьте питание и сетевое подключение камеры ({state.settings.cameraAddress}).
            </p>
          </div>
        </div>
      )}
      {shown.map((a) => (
        <div key={a.id} className="flex items-center gap-4 rounded-2xl border-2 border-mes-amber/60 bg-mes-amber-soft px-5 py-3">
          <AlertTriangle className="size-7 shrink-0 text-mes-amber-strong" />
          <div className="min-w-0 flex-1">
            <p className="text-[18px] font-bold text-mes-ink">
              {a.title} <span className="ml-2 text-[15px] font-medium tabular-nums text-mes-ink-3">{fmtTime(a.at)}</span>
            </p>
            <p className="text-[15px] text-mes-ink-2">{a.detail}</p>
          </div>
          <Btn icon={ScanLine} onClick={() => router.push("/mes/codes")}>
            Проверить бутыль
          </Btn>
          <Btn onClick={() => dismissAlert(a.id)}>Принято</Btn>
        </div>
      ))}
      {state.alerts.length > shown.length && <p className="px-2 text-[14px] font-semibold text-mes-amber-strong">Ещё {state.alerts.length - shown.length} событий камеры требуют проверки</p>}
    </div>
  )
}

/* ─── Текущая палета: главный показатель + приём SSCC ─── */

function PalletCard({ inputRef, onSubmit }: { inputRef: React.RefObject<HTMLInputElement | null>; onSubmit: (raw: string) => void }) {
  const { state, active, pallet, requestPartial } = useMes()
  const now = useNow()
  const [value, setValue] = useState("")
  const awaiting = !!pallet?.awaiting

  // Пока ждём SSCC, поле сканера держит фокус (если оператор не работает с другим полем или окном)
  useEffect(() => {
    if (!awaiting) return
    inputRef.current?.focus()
    const id = window.setInterval(() => {
      const el = document.activeElement
      if ((!el || el === document.body) && !document.querySelector('[role="dialog"]')) inputRef.current?.focus()
    }, 500)
    return () => window.clearInterval(id)
  }, [awaiting, inputRef])

  if (!active || !pallet) return null
  const pct = (pallet.inPallet / pallet.size) * 100
  const fb = state.ssccFeedback && now - state.ssccFeedback.at < 20_000 ? state.ssccFeedback : undefined
  const partial = state.partialRequested && !pallet.full
  const last = state.lastClosed

  return (
    <section className={cn("overflow-hidden rounded-2xl border-2 bg-mes-card", awaiting ? "border-mes-amber" : "border-mes-line")}>
      {awaiting && (
        <div className="flex items-center gap-3 bg-mes-amber px-6 py-3 text-white">
          <ScanBarcode className="size-8 shrink-0" />
          <p className="flex-1 text-[24px] font-bold">
            {partial ? `Палета № ${pallet.no} закрывается неполной (${pallet.inPallet} из ${pallet.size}). Отсканируйте палетный код` : `Палета № ${pallet.no} собрана. Отсканируйте палетный код`}
          </p>
          {partial && (
            <button type="button" onClick={() => requestPartial(false)} className="h-12 rounded-xl bg-white/95 px-4 text-[15px] font-bold text-mes-ink">
              Отменить
            </button>
          )}
        </div>
      )}

      <div className="px-6 pb-5 pt-4">
        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="text-[15px] font-semibold uppercase tracking-[0.05em] text-mes-ink-2">Бутылей в текущей палете · № {pallet.no}</p>
            <p className="font-bold leading-none tabular-nums text-mes-ink">
              <span className="text-[112px] tracking-tight">{pallet.inPallet}</span>
              <span className="text-[56px] text-mes-ink-3"> из {pallet.size}</span>
            </p>
          </div>
          <div className="pb-3 text-right">
            {pallet.full ? (
              <p className="text-[26px] font-bold text-mes-amber-strong">Палета собрана</p>
            ) : (
              <p className="text-[26px] font-bold text-mes-ink">
                осталось <span className="tabular-nums">{pallet.size - pallet.inPallet}</span>
              </p>
            )}
            {pallet.queuedNext > 0 && <p className="mt-1 text-[17px] font-semibold text-mes-ink-2">+{pallet.queuedNext} в очереди на палету № {pallet.no + 1}</p>}
          </div>
        </div>
        <div className="mt-4 h-7 overflow-hidden rounded-lg bg-mes-line">
          <div className={cn("h-full rounded-lg transition-[width] duration-300", awaiting ? "bg-mes-amber" : "bg-mes-olive-strong")} style={{ width: `${pct}%` }} />
        </div>

        {awaiting ? (
          <form
            className="mt-5 flex gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              if (!value.trim()) return
              onSubmit(value)
              setValue("")
              inputRef.current?.focus()
            }}
          >
            <TextInput ref={inputRef} value={value} onChange={(e) => setValue(e.target.value)} placeholder="Сканер готов — отсканируйте SSCC-этикетку палеты" className="h-[68px] font-mono text-[22px]" autoComplete="off" inputMode="numeric" />
            <Btn type="submit" size="lg" variant="primary" disabled={!value.trim()} className="min-w-48">
              Подтвердить
            </Btn>
          </form>
        ) : null}

        {fb ? (
          <div className={cn("mt-4 flex items-start gap-3 rounded-xl border px-4 py-3", TONE[fb.tone].soft, TONE[fb.tone].border)}>
            <p className={cn("text-[18px] font-bold", TONE[fb.tone].text)}>{fb.title}</p>
            <p className="flex-1 pt-0.5 text-[16px] text-mes-ink-2">
              {fb.message} <span className="font-mono text-[14px] text-mes-ink-3">{fb.code.length === 20 ? formatSscc(fb.code) : fb.code}</span>
            </p>
          </div>
        ) : (
          !awaiting && (
            <p className="mt-4 flex items-center gap-2 text-[16px] text-mes-ink-2">
              <PackageCheck className="size-5 text-mes-olive-strong" />
              {last ? (
                <>
                  Предыдущая: палета № {last.no}{last.partial ? " (неполная)" : ""} · {last.count} бут. · <span className="font-mono text-[15px]">{formatSscc(last.code)}</span> · {fmtTime(last.at)}
                </>
              ) : (
                "Закрытых палет в партии пока нет"
              )}
            </p>
          )
        )}
      </div>
    </section>
  )
}

/* ─── Основные счётчики ─── */

function Counters() {
  const { active } = useMes()
  const now = useNow()
  if (!active) return null
  const total = batchTotal(active)
  const corrections = [active.manualAdded ? `+${active.manualAdded} вручную` : "", active.removed ? `−${active.removed} удалено` : ""].filter(Boolean).join(" · ")
  return (
    <div className="grid grid-cols-2 gap-4 2xl:grid-cols-4">
      <Counter label="Нанесено кодов" value={fmtNum(active.applied)} sub="подтверждено камерой" />
      <Counter label="Всего бутылей в партии" value={fmtNum(total)} sub={corrections || "без корректировок"} subTone={corrections ? "text-mes-amber-strong" : undefined} />
      <Counter label="Палет агрегировано" value={fmtNum(active.pallets)} sub="закрыто с SSCC" />
      <Counter small label="Последнее нанесение" value={active.lastCameraAt ? fmtTime(active.lastCameraAt) : "—"} sub={active.lastCameraAt ? fmtAgo(now - active.lastCameraAt) : "камера ещё не передавала коды"} />
    </div>
  )
}

function Counter({ label, value, sub, subTone, small }: { label: string; value: string; sub: string; subTone?: string; small?: boolean }) {
  return (
    <div className="flex flex-col rounded-2xl border border-mes-line bg-mes-card px-5 py-4">
      <p className="text-[13px] font-semibold uppercase leading-tight tracking-[0.05em] text-mes-ink-2">{label}</p>
      <p className={cn("mt-auto pt-2 font-bold leading-none tracking-tight tabular-nums text-mes-ink", small ? "text-[42px]" : "text-[52px]")}>{value}</p>
      <p className={cn("mt-2 text-[15px] text-mes-ink-3", subTone)}>{sub}</p>
    </div>
  )
}

/* ─── События партии: то, что произошло, без декоративных статусов ─── */

function BatchEvents() {
  const { state, active } = useMes()
  const router = useRouter()
  if (!active) return null
  const list = state.events.filter((e) => e.batchNumber === active.number).slice(0, 30)
  return (
    <section className="hidden min-h-[220px] flex-1 flex-col overflow-hidden rounded-2xl border border-mes-line bg-mes-card xl:flex">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-mes-line px-5">
        <h2 className="text-[14px] font-semibold uppercase tracking-[0.05em] text-mes-ink-2">События партии</h2>
        <button type="button" onClick={() => router.push("/mes/events")} className="h-10 rounded-lg px-3 text-[14px] font-semibold text-mes-olive-deep hover:bg-mes-olive-soft">
          Журнал
        </button>
      </header>
      <div className="min-h-0 flex-1 divide-y divide-mes-line overflow-y-auto px-5">
        {list.map((e) => (
          <EventRow key={e.id} e={e} compact />
        ))}
      </div>
    </section>
  )
}

/* ─── Коды текущей палеты: реальные коды в порядке FIFO ─── */

function PalletCodes() {
  const { state, active, pallet } = useMes()
  const { inspectCode } = useMesUi()
  if (!active || !pallet) {
    return (
      <section className="order-3 flex flex-col items-center justify-center rounded-2xl border border-mes-line bg-mes-card p-8 text-center text-[16px] text-mes-ink-3 xl:order-none">
        Коды текущей палеты появятся после начала партии
      </section>
    )
  }
  const group = state.fifo.slice(0, pallet.size)
  const next = state.fifo.slice(pallet.size)
  const Row = ({ code, pos }: { code: string; pos: number }) => {
    const r = state.codes[code]
    return (
      <button type="button" onClick={() => inspectCode(code)} className="grid h-12 w-full grid-cols-[44px_1fr_auto] items-center gap-3 px-4 text-left hover:bg-mes-panel">
        <span className="text-right text-[16px] font-bold tabular-nums text-mes-ink-3">{pos}</span>
        <span className="truncate font-mono text-[15px] text-mes-ink">
          {shortCode(code)}
          {r?.source === "manual" && <span className="ml-2 rounded bg-mes-blue-soft px-1.5 py-0.5 font-sans text-[12px] font-semibold text-mes-blue">вручную</span>}
        </span>
        <span className="text-[14px] tabular-nums text-mes-ink-3">{r ? fmtTime(r.at) : ""}</span>
      </button>
    )
  }
  return (
    <section className="order-3 flex min-h-[420px] flex-col overflow-hidden rounded-2xl border border-mes-line bg-mes-card xl:order-none xl:min-h-0">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-mes-line px-4">
        <h2 className="text-[14px] font-semibold uppercase tracking-[0.05em] text-mes-ink-2">Коды палеты № {pallet.no}</h2>
        <span className="text-[15px] font-bold tabular-nums text-mes-ink">
          {pallet.inPallet} / {pallet.size}
        </span>
      </header>
      <div className="grid grid-cols-[44px_1fr_auto] gap-3 border-b border-mes-line bg-mes-panel px-4 py-1.5 text-[12px] font-semibold uppercase text-mes-ink-3">
        <span className="text-right">№</span>
        <span>Серийный номер</span>
        <span>Считан</span>
      </div>
      <div className="min-h-0 flex-1 divide-y divide-mes-line overflow-y-auto">
        {next.length > 0 && (
          <>
            <p className="bg-mes-panel px-4 py-1.5 text-[13px] font-semibold text-mes-ink-2">В очереди на палету № {pallet.no + 1} · {next.length}</p>
            {[...next].reverse().map((c, i) => (
              <Row key={c} code={c} pos={next.length - i} />
            ))}
            <p className="bg-mes-panel px-4 py-1.5 text-[13px] font-semibold text-mes-ink-2">Палета № {pallet.no}</p>
          </>
        )}
        {[...group].reverse().map((c, i) => (
          <Row key={c} code={c} pos={group.length - i} />
        ))}
        {group.length === 0 && <p className="p-6 text-center text-[15px] text-mes-ink-3">Палета пуста — ожидаются считывания камеры</p>}
      </div>
    </section>
  )
}

/* ─── Нет партии ─── */

function IdleCard() {
  const { state } = useMes()
  const { openLaunch } = useMesUi()
  const last = state.batches.find((b) => b.finishedAt)
  return (
    <section className="flex flex-1 flex-col justify-center gap-6 rounded-2xl border border-mes-line bg-mes-card p-10">
      <div>
        <p className="text-[15px] font-semibold uppercase tracking-[0.05em] text-mes-ink-3">Партия не запущена</p>
        <p className="mt-2 text-[20px] text-mes-ink-2">Коды, считанные камерой вне партии, не учитываются.</p>
      </div>
      <Btn size="xl" variant="primary" icon={Play} onClick={() => openLaunch()} className="self-start px-10">
        Начать партию
      </Btn>
      {last && (
        <div className="border-t border-mes-line pt-5 text-[17px] text-mes-ink-2">
          Последняя партия № <b className="text-mes-ink">{last.number}</b> · {last.nomenclatureName} {last.volume} л · всего {fmtNum(batchTotal(last))} бут. · палет {last.pallets}
          {last.unaggregated > 0 && <span className="text-mes-amber-strong"> · без агрегации {last.unaggregated}</span>}
        </div>
      )}
    </section>
  )
}

/* ─── Боковая панель действий ─── */

function ActionPanel({ onConfirmPallet }: { onConfirmPallet: () => void }) {
  const { active, pallet } = useMes()
  const { openLaunch, openFinish, openMore } = useMesUi()
  const router = useRouter()
  const awaiting = !!pallet?.awaiting
  return (
    <aside className="order-2 grid grid-cols-2 gap-3 xl:order-none xl:flex xl:flex-col">
      {!active ? (
        <Btn size="xl" variant="primary" icon={Play} onClick={() => openLaunch()}>
          Начать партию
        </Btn>
      ) : (
        <Btn size="xl" variant={awaiting ? "warning" : "secondary"} icon={ScanBarcode} onClick={onConfirmPallet} disabled={!awaiting} sub={awaiting ? "отсканируйте SSCC" : `при ${pallet?.size} из ${pallet?.size}`}>
          Подтвердить палету
        </Btn>
      )}
      <Btn size="lg" icon={ScanLine} onClick={() => router.push("/mes/codes")} sub="проверить · добавить · удалить">
        Работа с кодами
      </Btn>
      {active && (
        <Btn size="lg" icon={MoreHorizontal} onClick={openMore} sub="неполная палета, детали партии">
          Другие операции
        </Btn>
      )}
      {active && (
        <div className="xl:mt-auto xl:border-t-2 xl:border-dashed xl:border-mes-line-strong xl:pt-4">
          <Btn size="lg" variant="danger" icon={Flag} onClick={openFinish} block>
            Завершить партию
          </Btn>
        </div>
      )}
    </aside>
  )
}
