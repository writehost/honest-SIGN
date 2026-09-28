"use client"

import { useMemo, useState } from "react"
import { ChevronRight, Download, Layers, Printer, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { EventRow } from "../event-row"
import { BATCH_STATUS_LABEL, fmtDateTime, fmtDuration, fmtNum, fmtTime, formatSscc, useMes, type Batch, type BatchStatus, type Volume } from "../store"
import { Btn, Chip, Drawer, EmptyState, PageHeader, StatusPill, TextInput, VolumeBadge } from "../ui"
import { useMesUi } from "../ui-context"

type StatusFilter = "all" | "active" | "done" | "warn" | "aborted"
const STATUS_FILTER: Record<StatusFilter, { label: string; match: (s: BatchStatus) => boolean }> = {
  all: { label: "Все", match: () => true },
  active: { label: "В работе", match: (s) => s === "active" || s === "paused" },
  done: { label: "Завершены", match: (s) => s === "completed" },
  warn: { label: "С замечаниями", match: (s) => s === "completed_warn" },
  aborted: { label: "Прерваны", match: (s) => s === "aborted" },
}

export function BatchesScreen() {
  const { state } = useMes()
  const [status, setStatus] = useState<StatusFilter>("all")
  const [volume, setVolume] = useState<Volume | "all">("all")
  const [query, setQuery] = useState("")
  const [openId, setOpenId] = useState<string | null>(null)

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return state.batches
      .filter((b) => STATUS_FILTER[status].match(b.status))
      .filter((b) => volume === "all" || b.volume === volume)
      .filter((b) => !q || b.number.includes(q) || b.nomenclatureName.toLowerCase().includes(q))
  }, [state.batches, status, volume, query])

  const opened = state.batches.find((b) => b.id === openId)

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Партии" subtitle={`${state.batches.length} партий за последние 5 суток`} />

      <div className="flex flex-wrap items-center gap-3">
        {(Object.keys(STATUS_FILTER) as StatusFilter[]).map((k) => (
          <Chip key={k} on={status === k} onClick={() => setStatus(k)} count={state.batches.filter((b) => STATUS_FILTER[k].match(b.status)).length}>
            {STATUS_FILTER[k].label}
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
        <div className="hidden grid-cols-[170px_minmax(0,1fr)_200px_repeat(4,100px)_48px] items-center gap-4 border-b border-mes-line bg-mes-panel px-5 py-3 text-[13px] font-semibold uppercase tracking-[0.04em] text-mes-ink-3 xl:grid">
          <span>Партия</span>
          <span>Номенклатура</span>
          <span>Статус</span>
          <span className="text-right">Нанесено</span>
          <span className="text-right">Палет</span>
          <span className="text-right">Брак/удал.</span>
          <span className="text-right">Ручн./ош.</span>
          <span />
        </div>
        {list.length === 0 && <EmptyState icon={Layers} title="Партий не найдено" text="Измените фильтры или строку поиска" />}
        <div className="divide-y divide-mes-line">
          {list.map((b) => (
            <BatchRow key={b.id} b={b} onOpen={() => setOpenId(b.id)} />
          ))}
        </div>
      </section>

      {opened && <BatchDrawer b={opened} onClose={() => setOpenId(null)} />}
    </div>
  )
}

function BatchRow({ b, onOpen }: { b: Batch; onOpen: () => void }) {
  const st = BATCH_STATUS_LABEL[b.status]
  const isActive = b.status === "active" || b.status === "paused"
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "grid w-full grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-5 py-4 text-left hover:bg-mes-panel xl:min-h-20 xl:grid-cols-[170px_minmax(0,1fr)_200px_repeat(4,100px)_48px] xl:py-3",
        isActive && "bg-mes-olive-tint",
      )}
    >
      <span>
        <span className="block text-[18px] font-bold tabular-nums text-mes-ink">№ {b.number}</span>
        <span className="block text-[14px] text-mes-ink-3">{fmtDateTime(b.startedAt)}</span>
      </span>
      <span className="order-first col-span-2 flex min-w-0 items-center gap-3 xl:order-none xl:col-span-1">
        <VolumeBadge volume={b.volume} size="sm" />
        <span className="truncate text-[17px] font-semibold text-mes-ink">{b.nomenclatureName}</span>
      </span>
      <span>
        <StatusPill tone={st.tone} size="sm" pulse={b.status === "active"}>
          {st.label}
        </StatusPill>
      </span>
      <Num v={b.applied} label="нанесено" />
      <Num v={b.pallets} label="палет" />
      <Num v={b.rejected + b.removed} label="брак/удал." tone={b.rejected + b.removed > 0 ? "warn" : undefined} />
      <Num v={`${b.manualAdded} / ${b.errors}`} label="ручн./ош." tone={b.errors > 0 ? "crit" : undefined} />
      <ChevronRight className="hidden size-6 justify-self-end text-mes-ink-3 xl:block" />
    </button>
  )
}

