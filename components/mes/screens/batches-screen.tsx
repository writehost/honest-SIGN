"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ChevronRight, Layers, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { EventRow } from "../event-row"
import { BATCH_STATUS_LABEL, batchTotal, fmtDateTime, fmtDuration, fmtNum, fmtTime, formatSscc, useMes, type Batch, type BatchStatus, type Volume } from "../store"
import { Chip, Drawer, EmptyState, PageHeader, StatusPill, TextInput, VolumeBadge } from "../ui"

type StatusFilter = "all" | BatchStatus
const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "active", label: "В работе" },
  { id: "completed", label: "Завершены" },
  { id: "completed_warn", label: "С корректировками" },
]

const XL_COLS = "xl:grid-cols-[180px_minmax(0,1fr)_230px_repeat(5,110px)_40px]"

export function BatchesScreen() {
  const { state } = useMes()
  const params = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<StatusFilter>("all")
  const [volume, setVolume] = useState<Volume | "all">("all")
  const [query, setQuery] = useState(() => params.get("q") ?? "")
  // Поиск из верхней строки приходит параметром ?q=
  const qParam = params.get("q")
  useEffect(() => {
    if (qParam !== null) setQuery(qParam)
  }, [qParam])
  const openId = params.get("batch")
  const setOpen = (id: string | null) => router.replace(id ? `/mes/batches?batch=${id}` : "/mes/batches")

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return state.batches
      .filter((b) => status === "all" || b.status === status)
      .filter((b) => volume === "all" || b.volume === volume)
      .filter((b) => !q || b.number.includes(q) || b.nomenclatureName.toLowerCase().includes(q))
  }, [state.batches, status, volume, query])
  const opened = state.batches.find((b) => b.id === openId)

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Партии" />
      <div className="flex flex-wrap items-center gap-3">
        {FILTERS.map((f) => (
          <Chip key={f.id} on={status === f.id} onClick={() => setStatus(f.id)} count={state.batches.filter((b) => f.id === "all" || b.status === f.id).length}>
            {f.label}
          </Chip>
        ))}
        <span className="mx-1 h-8 w-px bg-mes-line-strong" />
        <Chip on={volume === "all"} onClick={() => setVolume("all")}>Все объёмы</Chip>
        <Chip on={volume === 19} onClick={() => setVolume(19)}>19 л</Chip>
        <Chip on={volume === 11} onClick={() => setVolume(11)}>11 л</Chip>
        <div className="relative ml-auto w-full sm:w-80">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-6 -translate-y-1/2 text-mes-ink-3" />
          <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="№ партии или продукт" className="h-12 pl-13 text-[16px]" />
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-mes-line bg-mes-card">
        <div className={cn("hidden items-center gap-4 border-b border-mes-line bg-mes-panel px-5 py-3 text-[13px] font-semibold uppercase tracking-[0.04em] text-mes-ink-3 xl:grid", XL_COLS)}>
          <span>Партия</span>
          <span>Номенклатура</span>
          <span>Статус</span>
          <span className="text-right">Нанесено</span>
          <span className="text-right">Всего бут.</span>
          <span className="text-right">Палет</span>
          <span className="text-right">Корр.</span>
          <span className="text-right">Без палеты</span>
          <span />
        </div>
        {list.length === 0 && <EmptyState icon={Layers} title="Партий не найдено" />}
        <div className="divide-y divide-mes-line/70">
          {list.map((b) => (
            <Row key={b.id} b={b} onOpen={() => setOpen(b.id)} />
          ))}
        </div>
      </section>
      {opened && <BatchDrawer b={opened} onClose={() => setOpen(null)} />}
    </div>
  )
}

function Row({ b, onOpen }: { b: Batch; onOpen: () => void }) {
  const st = BATCH_STATUS_LABEL[b.status]
  const corr = b.manualAdded + b.removed
  const left = b.status === "active" ? null : b.unaggregated
  return (
    <button type="button" onClick={onOpen} className={cn("grid w-full grid-cols-2 items-center gap-x-4 gap-y-2 px-5 py-4 text-left even:bg-mes-panel hover:bg-mes-sand xl:min-h-[72px] xl:py-2", XL_COLS, b.status === "active" && "bg-mes-olive-tint even:bg-mes-olive-tint")}>
      <span>
        <span className="block text-[18px] font-bold tabular-nums text-mes-ink">№ {b.number}</span>
        <span className="block text-[14px] text-mes-ink-3">{fmtDateTime(b.startedAt)}</span>
      </span>
      <span className="flex min-w-0 items-center gap-3">
        <VolumeBadge volume={b.volume} size="sm" />
        <span className="truncate text-[17px] font-semibold text-mes-ink">{b.nomenclatureName}</span>
      </span>
      <span>
        <StatusPill tone={st.tone} size="sm">
          {st.label}
        </StatusPill>
      </span>
      <Num v={fmtNum(b.applied)} />
      <Num v={fmtNum(batchTotal(b))} strong />
      <Num v={fmtNum(b.pallets)} />
      <Num v={corr ? [b.manualAdded ? `+${b.manualAdded}` : "", b.removed ? `−${b.removed}` : ""].filter(Boolean).join(" / ") : "—"} tone={corr ? "text-mes-amber-strong" : "text-mes-ink-3"} />
      <Num v={left === null ? "—" : fmtNum(left)} tone={left ? "text-mes-amber-strong" : "text-mes-ink-3"} />
      <ChevronRight className="hidden size-6 justify-self-end text-mes-ink-3 xl:block" />
    </button>
  )
}

