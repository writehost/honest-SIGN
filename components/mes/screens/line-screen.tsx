"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertOctagon,
  CheckCircle2,
  ChevronRight,
  CircleSlash,
  Flag,
  Gauge,
  Layers,
  Package,
  PackageCheck,
  Pause,
  Play,
  QrCode,
  ScanBarcode,
  ScanLine,
  ScrollText,
  Timer,
  XCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { EventRow } from "../event-row"
import { CODE_STATUS_LABEL, LINE_LABEL, PALLET_LABEL, fmtDuration, fmtNum, fmtTime, formatSscc, shortCode, useMes, type PalletState } from "../store"
import { Btn, Card, Kpi, ProgressBar, StatusPill, TONE, VolumeBadge } from "../ui"
import { useMesUi } from "../ui-context"

export function LineScreen() {
  const { active } = useMes()
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex min-w-0 flex-col gap-5">
        {active ? (
          <>
            <BatchStrip />
            <KpiRow />
            <AggregationCard />
          </>
        ) : (
          <IdleHero />
        )}
      </div>
      <ActionPanel />
    </div>
  )
}

/* ─── Партия ─── */

function BatchStrip() {
  const { active, activeNomenclature } = useMes()
  if (!active) return null
  return (
    <section className="flex flex-wrap items-center gap-5 rounded-2xl border border-mes-line bg-mes-card p-5">
      <VolumeBadge volume={active.volume} size="lg" />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold uppercase tracking-[0.05em] text-mes-ink-3">Активная партия № {active.number}</p>
        <p className="mt-1 truncate text-[26px] font-bold leading-tight text-mes-ink">{active.nomenclatureName}</p>
        <p className="mt-1 text-[15px] text-mes-ink-3">
          {activeNomenclature?.sku} · GTIN {activeNomenclature?.gtin}
        </p>
      </div>
      <dl className="grid grid-cols-3 gap-2 text-center">
        {[
          { k: "Старт", v: fmtTime(active.startedAt).slice(0, 5), icon: Play },
          { k: "В работе", v: fmtDuration(Date.now() - active.startedAt), icon: Timer },
          { k: "Палета", v: `${active.palletSize} шт.`, icon: Package },
        ].map(({ k, v, icon: Icon }) => (
          <div key={k} className="min-w-[118px] rounded-xl bg-mes-panel px-3 py-2.5 ring-1 ring-mes-line">
            <dt className="flex items-center justify-center gap-1.5 text-[12px] font-semibold uppercase text-mes-ink-3">
              <Icon className="size-3.5" />
              {k}
            </dt>
            <dd className="mt-0.5 text-[19px] font-bold tabular-nums text-mes-ink">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function KpiRow() {
  const { active } = useMes()
  if (!active) return null
  const goodPct = active.applied ? Math.round((active.good / active.applied) * 1000) / 10 : 100
  return (
    <div className="grid grid-cols-2 gap-4 2xl:grid-cols-4">
      <Kpi label="Нанесено кодов" value={fmtNum(active.applied)} icon={QrCode} tone="info" sub={active.manualAdded ? `в т.ч. вручную: ${active.manualAdded}` : "принтер + камера"} />
      <Kpi label="Годные бутыли" value={fmtNum(active.good)} icon={CheckCircle2} tone="success" sub={`${goodPct.toLocaleString("ru-RU")} % от нанесённых`} />
      <Kpi label="Брак / удалено" value={fmtNum(active.rejected + active.removed)} icon={CircleSlash} tone={active.rejected + active.removed > 0 ? "warning" : "neutral"} sub={`брак камеры ${active.rejected} · удалено ${active.removed}`} />
      <Kpi label="Палет агрегировано" value={fmtNum(active.pallets)} icon={PackageCheck} tone="neutral" sub={`${fmtNum(active.pallets * active.palletSize)} бут. в палетах`} />
    </div>
  )
}

/* ─── Агрегация: главный визуальный блок ─── */

const BANNER: Partial<Record<PalletState, { icon: typeof ScanBarcode; text: string; sub: string }>> = {
  awaiting_code: { icon: ScanBarcode, text: "Палета собрана — отсканируйте палетный код", sub: "Бутыли продолжают поступать в накопитель" },
  scan_error: { icon: XCircle, text: "Ошибка сканирования палетного кода", sub: "Повторите скан SSCC-этикетки" },
  code_used: { icon: AlertOctagon, text: "Палетный код уже использован", sub: "Возьмите новую этикетку и повторите скан" },
  closed_ok: { icon: PackageCheck, text: "Палета успешно агрегирована", sub: "Формируется следующая палета" },
}

function AggregationCard() {
  const { state, active } = useMes()
  const { openPalletScan } = useMesUi()
  if (!active) return null
  const p = state.pallet
  const size = active.palletSize
  const count = p.items.length
  const st = PALLET_LABEL[p.state]
  const banner = BANNER[p.state]
  const needsScan = p.state === "awaiting_code" || p.state === "scan_error" || p.state === "code_used"
  const remaining = size - count
  const eta = Math.ceil((remaining * 60) / state.settings.lineSpeed)
  const lastPallet = Object.values(state.pallets)
    .filter((x) => x.batchId === active.id)
    .sort((a, b) => b.closedAt - a.closedAt)[0]
  const bufferPct = state.buffer.length / state.settings.bufferLimit

  return (
    <section className={cn("overflow-hidden rounded-2xl border-2 bg-mes-card transition-colors", needsScan ? (p.state === "awaiting_code" ? "border-mes-amber" : "border-mes-red") : p.state === "closed_ok" ? "border-mes-olive" : "border-mes-line")}>
      <header className="flex min-h-14 items-center justify-between gap-3 border-b border-mes-line px-5">
        <h2 className="flex items-center gap-2.5 text-[15px] font-semibold uppercase tracking-[0.04em] text-mes-ink-2">
          <Layers className="size-5 text-mes-olive-strong" /> Агрегация · палета № {p.index}
        </h2>
        <StatusPill tone={st.tone} pulse={needsScan}>
          {st.label}
        </StatusPill>
      </header>

      {banner && (
        <div className={cn("flex flex-wrap items-center gap-4 px-5 py-4", TONE[st.tone].solid)}>
          <banner.icon className="size-10 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[24px] font-bold leading-tight">{banner.text}</p>
            <p className="text-[15px] opacity-90">{p.state === "closed_ok" && p.lastScan ? `${formatSscc(p.lastScan.code)} · ${banner.sub}` : banner.sub}</p>
          </div>
          {needsScan && (
            <button type="button" onClick={openPalletScan} className="mes-pulse flex h-16 items-center gap-3 rounded-2xl bg-white px-6 text-[19px] font-bold text-mes-ink shadow-lg">
              <ScanBarcode className="size-7" /> Сканировать палету
            </button>
          )}
        </div>
      )}

      <div className="grid items-start gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-5">
          <PalletVisual count={needsScan ? size : count} size={size} highlight={needsScan ? "warning" : p.state === "closed_ok" && count === 0 ? "success" : undefined} />
          <RecentBottles />
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <p className="text-[14px] font-semibold uppercase tracking-[0.05em] text-mes-ink-3">Бутылей в палете</p>
            <p className="mt-1 font-bold leading-none tabular-nums text-mes-ink">
              <span className="text-[84px] tracking-tight">{needsScan ? size : count}</span>
              <span className="text-[40px] text-mes-ink-3"> / {size}</span>
            </p>
            <ProgressBar value={needsScan ? size : count} max={size} tone={needsScan ? "warning" : "success"} className="mt-4 h-5" />
            <p className="mt-2 text-[16px] text-mes-ink-2">{needsScan ? "Палета полная" : state.line === "running" ? `Осталось ${remaining} бут. · ≈ ${eta} с` : `Осталось ${remaining} бут.`}</p>
          </div>

          <div className="rounded-2xl bg-mes-panel p-4 ring-1 ring-mes-line">
            <p className="text-[13px] font-semibold uppercase tracking-[0.05em] text-mes-ink-3">Палетный код</p>
            <p className={cn("mt-1 text-[18px] font-semibold", TONE[st.tone].text)}>{needsScan ? (p.state === "awaiting_code" ? "Ожидается скан" : p.lastScan?.message) : "Будет запрошен после набора"}</p>
            {lastPallet && (
              <p className="mt-2 text-[14px] text-mes-ink-3">
                Последняя закрытая: <span className="font-mono text-mes-ink-2">{formatSscc(lastPallet.code)}</span> · {fmtTime(lastPallet.closedAt).slice(0, 5)}
              </p>
            )}
          </div>

          <div className="rounded-2xl bg-mes-panel p-4 ring-1 ring-mes-line">
            <div className="flex items-baseline justify-between">
              <p className="text-[13px] font-semibold uppercase tracking-[0.05em] text-mes-ink-3">Накопитель</p>
              <p className={cn("text-[18px] font-bold tabular-nums", bufferPct >= 0.6 ? "text-mes-amber-strong" : "text-mes-ink")}>
                {state.buffer.length} / {state.settings.bufferLimit}
              </p>
            </div>
            <ProgressBar value={state.buffer.length} max={state.settings.bufferLimit} tone={bufferPct >= 0.6 ? (bufferPct >= 0.85 ? "critical" : "warning") : "neutral"} className="mt-2 h-2.5" />
            <p className="mt-2 text-[13px] text-mes-ink-3">При заполнении линия остановится автоматически</p>
          </div>
        </div>
      </div>
    </section>
  )
}

/** Лента последних бутылей: оператор видит поток и может одним касанием открыть код */
function RecentBottles() {
  const { state, active } = useMes()
  const { inspectCode } = useMesUi()
  if (!active) return null
  const recent = Object.values(state.codes)
    .filter((c) => c.batchId === active.id)
    .sort((a, b) => b.at - a.at)
    .slice(0, 5)
  return (
    <div>
      <p className="mb-2 text-[13px] font-semibold uppercase tracking-[0.05em] text-mes-ink-3">Последние бутыли · коснитесь, чтобы проверить код</p>
      <div className="divide-y divide-mes-line overflow-hidden rounded-2xl ring-1 ring-mes-line">
        {recent.map((c) => {
          const st = CODE_STATUS_LABEL[c.status]
          return (
            <button key={c.code} type="button" onClick={() => inspectCode(c.code)} className="flex min-h-14 w-full items-center gap-4 px-4 text-left hover:bg-mes-panel">
              <span className="w-20 text-[15px] tabular-nums text-mes-ink-3">{fmtTime(c.at)}</span>
              <span className="min-w-0 flex-1 truncate font-mono text-[15px] text-mes-ink">{shortCode(c.code)}</span>
              {c.manual && <span className="rounded-md bg-mes-blue-soft px-2 py-0.5 text-[12px] font-semibold text-mes-blue">вручную</span>}
              <StatusPill tone={st.tone} size="sm">
                {st.label}
              </StatusPill>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Вид палеты сверху: ярусы по 12 бутылей (4 × 3) */
function PalletVisual({ count, size, highlight }: { count: number; size: number; highlight?: "warning" | "success" }) {
  const layers = size / 12
  return (
    <div className={cn("grid gap-3", layers === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3")}>
      {Array.from({ length: layers }, (_, l) => {
        const inLayer = Math.max(0, Math.min(12, count - l * 12))
        const done = inLayer === 12
        return (
          <div key={l} className={cn("rounded-2xl p-3 ring-1", done ? "bg-mes-olive-tint ring-mes-olive/30" : "bg-mes-panel ring-mes-line")}>
            <div className="mb-2 flex items-center justify-between text-[13px] font-semibold uppercase text-mes-ink-3">
              <span>Ярус {l + 1}</span>
              <span className={cn("tabular-nums", done && "text-mes-olive-deep")}>{inLayer}/12</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 12 }, (_, i) => {
                const idx = l * 12 + i
                const filled = idx < count
                const newest = idx === count - 1
                return (
                  <span
                    key={i}
                    className={cn(
                      "aspect-square rounded-full transition-colors",
                      filled
                        ? highlight === "warning"
                          ? "bg-mes-amber shadow-[inset_0_-4px_0_rgb(0_0_0/0.15)]"
                          : "bg-mes-olive-strong shadow-[inset_0_-4px_0_rgb(0_0_0/0.18)]"
                        : "border-2 border-dashed border-mes-line-strong bg-mes-card",
                      filled && newest && !highlight && "mes-pop ring-4 ring-mes-olive/30",
                    )}
                  >
                    {filled && <span className="block size-full scale-[0.42] rounded-full bg-white/35" />}
                  </span>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ─── Нет партии ─── */

function IdleHero() {
  const { state } = useMes()
  const { openLaunch } = useMesUi()
  const last = state.batches.find((b) => b.finishedAt)
  return (
    <section className="flex flex-col items-center justify-center gap-6 rounded-3xl border-2 border-dashed border-mes-line-strong bg-mes-card px-6 py-20 text-center">
      <span className="flex size-24 items-center justify-center rounded-3xl bg-mes-olive-soft">
        <Gauge className="size-12 text-mes-olive-strong" />
      </span>
      <div>
        <h1 className="text-[34px] font-bold text-mes-ink">Линия готова к работе</h1>
        <p className="mt-2 text-[18px] text-mes-ink-2">Нет активной партии. Запустите партию, чтобы начать нанесение кодов и агрегацию.</p>
      </div>
      <Btn size="xl" variant="primary" icon={Play} onClick={() => openLaunch()} className="min-w-96">
        Запустить партию
      </Btn>
      {last && (
        <button type="button" onClick={() => openLaunch(last.nomenclatureId)} className="flex min-h-14 items-center gap-3 rounded-xl px-4 text-[16px] text-mes-ink-2 hover:bg-mes-panel">
          Повторить последнюю: <b className="text-mes-ink">{last.nomenclatureName}</b> <VolumeBadge volume={last.volume} size="sm" />
          <ChevronRight className="size-5" />
        </button>
      )}
    </section>
  )
}

/* ─── Правая панель действий ─── */

function ActionPanel() {
  const { state, active, pause, resume } = useMes()
  const { openLaunch, openPalletScan, openFinish } = useMesUi()
  const router = useRouter()
  const line = LINE_LABEL[state.line]
  const needsScan = ["awaiting_code", "scan_error", "code_used"].includes(state.pallet.state)
  const bufferFull = state.buffer.length >= state.settings.bufferLimit
  const eqDown = !state.equipment.printer || !state.equipment.camera

  return (
    <aside className="order-first flex flex-col gap-4 xl:sticky xl:top-0 xl:order-none xl:self-start">
      <div className={cn("rounded-2xl border-2 p-5", TONE[line.tone].soft, TONE[line.tone].border)}>
        <p className="text-[13px] font-semibold uppercase tracking-[0.05em] text-mes-ink-3">Статус линии</p>
        <p className={cn("mt-1 flex items-center gap-3 text-[28px] font-bold", TONE[line.tone].text)}>
          <span className={cn("size-4 rounded-full", TONE[line.tone].dot, state.line === "running" && "animate-pulse")} />
          {line.label}
        </p>
        <p className="mt-1 text-[15px] text-mes-ink-2">{active ? `${state.settings.lineSpeed} бут/мин · ${state.settings.lineName}` : state.settings.lineName}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-1">
        {!active && (
          <Btn size="xl" variant="primary" icon={Play} onClick={() => openLaunch()} className="col-span-2 xl:col-span-1">
            Старт партии
          </Btn>
        )}
        {active && state.line === "running" && (
          <Btn size="xl" variant="warning" icon={Pause} onClick={pause}>
            Пауза
          </Btn>
        )}
        {active && state.line !== "running" && (
          <Btn size="xl" variant="primary" icon={Play} onClick={resume} disabled={bufferFull || eqDown} sub={bufferFull ? "сначала отсканируйте палету" : eqDown ? "нет связи с оборудованием" : undefined}>
            Продолжить
          </Btn>
        )}
        {active && (
          <Btn size="xl" variant={needsScan ? "dark" : "secondary"} icon={ScanBarcode} onClick={openPalletScan} className={cn(needsScan && "mes-pulse")}>
            Скан палеты
          </Btn>
        )}
        <Btn size="lg" icon={ScanLine} sub="проверка · добавление · удаление" onClick={() => router.push("/mes/codes")} className={cn(!active && "col-span-2 xl:col-span-1")}>
          Ручной режим
        </Btn>
        {active && (
          <Btn size="lg" variant="danger" icon={Flag} onClick={openFinish}>
            Завершить партию
          </Btn>
        )}
      </div>

      <Card
        title="События"
        icon={ScrollText}
        className="hidden xl:flex"
        bodyClassName="py-1 px-4"
        actions={
          <Link href="/mes/events" className="flex h-11 items-center gap-1 rounded-xl px-3 text-[14px] font-semibold text-mes-olive-deep hover:bg-mes-olive-soft">
            Весь журнал <ChevronRight className="size-4" />
          </Link>
        }
      >
        <div className="divide-y divide-mes-line">
          {state.events.slice(0, 6).map((e) => (
            <EventRow key={e.id} e={e} compact />
          ))}
        </div>
      </Card>
    </aside>
  )
}
