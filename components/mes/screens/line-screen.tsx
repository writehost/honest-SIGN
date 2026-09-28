"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, CheckCircle2, Flag, ListOrdered, MoreHorizontal, Play, ScanBarcode, ScanLine } from "lucide-react"
import { cn } from "@/lib/utils"
import { batchTotal, fmtAgo, fmtNum, fmtTime, formatSscc, parseDataMatrix, shortCode, useMes, useNow } from "../store"
import { Btn, Drawer, TONE, TextInput, VolumeBadge } from "../ui"
import { useMesUi, useScanHandler } from "../ui-context"

/**
 * «Пост маркировки» — рабочее место оператора маркировки и агрегации.
 * Шапка партии → сгруппированные счётчики → текущая палета (центр) → контекстные действия справа.
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
      <BatchBar />
      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_440px]">
        <div className="flex min-h-0 min-w-0 flex-col gap-4">
          {active ? (
            <>
              <Counters />
              <PalletBlock inputRef={ssccInput} onSubmit={scanSscc} />
            </>
          ) : (
            <Idle />
          )}
        </div>
        <ActionArea onOpenCodes={() => setCodesOpen(true)} />
      </div>
      <PalletCodesDrawer open={codesOpen} onClose={() => setCodesOpen(false)} />
    </div>
  )
}

/* ─── 1. Информационная шапка партии ─── */

function BatchBar() {
  const { state, active } = useMes()
  if (!active) {
    return (
      <section className="flex h-[84px] shrink-0 items-center gap-5 rounded-2xl border border-mes-line bg-mes-card px-6">
        <p className="text-[24px] font-bold text-mes-ink-3">Партия не запущена</p>
        <p className="text-[16px] text-mes-ink-3">{state.settings.lineName}</p>
      </section>
    )
  }
  const nom = state.nomenclature.find((n) => n.id === active.nomenclatureId)
  return (
    <section className="flex h-[84px] shrink-0 items-center gap-6 rounded-2xl border border-mes-line bg-mes-card px-5">
      <VolumeBadge volume={active.volume} size="lg" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[26px] font-bold leading-tight text-mes-ink">{active.nomenclatureName}</p>
        <p className="text-[15px] text-mes-ink-3">
          {nom?.sku} · GTIN {active.gtin}
        </p>
      </div>
      <Info label="Партия" value={`№ ${active.number}`} strong />
      <Info label="Палета" value={`${active.palletSize} бут.`} />
      <Info label="Начата" value={fmtTime(active.startedAt).slice(0, 5)} />
      <Info label="Линия" value={state.settings.lineName.replace("Линия розлива ", "")} />
    </section>
  )
}

function Info({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="hidden shrink-0 border-l border-mes-line pl-6 leading-tight lg:block">
      <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-mes-ink-3">{label}</p>
      <p className={cn("mt-1 font-bold tabular-nums text-mes-ink", strong ? "text-[26px]" : "text-[22px]")}>{value}</p>
    </div>
  )
}

/* ─── 2. Производственные счётчики: нанесение · учёт · агрегация ─── */

function Counters() {
  const { state, active } = useMes()
  const now = useNow()
  if (!active) return null
  const total = batchTotal(active)
  const palletised = Object.values(state.pallets).filter((p) => p.batchId === active.id).reduce((a, p) => a + p.count, 0)
  const corrections = [active.manualAdded ? `+${active.manualAdded} вручную` : "", active.removed ? `−${active.removed} удалено` : ""].filter(Boolean).join(" · ")
  return (
    <section className="grid shrink-0 grid-cols-1 overflow-hidden rounded-2xl border border-mes-line bg-mes-card lg:grid-cols-[1.9fr_1fr_1fr]">
      <Group title="Нанесение · камера">
        <div className="grid grid-cols-2">
          <Metric label="Кодов зарегистрировано" value={fmtNum(active.applied)} />
          <Metric
            label="Последний код"
            value={active.lastCameraAt ? fmtTime(active.lastCameraAt) : "—"}
            sub={active.lastCameraAt ? fmtAgo(now - active.lastCameraAt) : "кодов ещё не было"}
            small
            divider
          />
        </div>
      </Group>
      <Group title="Учёт партии">
        <Metric label="Годных бутылей" value={fmtNum(total)} sub={corrections || "без корректировок"} subTone={corrections ? "text-mes-amber-strong" : undefined} />
      </Group>
      <Group title="Агрегация">
        <Metric label="Палет закрыто" value={fmtNum(active.pallets)} sub={`${fmtNum(palletised)} бут. в палетах`} />
      </Group>
    </section>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-mes-line max-lg:border-b lg:border-l lg:first:border-l-0">
      <p className="border-b border-mes-line bg-mes-panel px-5 py-1.5 text-[12px] font-bold uppercase tracking-[0.08em] text-mes-ink-3">{title}</p>
      {children}
    </div>
  )
}

