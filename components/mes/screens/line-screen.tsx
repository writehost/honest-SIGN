"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Flag,
  ListOrdered,
  MoreHorizontal,
  PackageCheck,
  Play,
  QrCode,
  ScanBarcode,
  ScanLine,
  Wine,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { batchTotal, fmtAgo, fmtNum, fmtTime, formatSscc, parseDataMatrix, shortCode, useMes, useNow } from "../store"
import { Btn, Drawer, TONE, TextInput, VolumeBadge } from "../ui"
import { useMesUi, useScanHandler } from "../ui-context"

/**
 * «Пост маркировки» — АРМ оператора маркировки и агрегации в визуальном языке SCADA System WMS.
 * Шапка страницы с партией → четыре показателя → панель текущей палеты → панели «Требует проверки» и «Действия».
 */
export function LineScreen() {
  const { active, scanSscc } = useMes()
  const { inspectCode } = useMesUi()
  const ssccInput = useRef<HTMLInputElement>(null)
  const [codesOpen, setCodesOpen] = useState(false)

  // Сканы вне поля ввода: DataMatrix уходит в проверку кода, остальное принимается как SSCC
  useScanHandler((raw) => {
    if (parseDataMatrix(raw)) inspectCode(raw)
    else if (active) scanSscc(raw)
  })

  return (
    <div className="flex flex-col gap-4 xl:h-full">
      <PostHeader />
      {active && <Stats />}
      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        {active ? <PalletPanel inputRef={ssccInput} onSubmit={scanSscc} onOpenCodes={() => setCodesOpen(true)} /> : <Idle />}
        <div className="flex min-h-0 flex-col gap-4">
          <ChecksPanel />
          <ActionsPanel onOpenCodes={() => setCodesOpen(true)} />
        </div>
      </div>
      <PalletCodesDrawer open={codesOpen} onClose={() => setCodesOpen(false)} />
    </div>
  )
}

/* ─── Шапка страницы: пост + активная партия ─── */

function PostHeader() {
  const { state, active } = useMes()
  const nom = active ? state.nomenclature.find((n) => n.id === active.nomenclatureId) : undefined
  return (
    <section className="flex min-h-[84px] shrink-0 flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-mes-line bg-mes-card px-5 py-3">
      <div className="leading-tight">
        <h1 className="text-[20px] font-bold text-mes-ink">Пост маркировки</h1>
        <p className="text-[14px] text-mes-ink-3">{state.settings.lineName}</p>
      </div>
      <span className="hidden h-11 w-px bg-mes-line md:block" />
      {active ? (
        <>
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <VolumeBadge volume={active.volume} size="lg" />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-[22px] font-bold text-mes-ink">{active.nomenclatureName}</p>
              <p className="text-[14px] text-mes-ink-3">
                {nom?.sku} · GTIN {active.gtin}
                <span className="2xl:hidden">
                  {" "}· партия № {active.number} · палета {active.palletSize}
                </span>
              </p>
            </div>
          </div>
          <Fact label="Партия" value={`№ ${active.number}`} />
          <Fact label="Палета" value={`${active.palletSize} бут.`} />
          <Fact label="Начата" value={fmtTime(active.startedAt).slice(0, 5)} />
        </>
      ) : (
        <p className="flex-1 text-[20px] font-semibold text-mes-ink-3">Партия не запущена</p>
      )}
    </section>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="hidden shrink-0 rounded-xl bg-mes-panel px-4 py-2 leading-tight ring-1 ring-mes-line 2xl:block">
      <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-mes-ink-3">{label}</p>
      <p className="mt-0.5 text-[20px] font-bold tabular-nums text-mes-ink">{value}</p>
    </div>
  )
}

/* ─── Показатели: нанесение → последний код → учёт → агрегация ─── */

