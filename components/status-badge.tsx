import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { getStatusDescription } from "@/lib/status-labels"
import type { CodeStatus, GroupType } from "@/lib/mock-data"

export function StatusBadge({ status }: { status: CodeStatus }) {
  const config: Record<CodeStatus, { dot: string; text: string; bg: string }> = {
    "В обороте": { dot: "bg-green-600", text: "text-green-700 dark:text-green-400", bg: "bg-green-500/10" },
    "Выведен": { dot: "bg-red-600", text: "text-red-700 dark:text-red-400", bg: "bg-red-500/10" },
    "Выбыл": { dot: "bg-red-600", text: "text-red-700 dark:text-red-400", bg: "bg-red-500/10" },
    "Списан": { dot: "bg-red-600", text: "text-red-700 dark:text-red-400", bg: "bg-red-500/10" },
    "Нанесён": { dot: "bg-accent", text: "text-accent", bg: "bg-accent/10" },
    "Эмитирован": { dot: "bg-warning", text: "text-warning", bg: "bg-warning/10" },
    "Агрегирован": { dot: "bg-chart-2", text: "text-chart-2", bg: "bg-chart-2/10" },
    "Расформирован": { dot: "bg-amber-600", text: "text-amber-700 dark:text-amber-400", bg: "bg-amber-500/10" },
    "Пустая упаковка": { dot: "bg-muted-foreground", text: "text-muted-foreground", bg: "bg-muted/50" },
  }
  const c = config[status]
  if (!c) {
    return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-muted text-muted-foreground">{status}</span>
  }
  const description = getStatusDescription(status)
  const badge = (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium", c.bg, c.text)}>
      <span className={cn("size-1.5 rounded-full", c.dot)} />
      {status}
    </span>
  )
  if (description) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-xs bg-muted border border-border text-foreground shadow-md"
        >
          {description}
        </TooltipContent>
      </Tooltip>
    )
  }
  return badge
}

export function GroupTypeBadge({ type }: { type: GroupType }) {
  const config: Record<GroupType, { icon: string; bg: string; text: string }> = {
    "Продукт": { icon: "P", bg: "bg-accent/10", text: "text-accent" },
    "Блок": { icon: "B", bg: "bg-chart-2/10", text: "text-chart-2" },
    "Палета": { icon: "П", bg: "bg-chart-4/10", text: "text-chart-4" },
  }
  const c = config[type]
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium", c.bg, c.text)}>
      <span className="font-mono font-bold text-[10px]">{c.icon}</span>
      {type}
    </span>
  )
}
