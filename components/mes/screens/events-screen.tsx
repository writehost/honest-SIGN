"use client"

import { useState } from "react"
import { ScrollText, Search } from "lucide-react"
import { EventRow } from "../event-row"
import { EVENT_KIND_LABEL, useMes, type EventKind, type Severity } from "../store"
import { Chip, EmptyState, PageHeader, TextInput } from "../ui"

type SevFilter = "all" | "critical" | "warning"

export function EventsScreen() {
  const { state } = useMes()
  const [kind, setKind] = useState<EventKind | "all">("all")
  const [sev, setSev] = useState<SevFilter>("all")
  const [query, setQuery] = useState("")
  const [limit, setLimit] = useState(60)

  const q = query.trim().toLowerCase()
  const sevMatch = (s: Severity) => sev === "all" || (sev === "critical" ? s === "critical" : s === "warning" || s === "critical")
  const list = state.events
    .filter((e) => kind === "all" || e.kind === kind)
    .filter((e) => sevMatch(e.severity))
    .filter((e) => !q || e.title.toLowerCase().includes(q) || (e.detail ?? "").toLowerCase().includes(q) || (e.batchNumber ?? "").includes(q))

  // Разделители по дням — журнал читается как лента смены
  let lastDay = ""

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Журнал событий" subtitle="Действия оператора, агрегация, коды и состояние оборудования" />

      <div className="flex flex-wrap items-center gap-3">
        <Chip on={kind === "all"} onClick={() => setKind("all")} count={state.events.length}>
          Все
        </Chip>
        {(Object.keys(EVENT_KIND_LABEL) as EventKind[]).map((k) => (
          <Chip key={k} on={kind === k} onClick={() => setKind(k)} count={state.events.filter((e) => e.kind === k).length}>
            {EVENT_KIND_LABEL[k]}
          </Chip>
        ))}
        <span className="mx-1 h-8 w-px bg-mes-line-strong" />
        <Chip on={sev === "warning"} onClick={() => setSev(sev === "warning" ? "all" : "warning")}>
          Предупреждения+
        </Chip>
        <Chip on={sev === "critical"} onClick={() => setSev(sev === "critical" ? "all" : "critical")} count={state.events.filter((e) => e.severity === "critical").length}>
          Только ошибки
        </Chip>
        <div className="relative ml-auto w-full sm:w-80">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-6 -translate-y-1/2 text-mes-ink-3" />
          <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по событиям, № партии" className="h-12 pl-13 text-[16px]" />
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-mes-line bg-mes-card">
        {list.length === 0 && <EmptyState icon={ScrollText} title="Событий не найдено" />}
        <div className="divide-y divide-mes-line">
          {list.slice(0, limit).map((e) => {
            const day = new Date(e.at).toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })
            const header = day !== lastDay
            lastDay = day
            return (
              <div key={e.id}>
                {header && <div className="bg-mes-panel px-5 py-2 text-[13px] font-semibold uppercase tracking-[0.05em] text-mes-ink-3">{day}</div>}
                <EventRow e={e} />
              </div>
            )
          })}
        </div>
        {list.length > limit && (
          <button type="button" onClick={() => setLimit((l) => l + 60)} className="h-16 w-full border-t border-mes-line text-[16px] font-semibold text-mes-olive-deep hover:bg-mes-olive-tint">
            Показать ещё ({list.length - limit})
          </button>
        )}
      </section>
    </div>
  )
}