function Stats() {
  const { state, active } = useMes()
  const now = useNow()
  if (!active) return null
  const total = batchTotal(active)
  const palletised = Object.values(state.pallets).filter((p) => p.batchId === active.id).reduce((a, p) => a + p.count, 0)
  const corrections = [active.manualAdded ? `+${active.manualAdded} вручную` : "", active.removed ? `−${active.removed} удалено` : ""].filter(Boolean).join(" · ")
  return (
    <div className="grid shrink-0 grid-cols-2 gap-4 2xl:grid-cols-4">
      <Stat icon={QrCode} label="Нанесено камерой" value={fmtNum(active.applied)} unit="кодов" sub="уникальные, подтверждённые камерой" />
      <Stat
        icon={Clock3}
        label="Последний код"
        value={active.lastCameraAt ? fmtTime(active.lastCameraAt) : "—"}
        sub={active.lastCameraAt ? fmtAgo(now - active.lastCameraAt) : "камера ещё не передавала коды"}
      />
      <Stat icon={Wine} label="Годных в партии" value={fmtNum(total)} unit="бут." sub={corrections || "без ручных корректировок"} subTone={corrections ? "text-mes-amber-strong" : undefined} />
      <Stat icon={PackageCheck} label="Палет закрыто" value={fmtNum(active.pallets)} unit="с SSCC" sub={`${fmtNum(palletised)} бут. в палетах`} />
    </div>
  )
}

function Stat({ icon: Icon, label, value, unit, sub, subTone }: { icon: LucideIcon; label: string; value: string; unit?: string; sub: string; subTone?: string }) {
  return (
    <div className="rounded-2xl border border-mes-line bg-mes-card px-5 py-4">
      <p className="flex items-center gap-2.5 text-[13px] font-bold uppercase tracking-[0.06em] text-mes-ink-2">
        <span className="flex size-9 items-center justify-center rounded-xl bg-mes-sand">
          <Icon className="size-[18px] text-mes-ink-2" />
        </span>
        {label}
      </p>
      <p className="mt-2 flex items-baseline gap-2 leading-none">
        <span className="text-[46px] font-bold tracking-tight tabular-nums text-mes-ink">{value}</span>
        {unit && <span className="text-[17px] text-mes-ink-2">{unit}</span>}
      </p>
      <p className={cn("mt-2 truncate text-[14px] text-mes-ink-3", subTone)}>{sub}</p>
    </div>
  )
}

/* ─── Текущая палета ─── */

