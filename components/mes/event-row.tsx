"use client"

import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { EVENT_KIND_LABEL, fmtTime, type MesEvent } from "./store"
import { TONE } from "./ui"

const ICON = { success: CheckCircle2, warning: AlertTriangle, critical: XCircle, info: Info }

export function EventRow({ e, compact, showDate }: { e: MesEvent; compact?: boolean; showDate?: boolean }) {
  const Icon = ICON[e.severity]
  const t = TONE[e.severity]
  return (
    <div className={cn("flex items-start gap-3", compact ? "py-2.5" : "min-h-[72px] px-5 py-3.5", e.severity === "critical" && !compact && "bg-mes-red-soft/50")}>
      <span className={cn("flex shrink-0 items-center justify-center rounded-xl", t.soft, compact ? "size-9" : "size-11")}>
        <Icon className={cn(t.text, compact ? "size-5" : "size-6")} />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("font-semibold leading-snug text-mes-ink", compact ? "text-[15px]" : "text-[17px]")}>{e.title}</p>
        {(e.detail || !compact) && (
          <p className={cn("mt-0.5 truncate text-mes-ink-3", compact ? "text-[13px]" : "text-[14px]")}>
            {!compact && <span className="mr-2 rounded-md bg-mes-panel px-1.5 py-0.5 font-semibold text-mes-ink-2 ring-1 ring-mes-line">{EVENT_KIND_LABEL[e.kind]}</span>}
            {e.detail}
            {!compact && e.batchNumber && <span className="ml-2">· партия № {e.batchNumber}</span>}
          </p>
        )}
      </div>
      <span className={cn("shrink-0 text-right tabular-nums text-mes-ink-3", compact ? "text-[13px]" : "text-[15px]")}>
        {fmtTime(e.at)}
        {showDate && <span className="block text-[12px]">{new Date(e.at).toLocaleDateString("ru-RU")}</span>}
      </span>
    </div>
  )
}