function Num({ v, tone, strong }: { v: string; tone?: string; strong?: boolean }) {
  return <span className={cn("text-left text-[18px] tabular-nums xl:text-right", strong ? "font-bold" : "font-semibold", tone ?? "text-mes-ink")}>{v}</span>
}

function BatchDrawer({ b, onClose }: { b: Batch; onClose: () => void }) {
  const { state } = useMes()
  const st = BATCH_STATUS_LABEL[b.status]
  const pallets = Object.values(state.pallets)
    .filter((p) => p.batchId === b.id)
    .sort((x, y) => y.no - x.no)
  const events = state.events.filter((e) => e.batchNumber === b.number)
  const counters: [string, number][] = [
    ["Нанесено кодов", b.applied],
    ["Всего бутылей", batchTotal(b)],
    ["Палет", b.pallets],
    ["Без палеты", b.status === "active" ? state.fifo.length : b.unaggregated],
    ["Добавлено вручную", b.manualAdded],
    ["Удалено", b.removed],
    ["NoRead камеры", b.noReads],
    ["Повторные считывания", b.duplicates],
    ["Чужая номенклатура", b.foreign],
    ["Отклонённые SSCC", b.ssccErrors],
  ]
  return (
    <Drawer
      open
      onClose={onClose}
      title={`Партия № ${b.number}`}
      subtitle={
        <span className="flex flex-wrap items-center gap-2">
          <VolumeBadge volume={b.volume} size="sm" /> {b.nomenclatureName} · палета {b.palletSize}
        </span>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-3">
          <StatusPill tone={st.tone} size="lg">
            {st.label}
          </StatusPill>
          <span className="text-[16px] text-mes-ink-2">
            {fmtDateTime(b.startedAt)} — {b.finishedAt ? fmtTime(b.finishedAt).slice(0, 5) : "сейчас"} · {fmtDuration((b.finishedAt ?? Date.now()) - b.startedAt)} · {b.operator}
          </span>
        </div>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {counters.map(([k, v]) => (
            <div key={k} className="rounded-xl bg-mes-panel p-3 ring-1 ring-mes-line">
              <dt className="text-[12px] font-semibold uppercase text-mes-ink-3">{k}</dt>
              <dd className="mt-1 text-[24px] font-bold tabular-nums text-mes-ink">{fmtNum(v)}</dd>
            </div>
          ))}
        </dl>
        <p className="text-[14px] text-mes-ink-3">Всего бутылей = нанесено камерой + добавлено вручную − удалено.</p>
        <div>
          <h3 className="mb-2 text-[15px] font-semibold uppercase tracking-[0.04em] text-mes-ink-2">Закрытые палеты · {pallets.length}</h3>
          <div className="divide-y divide-mes-line rounded-2xl ring-1 ring-mes-line">
            {pallets.map((p) => (
              <div key={p.code} className="flex min-h-12 items-center gap-4 px-4">
                <span className="w-12 text-[15px] font-bold text-mes-ink-3">№ {p.no}</span>
                <span className="flex-1 font-mono text-[15px] text-mes-ink">{formatSscc(p.code)}</span>
                <span className="text-[15px] tabular-nums text-mes-ink-2">
                  {p.count} бут.{p.partial && <span className="ml-2 font-semibold text-mes-amber-strong">неполная</span>}
                </span>
                <span className="w-20 text-right text-[14px] tabular-nums text-mes-ink-3">{fmtTime(p.closedAt).slice(0, 5)}</span>
              </div>
            ))}
            {pallets.length === 0 && <p className="p-4 text-[15px] text-mes-ink-3">Нет закрытых палет</p>}
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-[15px] font-semibold uppercase tracking-[0.04em] text-mes-ink-2">События</h3>
          <div className="divide-y divide-mes-line rounded-2xl px-4 ring-1 ring-mes-line">
            {events.slice(0, 60).map((e) => (
              <EventRow key={e.id} e={e} compact />
            ))}
            {events.length === 0 && <p className="py-4 text-[15px] text-mes-ink-3">Нет событий</p>}
          </div>
        </div>
      </div>
    </Drawer>
  )
}