function PalletPanel({ inputRef, onSubmit, onOpenCodes }: { inputRef: React.RefObject<HTMLInputElement | null>; onSubmit: (raw: string) => void; onOpenCodes: () => void }) {
  const { state, pallet } = useMes()
  const now = useNow(500)
  if (!pallet) return null
  if (pallet.awaiting) return <ScanPanel inputRef={inputRef} onSubmit={onSubmit} />

  const last = state.lastClosed
  // Скан SSCC вне ожидания (повтор этикетки, палета не собрана) — ответ в шапке панели; свежее сообщение важнее
  const recent = state.ssccFeedback && now - state.ssccFeedback.at < 6000 ? state.ssccFeedback : undefined
  const fb = recent && (!last || recent.at >= last.at) ? recent : undefined
  const justClosed = !fb && last && now - last.at < 3000
  const remaining = pallet.size - pallet.inPallet

  return (
    <section className="flex min-h-[520px] min-w-0 flex-col overflow-hidden rounded-2xl border border-mes-line bg-mes-card">
      {justClosed ? (
        <PanelHead className="bg-mes-olive-soft">
          <CheckCircle2 className="size-7 text-mes-olive-strong" />
          <span className="text-[22px] font-bold text-mes-olive-deep">Палета № {last.no} агрегирована</span>
          <span className="font-mono text-[16px] text-mes-ink-2">
            {formatSscc(last.code)} · {last.count} бут.
          </span>
        </PanelHead>
      ) : fb ? (
        <PanelHead className={TONE[fb.tone].soft}>
          <ScanBarcode className={cn("size-7", TONE[fb.tone].text)} />
          <span className={cn("text-[22px] font-bold", TONE[fb.tone].text)}>{fb.title}</span>
          <span className="truncate text-[16px] text-mes-ink-2">{fb.message}</span>
        </PanelHead>
      ) : (
        <PanelHead>
          <span className="text-[20px] font-bold text-mes-ink">Текущая палета № {pallet.no}</span>
          <button type="button" onClick={onOpenCodes} className="ml-auto flex h-11 items-center gap-1 rounded-full px-4 text-[15px] font-medium text-mes-ink-2 hover:bg-mes-panel">
            Коды палеты <ChevronRight className="size-4" />
          </button>
        </PanelHead>
      )}

      <div className="flex flex-1 flex-col justify-between px-8 pb-6 pt-4">
        <div className="flex flex-1 items-center justify-between gap-8">
          <p data-testid="pallet-count" className="font-bold leading-[0.9] tracking-tight tabular-nums text-mes-ink">
            <span className="text-[clamp(120px,13vw,240px)]">{pallet.inPallet}</span>
            <span className="text-[clamp(60px,6.5vw,116px)] text-mes-ink-3"> / {pallet.size}</span>
          </p>
          <div className="shrink-0 rounded-2xl bg-mes-panel px-7 py-5 text-right ring-1 ring-mes-line">
            <p className="text-[14px] font-bold uppercase tracking-[0.08em] text-mes-ink-3">До полной палеты</p>
            <p className="text-[92px] font-bold leading-none tabular-nums text-mes-olive-deep">{remaining}</p>
            {pallet.queuedNext > 0 && (
              <p className="mt-2 text-[16px] font-medium text-mes-ink-2">
                +{pallet.queuedNext} в очереди на № {pallet.no + 1}
              </p>
            )}
          </div>
        </div>
        <Scale value={pallet.inPallet} size={pallet.size} />
      </div>

      <footer className="border-t border-mes-line bg-mes-panel px-8 py-3 text-[15px] text-mes-ink-2">
        {last ? (
          <>
            Предыдущая палета № {last.no}
            {last.partial ? " (неполная)" : ""} · {last.count} бут. · SSCC <span className="font-mono">{formatSscc(last.code)}</span> · {fmtTime(last.at).slice(0, 5)}
          </>
        ) : (
          "В партии ещё нет закрытых палет"
        )}
      </footer>
    </section>
  )
}

function PanelHead({ children, className }: { children: ReactNode; className?: string }) {
  return <header className={cn("flex min-h-16 shrink-0 items-center gap-3 border-b border-mes-line px-6", className)}>{children}</header>
}

/** Шкала заполнения FIFO-группы */
function Scale({ value, size }: { value: number; size: number }) {
  const pct = Math.min(100, (value / size) * 100)
  const labels = [0, 1, 2, 3, 4].map((i) => (size / 4) * i)
  return (
    <div className="mt-6">
      <div className="relative h-7 overflow-hidden rounded-full bg-mes-sand">
        <div className="h-full rounded-full bg-mes-olive transition-[width] duration-300" style={{ width: `${pct}%` }} />
        {[1, 2, 3].map((i) => (
          <span key={i} className="absolute inset-y-1.5 w-0.5 rounded bg-white/80" style={{ left: `${i * 25}%` }} />
        ))}
      </div>
      <div className="relative mt-2 h-5 text-[14px] font-medium tabular-nums text-mes-ink-3">
        {labels.map((l) => (
          <span key={l} className="absolute -translate-x-1/2 first:translate-x-0 last:-translate-x-full" style={{ left: `${(l / size) * 100}%` }}>
            {l}
          </span>
        ))}
      </div>
    </div>
  )
}