function Num({ v, label, tone }: { v: number | string; label: string; tone?: "warn" | "crit" }) {
  return (
    <span className="text-left xl:text-right">
      <span className={cn("block text-[18px] font-bold tabular-nums", tone === "warn" ? "text-mes-amber-strong" : tone === "crit" ? "text-mes-red-strong" : "text-mes-ink")}>{typeof v === "number" ? fmtNum(v) : v}</span>
      <span className="block text-[12px] text-mes-ink-3 xl:hidden">{label}</span>
    </span>
  )
}

function BatchDrawer({ b, onClose }: { b: Batch; onClose: () => void }) {
  const { state } = useMes()
  const { toast } = useMesUi()
  const st = BATCH_STATUS_LABEL[b.status]
  const pallets = Object.values(state.pallets)
    .filter((p) => p.batchId === b.id)
    .sort((x, y) => y.closedAt - x.closedAt)
  const events = state.events.filter((e) => e.batchNumber === b.number)
  const stub = () => toast({ tone: "info", title: "Функция прототипа", text: "Экспорт отчёта и печать подключаются на этапе интеграции" })

  return (
    <Drawer
      open
      onClose={onClose}
      title={`Партия № ${b.number}`}
      subtitle={
        <span className="flex flex-wrap items-center gap-2">
          <VolumeBadge volume={b.volume} size="sm" /> {b.nomenclatureName}
        </span>
      }
      footer={
        <>
          <Btn icon={Printer} onClick={stub}>
            Печать
          </Btn>
          <Btn variant="primary" icon={Download} onClick={stub}>
            Отчёт по партии
          </Btn>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-3">
          <StatusPill tone={st.tone} size="lg">
            {st.label}
          </StatusPill>
          <span className="text-[16px] text-mes-ink-2">
            {fmtDateTime(b.startedAt)} → {b.finishedAt ? fmtTime(b.finishedAt).slice(0, 5) : "сейчас"} · {fmtDuration((b.finishedAt ?? Date.now()) - b.startedAt)} · {b.operator}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Нанесено", b.applied],
            ["Годных", b.good],
            ["Палет", b.pallets],
            ["Размер палеты", b.palletSize],
            ["Брак камеры", b.rejected],
            ["Удалено", b.removed],
            ["Добавлено вручную", b.manualAdded],
            ["Ошибки агрегации", b.errors],
          ].map(([k, v]) => (
            <div key={k as string} className="rounded-2xl bg-mes-panel p-4 ring-1 ring-mes-line">
              <p className="text-[12px] font-semibold uppercase text-mes-ink-3">{k}</p>
              <p className="mt-1 text-[26px] font-bold tabular-nums text-mes-ink">{fmtNum(v as number)}</p>
            </div>
          ))}
        </div>

        <div>
          <h3 className="mb-2 text-[15px] font-semibold uppercase tracking-[0.04em] text-mes-ink-2">Палеты</h3>
          {pallets.length === 0 ? (
            <p className="rounded-2xl bg-mes-panel p-4 text-[15px] text-mes-ink-3 ring-1 ring-mes-line">Детализация палет хранится в архиве. В прототипе доступна для последних партий.</p>
          ) : (
            <div className="divide-y divide-mes-line rounded-2xl ring-1 ring-mes-line">
              {pallets.map((p, i) => (
                <div key={p.code} className="flex min-h-14 items-center gap-4 px-4">
                  <span className="w-10 text-[15px] font-bold text-mes-ink-3">#{pallets.length - i}</span>
                  <span className="flex-1 font-mono text-[15px] text-mes-ink">{formatSscc(p.code)}</span>
                  <span className="text-[15px] tabular-nums text-mes-ink-2">
                    {p.count} бут.{p.partial && <span className="ml-2 font-semibold text-mes-amber-strong">неполная</span>}
                  </span>
                  <span className="w-20 text-right text-[14px] tabular-nums text-mes-ink-3">{fmtTime(p.closedAt).slice(0, 5)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="mb-2 text-[15px] font-semibold uppercase tracking-[0.04em] text-mes-ink-2">События партии</h3>
          {events.length === 0 ? (
            <p className="rounded-2xl bg-mes-panel p-4 text-[15px] text-mes-ink-3 ring-1 ring-mes-line">Нет событий в оперативном журнале</p>
          ) : (
            <div className="divide-y divide-mes-line rounded-2xl px-4 ring-1 ring-mes-line">
              {events.slice(0, 40).map((e) => (
                <EventRow key={e.id} e={e} compact />
              ))}
            </div>
          )}
        </div>
      </div>
    </Drawer>
  )
}