function Metric({ label, value, sub, subTone, small, divider }: { label: string; value: string; sub?: string; subTone?: string; small?: boolean; divider?: boolean }) {
  return (
    <div className={cn("px-5 pb-3 pt-2.5", divider && "border-l border-mes-line")}>
      <p className="text-[15px] font-semibold text-mes-ink-2">{label}</p>
      <p className={cn("font-bold leading-[1.05] tracking-tight tabular-nums text-mes-ink", small ? "pt-1.5 text-[46px]" : "text-[58px]")}>{value}</p>
      <p className={cn("mt-0.5 h-5 text-[14px] text-mes-ink-3", subTone)}>{sub}</p>
    </div>
  )
}

/* ─── 3. Текущая палета: центральный элемент ─── */

function PalletBlock({ inputRef, onSubmit }: { inputRef: React.RefObject<HTMLInputElement | null>; onSubmit: (raw: string) => void }) {
  const { state, pallet } = useMes()
  const now = useNow(500)
  if (!pallet) return null
  const last = state.lastClosed
  // Скан SSCC вне режима ожидания (повтор этикетки, палета не собрана) — ответ показываем здесь же.
  // Из двух сообщений показываем более свежее.
  const recent = state.ssccFeedback && now - state.ssccFeedback.at < 6000 ? state.ssccFeedback : undefined
  const fb = recent && (!last || recent.at >= last.at) ? recent : undefined
  const justClosed = !fb && last && now - last.at < 3000

  if (pallet.awaiting) return <ScanMode inputRef={inputRef} onSubmit={onSubmit} />

  return (
    <section className="flex min-h-[520px] flex-1 flex-col overflow-hidden rounded-2xl border border-mes-line bg-mes-card">
      {justClosed && (
        <div className="flex items-center gap-4 bg-mes-olive-strong px-7 py-3 text-white">
          <CheckCircle2 className="size-9 shrink-0" />
          <p className="text-[28px] font-bold">Палета № {last.no} агрегирована</p>
          <p className="font-mono text-[18px] opacity-90">{formatSscc(last.code)} · {last.count} бут.</p>
        </div>
      )}
      {fb && (
        <div className={cn("flex items-center gap-4 border-b-2 px-7 py-3", TONE[fb.tone].soft, TONE[fb.tone].border)}>
          <ScanBarcode className={cn("size-8 shrink-0", TONE[fb.tone].text)} />
          <p className={cn("text-[26px] font-bold", TONE[fb.tone].text)}>{fb.title}</p>
          <p className="text-[18px] text-mes-ink-2">{fb.message}</p>
        </div>
      )}
      <div className="flex flex-1 flex-col justify-between px-8 pb-6 pt-5">
        <p className="text-[20px] font-bold uppercase tracking-[0.06em] text-mes-ink-2">Текущая палета № {pallet.no}</p>

        <div className="flex items-end justify-between gap-8">
          <p data-testid="pallet-count" className="font-bold leading-[0.9] tracking-tight tabular-nums text-mes-ink">
            <span className="text-[clamp(120px,15vw,250px)]">{pallet.inPallet}</span>
            <span className="text-[clamp(64px,7.5vw,124px)] text-mes-ink-3"> / {pallet.size}</span>
          </p>
          <div className="shrink-0 pb-3 text-right">
            <p className="text-[18px] font-bold uppercase tracking-[0.06em] text-mes-ink-3">До полной палеты</p>
            <p className="text-[96px] font-bold leading-none tabular-nums text-mes-olive-deep">{pallet.size - pallet.inPallet}</p>
            {pallet.queuedNext > 0 && <p className="mt-2 text-[18px] font-semibold text-mes-ink-2">+{pallet.queuedNext} в очереди на палету № {pallet.no + 1}</p>}
          </div>
        </div>

        <div>
          <Scale value={pallet.inPallet} size={pallet.size} />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 text-[17px] text-mes-ink-2">
            <span>
              {last ? (
                <>
                  Предыдущая: палета № {last.no}
                  {last.partial ? " (неполная)" : ""} · {last.count} бут. · <span className="font-mono text-[16px]">{formatSscc(last.code)}</span> · {fmtTime(last.at).slice(0, 5)}
                </>
              ) : (
                "Закрытых палет в партии пока нет"
              )}
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}

/** Шкала заполнения FIFO-группы: деления каждые N/8, подписи каждые N/4 */
function Scale({ value, size, tone = "olive" }: { value: number; size: number; tone?: "olive" | "amber" }) {
  const pct = Math.min(100, (value / size) * 100)
  const minor = size / 8
  const labels = [0, 1, 2, 3, 4].map((i) => (size / 4) * i)
  return (
    <div>
      <div className="relative h-11 overflow-hidden rounded-xl bg-mes-line">
        <div className={cn("h-full transition-[width] duration-300", tone === "amber" ? "bg-mes-amber" : "bg-mes-olive-strong")} style={{ width: `${pct}%` }} />
        {Array.from({ length: 7 }, (_, i) => (
          <span key={i} className="absolute inset-y-0 w-0.5 bg-white/70" style={{ left: `${((i + 1) * minor * 100) / size}%` }} />
        ))}
      </div>
      <div className="relative mt-1.5 h-5 text-[14px] font-semibold tabular-nums text-mes-ink-3">
        {labels.map((l) => (
          <span key={l} className="absolute -translate-x-1/2 first:translate-x-0 last:-translate-x-full" style={{ left: `${(l / size) * 100}%` }}>
            {l}
          </span>
        ))}
      </div>
    </div>
  )
}

/** Режим «Отсканируйте палетный код» — занимает весь центральный блок */
function ScanMode({ inputRef, onSubmit }: { inputRef: React.RefObject<HTMLInputElement | null>; onSubmit: (raw: string) => void }) {
  const { state, pallet, requestPartial } = useMes()
  const now = useNow(500)
  const [value, setValue] = useState("")

  // Сканер держит фокус, пока открыт режим сканирования
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
    <section className="flex min-h-[520px] flex-1 flex-col overflow-hidden rounded-2xl border-[3px] border-mes-amber bg-mes-card">
      <div className="flex items-center gap-5 bg-mes-amber px-7 py-4 text-white">
        <ScanBarcode className="size-12 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[38px] font-bold leading-tight">Отсканируйте палетный код</p>
          <p className="text-[18px] font-medium opacity-95">
            {partial ? `Неполная палета № ${pallet.no}: ${pallet.inPallet} из ${pallet.size} бутылей` : `Палета № ${pallet.no} собрана`}
            {pallet.queuedNext > 0 && ` · ещё ${pallet.queuedNext} бут. ждут палету № ${pallet.no + 1}`}
          </p>
        </div>
        {partial && (
          <button type="button" onClick={() => requestPartial(false)} className="h-14 shrink-0 rounded-xl bg-white px-5 text-[17px] font-bold text-mes-ink">
            Отменить неполную
          </button>
        )}
      </div>

      <div className="grid flex-1 gap-8 px-8 py-6 lg:grid-cols-[auto_minmax(0,1fr)]">
        <div className="flex flex-col justify-center">
          <p className="text-[18px] font-bold uppercase tracking-[0.06em] text-mes-ink-2">Палета № {pallet.no}</p>
          <p data-testid="pallet-count" className="font-bold leading-none tracking-tight tabular-nums text-mes-ink">
            <span className="text-[150px]">{pallet.inPallet}</span>
            <span className="text-[76px] text-mes-ink-3"> / {pallet.size}</span>
          </p>
        </div>

        <div className="flex min-w-0 flex-col justify-center gap-5">
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
            <TextInput ref={inputRef} value={value} onChange={(e) => setValue(e.target.value)} placeholder="Сканер готов — SSCC-этикетка палеты" className="h-20 font-mono text-[24px]" autoComplete="off" inputMode="numeric" />
            <Btn type="submit" size="lg" variant="primary" disabled={!value.trim()} className="h-20 min-w-44">
              Принять
            </Btn>
          </form>

          <div className={cn("flex min-h-[150px] flex-col justify-center rounded-2xl border-2 px-6 py-4", fb && t ? cn(t.soft, t.border) : "border-dashed border-mes-line-strong")}>
            {fb && t ? (
              <>
                <p className={cn("text-[36px] font-bold leading-tight", t.text)}>{fb.title}</p>
                <p className="mt-1 text-[19px] text-mes-ink-2">{fb.message}</p>
                <p className="mt-1 font-mono text-[16px] text-mes-ink-3">{fb.code.length === 20 ? formatSscc(fb.code) : fb.code}</p>
              </>
            ) : (
              <p className="text-[22px] text-mes-ink-3">Результат проверки SSCC появится здесь</p>
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
    <section className="flex flex-1 flex-col justify-center gap-4 rounded-2xl border border-dashed border-mes-line-strong bg-mes-card px-10 py-16">
      <p className="text-[34px] font-bold text-mes-ink">Нет активной партии</p>
      <p className="text-[19px] text-mes-ink-2">Коды, считанные камерой вне партии, не учитываются. Начните партию справа.</p>
      {last && (
        <p className="mt-4 border-t border-mes-line pt-5 text-[17px] text-mes-ink-2">
          Последняя: № <b className="text-mes-ink">{last.number}</b> · {last.nomenclatureName} {last.volume} л · годных {fmtNum(batchTotal(last))} · палет {last.pallets}
          {last.unaggregated > 0 && <span className="text-mes-amber-strong"> · без агрегации {last.unaggregated}</span>}
        </p>
      )}
    </section>
  )
}

/* ─── 4. Контекстная область действий ─── */

function ActionArea({ onOpenCodes }: { onOpenCodes: () => void }) {
  const { state, active, pallet, dismissAlert } = useMes()
  const { openLaunch, openFinish, openMore } = useMesUi()
  const router = useRouter()
  const alerts = state.alerts.slice(0, 2)

  return (
    <aside className="flex min-h-0 flex-col gap-3">
      {alerts.length > 0 && (
        <section className="flex flex-col gap-2">
          <p className="px-1 text-[13px] font-bold uppercase tracking-[0.08em] text-mes-amber-strong">Требует проверки · {state.alerts.length}</p>
          {alerts.map((a) => (
            <div key={a.id} className="rounded-2xl border-2 border-mes-amber/60 bg-mes-amber-soft p-4">
              <p className="flex items-start gap-2 text-[18px] font-bold text-mes-ink">
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-mes-amber-strong" />
                <span className="flex-1">{a.title}</span>
                <span className="text-[14px] font-medium tabular-nums text-mes-ink-3">{fmtTime(a.at)}</span>
              </p>
              <p className="mt-1 text-[15px] text-mes-ink-2">{a.detail}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Btn icon={ScanLine} onClick={() => router.push("/mes/codes")}>
                  Проверить
                </Btn>
                <Btn onClick={() => dismissAlert(a.id)}>Принято</Btn>
              </div>
            </div>
          ))}
        </section>
      )}

      {!active ? (
        <Btn size="xl" variant="primary" icon={Play} onClick={() => openLaunch()}>
          Начать партию
        </Btn>
      ) : (
        <>
          {pallet?.awaiting && (
            <p className="rounded-2xl bg-mes-amber-soft px-4 py-3 text-[16px] font-semibold text-mes-amber-strong ring-1 ring-mes-amber/40">
              Наклейте этикетку на палету и отсканируйте её ручным сканером.
            </p>
          )}
          <Btn size="lg" icon={ScanLine} onClick={() => router.push("/mes/codes")} sub="проверить · добавить · удалить">
            Ручные операции с кодами
          </Btn>
          <Btn size="lg" icon={ListOrdered} onClick={onOpenCodes} sub={pallet ? `палета № ${pallet.no} · ${pallet.inPallet} кодов` : undefined}>
            Коды текущей палеты
          </Btn>
          <Btn size="lg" icon={MoreHorizontal} onClick={openMore} sub="неполная палета · детали партии">
            Другие операции
          </Btn>
        </>
      )}

      {active && (
        <div className="mt-auto border-t-2 border-dashed border-mes-line-strong pt-4">
          <Btn size="lg" variant="danger" icon={Flag} onClick={openFinish} block>
            Завершить партию
          </Btn>
        </div>
      )}
    </aside>
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
      <button type="button" onClick={() => inspectCode(code)} className="grid min-h-14 w-full grid-cols-[48px_1fr_auto] items-center gap-3 px-2 text-left hover:bg-mes-panel">
        <span className="text-right text-[17px] font-bold tabular-nums text-mes-ink-3">{pos}</span>
        <span className="truncate font-mono text-[16px] text-mes-ink">
          {shortCode(code)}
          {r?.source === "manual" && <span className="ml-2 rounded bg-mes-blue-soft px-1.5 py-0.5 font-sans text-[12px] font-semibold text-mes-blue">вручную</span>}
        </span>
        <span className="text-[15px] tabular-nums text-mes-ink-3">{r ? fmtTime(r.at) : ""}</span>
      </button>
    )
  }
  return (
    <Drawer open={open} onClose={onClose} title={`Коды палеты № ${pallet.no}`} subtitle={`${pallet.inPallet} из ${pallet.size} · порядок регистрации камерой (FIFO). Касание — проверить код.`} width="max-w-[560px]">
      <div className="divide-y divide-mes-line">
        {[...group].reverse().map((c, i) => (
          <Row key={c} code={c} pos={group.length - i} />
        ))}
        {group.length === 0 && <p className="py-8 text-center text-[16px] text-mes-ink-3">Палета пуста</p>}
        {next.length > 0 && (
          <>
            <p className="bg-mes-panel px-2 py-2 text-[14px] font-semibold text-mes-ink-2">В очереди на палету № {pallet.no + 1} · {next.length}</p>
            {next.map((c, i) => (
              <Row key={c} code={c} pos={i + 1} />
            ))}
          </>
        )}
      </div>
    </Drawer>
  )
}