/** Палета набрана — панель целиком переходит в приём SSCC */
function ScanPanel({ inputRef, onSubmit }: { inputRef: React.RefObject<HTMLInputElement | null>; onSubmit: (raw: string) => void }) {
  const { state, pallet, requestPartial } = useMes()
  const now = useNow(500)
  const [value, setValue] = useState("")

  // Сканер держит фокус, пока ждём SSCC (если не открыт диалог)
  useEffect(() => {
    inputRef.current?.focus()
    const id = window.setInterval(() => {
      const el = document.activeElement
      if ((!el || el === document.body) && !document.querySelector('[role="dialog"]')) inputRef.current?.focus()
    }, 500)
    return () => window.clearInterval(id)
  }, [inputRef])

  if (!pallet) return null
  const partial = state.partialRequested && !pallet.full
  const fb = state.ssccFeedback && now - state.ssccFeedback.at < 30_000 ? state.ssccFeedback : undefined
  const t = fb ? TONE[fb.tone] : null

  return (
    <section className="flex min-h-[520px] min-w-0 flex-col overflow-hidden rounded-2xl border-2 border-mes-amber/70 bg-mes-amber-soft">
      <PanelHead className="border-mes-amber/30">
        <span className="rounded-md bg-mes-amber px-2.5 py-1 text-[13px] font-bold uppercase tracking-[0.06em] text-white">{partial ? "Неполная палета" : "Палета собрана"}</span>
        <span className="text-[20px] font-bold text-mes-ink">
          Палета № {pallet.no} · {pallet.inPallet} из {pallet.size}
        </span>
        {pallet.queuedNext > 0 && (
          <span className="text-[16px] text-mes-ink-2">
            · ещё {pallet.queuedNext} бут. ждут палету № {pallet.no + 1}
          </span>
        )}
        {partial && (
          <button type="button" onClick={() => requestPartial(false)} className="ml-auto h-11 rounded-full bg-mes-card px-5 text-[15px] font-semibold text-mes-ink ring-1 ring-mes-line">
            Отменить неполную
          </button>
        )}
      </PanelHead>

      <div className="grid flex-1 items-center gap-10 px-8 py-6 lg:grid-cols-[auto_minmax(0,1fr)]">
        <p data-testid="pallet-count" className="font-bold leading-none tracking-tight tabular-nums text-mes-ink">
          <span className="text-[140px]">{pallet.inPallet}</span>
          <span className="text-[70px] text-mes-ink-3"> / {pallet.size}</span>
        </p>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex items-center gap-3">
            <ScanBarcode className="size-10 shrink-0 text-mes-amber-strong" />
            <div>
              <p className="text-[34px] font-bold leading-tight text-mes-ink">Отсканируйте палетный код</p>
              <p className="text-[16px] text-mes-ink-2">Наклейте SSCC-этикетку на палету и отсканируйте её ручным сканером</p>
            </div>
          </div>
          <form
            className="flex gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              if (!value.trim()) return
              onSubmit(value)
              setValue("")
              inputRef.current?.focus()
            }}
          >
            <TextInput ref={inputRef} value={value} onChange={(e) => setValue(e.target.value)} placeholder="Сканер готов — SSCC палеты" className="h-[76px] font-mono text-[24px]" autoComplete="off" inputMode="numeric" />
            <Btn type="submit" size="lg" variant="primary" disabled={!value.trim()} className="h-[76px] min-w-44">
              Принять
            </Btn>
          </form>
          <div className={cn("flex min-h-[132px] flex-col justify-center rounded-2xl border px-6 py-4", fb && t ? cn("bg-mes-card", t.border) : "border-dashed border-mes-amber/40 bg-mes-card/60")}>
            {fb && t ? (
              <>
                <p className={cn("text-[32px] font-bold leading-tight", t.text)}>{fb.title}</p>
                <p className="mt-1 text-[18px] text-mes-ink-2">{fb.message}</p>
                <p className="mt-1 font-mono text-[15px] text-mes-ink-3">{fb.code.length === 20 ? formatSscc(fb.code) : fb.code}</p>
              </>
            ) : (
              <p className="text-[19px] text-mes-ink-3">Здесь появится результат проверки SSCC</p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─── Нет партии ─── */

function Idle() {
  const { state } = useMes()
  const last = state.batches.find((b) => b.finishedAt)
  return (
    <section className="flex min-h-[520px] flex-col justify-center gap-3 rounded-2xl border border-mes-line bg-mes-card px-10">
      <p className="text-[30px] font-bold text-mes-ink">Нет активной партии</p>
      <p className="text-[18px] text-mes-ink-2">Коды, считанные камерой вне партии, не учитываются.</p>
      {last && (
        <div className="mt-6 rounded-2xl bg-mes-panel px-5 py-4 text-[16px] text-mes-ink-2 ring-1 ring-mes-line">
          <p className="text-[13px] font-bold uppercase tracking-[0.06em] text-mes-ink-3">Последняя партия</p>
          <p className="mt-1">
            № <b className="text-mes-ink">{last.number}</b> · {last.nomenclatureName} {last.volume} л · годных {fmtNum(batchTotal(last))} · палет {last.pallets}
            {last.unaggregated > 0 && <span className="text-mes-amber-strong"> · без агрегации {last.unaggregated}</span>}
          </p>
        </div>
      )}
    </section>
  )
}

/* ─── Требует проверки: события камеры по конкретным бутылям ─── */

function ChecksPanel() {
  const { state, dismissAlert } = useMes()
  const router = useRouter()
  if (state.alerts.length === 0) return null
  // По одному событию за раз: следующее появляется после «Принято», общее число — в заголовке
  const shown = state.alerts.slice(0, 1)
  return (
    <section className="shrink-0 rounded-2xl border border-mes-line bg-mes-card">
      <header className="flex h-14 items-center gap-2.5 border-b border-mes-line px-5">
        <span className="text-[18px] font-bold text-mes-ink">Требует проверки</span>
        <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-mes-sand px-2 text-[14px] font-semibold text-mes-ink-2">{state.alerts.length}</span>
        {state.alerts.length > 1 && <span className="ml-auto text-[14px] text-mes-ink-3">1 из {state.alerts.length}</span>}
      </header>
      <div className="flex flex-col gap-2 p-3">
        {shown.map((a) => (
          <div key={a.id} className="rounded-xl border border-mes-amber/40 bg-mes-amber-soft p-3.5">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-mes-card ring-1 ring-mes-amber/30">
                <AlertTriangle className="size-[18px] text-mes-amber-strong" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-[17px] font-semibold text-mes-ink">
                  {a.title}
                  <span className="ml-auto text-[13px] font-normal tabular-nums text-mes-ink-3">{fmtTime(a.at)}</span>
                </p>
                <p className="mt-0.5 text-[14px] leading-snug text-mes-ink-2">{a.detail}</p>
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={() => dismissAlert(a.id)} className="h-11 rounded-full px-4 text-[15px] font-medium text-mes-ink-2 hover:bg-mes-card">
                Принято
              </button>
              <button type="button" onClick={() => router.push("/mes/codes")} className="flex h-11 items-center gap-1 rounded-full bg-mes-card px-4 text-[15px] font-semibold text-mes-ink ring-1 ring-mes-line">
                Проверить бутыль <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ─── Действия оператора ─── */

function ActionsPanel({ onOpenCodes }: { onOpenCodes: () => void }) {
  const { active, pallet } = useMes()
  const { openLaunch, openFinish, openMore } = useMesUi()
  const router = useRouter()
  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-mes-line bg-mes-card">
      <header className="flex h-14 shrink-0 items-center border-b border-mes-line px-5">
        <span className="text-[18px] font-bold text-mes-ink">Действия</span>
      </header>
      <div className="flex flex-1 flex-col gap-1 p-3">
        {!active ? (
          <Btn size="xl" variant="primary" icon={Play} onClick={() => openLaunch()}>
            Начать партию
          </Btn>
        ) : (
          <>
            <ActionRow icon={ScanLine} title="Работа с кодами" sub="проверить · добавить · удалить" onClick={() => router.push("/mes/codes")} />
            <ActionRow icon={ListOrdered} title="Коды текущей палеты" sub={pallet ? `палета № ${pallet.no} · ${pallet.inPallet} из ${pallet.size}` : ""} onClick={onOpenCodes} />
            <ActionRow icon={MoreHorizontal} title="Другие операции" sub="неполная палета · детали партии" onClick={openMore} />
            <div className="mt-auto border-t border-dashed border-mes-line-strong pt-2">
              <ActionRow icon={Flag} title="Завершить партию" sub="с подтверждением" onClick={openFinish} danger />
            </div>
          </>
        )}
      </div>
    </section>
  )
}

function ActionRow({ icon: Icon, title, sub, onClick, danger }: { icon: LucideIcon; title: string; sub: string; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={cn("flex min-h-[76px] w-full items-center gap-4 rounded-xl px-3 text-left transition-colors", danger ? "hover:bg-mes-red-soft" : "hover:bg-mes-panel")}>
      <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-xl", danger ? "bg-mes-red-soft" : "bg-mes-sand")}>
        <Icon className={cn("size-6", danger ? "text-mes-red-strong" : "text-mes-ink-2")} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block text-[18px] font-semibold", danger ? "text-mes-red-strong" : "text-mes-ink")}>{title}</span>
        <span className="block truncate text-[14px] text-mes-ink-3">{sub}</span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-mes-ink-3" />
    </button>
  )
}

/* ─── Коды текущей палеты: реальные коды FIFO, открываются по запросу ─── */

function PalletCodesDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, pallet } = useMes()
  const { inspectCode } = useMesUi()
  if (!pallet) return null
  const group = state.fifo.slice(0, pallet.size)
  const next = state.fifo.slice(pallet.size)
  const Row = ({ code, pos }: { code: string; pos: number }) => {
    const r = state.codes[code]
    return (
      <button type="button" onClick={() => inspectCode(code)} className="grid min-h-14 w-full grid-cols-[48px_1fr_auto] items-center gap-3 px-2 text-left odd:bg-mes-panel hover:bg-mes-sand">
        <span className="text-right text-[17px] font-bold tabular-nums text-mes-ink-3">{pos}</span>
        <span className="truncate font-mono text-[16px] text-mes-ink">
          {shortCode(code)}
          {r?.source === "manual" && <span className="ml-2 rounded bg-mes-blue-soft px-1.5 py-0.5 font-sans text-[12px] font-semibold text-mes-blue">вручную</span>}
        </span>
        <span className="pr-2 text-[15px] tabular-nums text-mes-ink-3">{r ? fmtTime(r.at) : ""}</span>
      </button>
    )
  }
  return (
    <Drawer open={open} onClose={onClose} title={`Коды палеты № ${pallet.no}`} subtitle={`${pallet.inPallet} из ${pallet.size} · в порядке регистрации камерой. Касание — проверить код.`} width="max-w-[560px]">
      <div className="overflow-hidden rounded-xl ring-1 ring-mes-line">
        {[...group].reverse().map((c, i) => (
          <Row key={c} code={c} pos={group.length - i} />
        ))}
        {group.length === 0 && <p className="py-8 text-center text-[16px] text-mes-ink-3">Палета пуста</p>}
        {next.length > 0 && (
          <>
            <p className="bg-mes-sand px-3 py-2 text-[14px] font-semibold text-mes-ink-2">
              В очереди на палету № {pallet.no + 1} · {next.length}
            </p>
            {next.map((c, i) => (
              <Row key={c} code={c} pos={i + 1} />
            ))}
          </>
        )}
      </div>
    </Drawer>
  )
}
