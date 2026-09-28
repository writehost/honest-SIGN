"use client"

import { useEffect, type ButtonHTMLAttributes, type ComponentProps, type ReactNode } from "react"
import { X, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Tone, Volume } from "./store"

/* ─── Тоны состояний: единая таблица для всех компонентов ─── */

export const TONE: Record<Tone, { soft: string; text: string; border: string; solid: string; dot: string; ring: string }> = {
  success: { soft: "bg-mes-olive-soft", text: "text-mes-olive-deep", border: "border-mes-olive/40", solid: "bg-mes-olive-strong text-white", dot: "bg-mes-olive", ring: "ring-mes-olive/40" },
  warning: { soft: "bg-mes-amber-soft", text: "text-mes-amber-strong", border: "border-mes-amber/45", solid: "bg-mes-amber text-white", dot: "bg-mes-amber", ring: "ring-mes-amber/40" },
  critical: { soft: "bg-mes-red-soft", text: "text-mes-red-strong", border: "border-mes-red/45", solid: "bg-mes-red text-white", dot: "bg-mes-red", ring: "ring-mes-red/40" },
  info: { soft: "bg-mes-blue-soft", text: "text-mes-blue", border: "border-mes-blue/35", solid: "bg-mes-blue text-white", dot: "bg-mes-blue", ring: "ring-mes-blue/40" },
  neutral: { soft: "bg-mes-panel", text: "text-mes-ink-2", border: "border-mes-line-strong", solid: "bg-mes-ink text-white", dot: "bg-mes-ink-3", ring: "ring-mes-ink-3/30" },
}

/* ─── Card ─── */

export function Card({
  title,
  icon: Icon,
  actions,
  className,
  bodyClassName,
  children,
}: {
  title?: ReactNode
  icon?: LucideIcon
  actions?: ReactNode
  className?: string
  bodyClassName?: string
  children: ReactNode
}) {
  return (
    <section className={cn("flex flex-col rounded-2xl border border-mes-line bg-mes-card shadow-[0_1px_2px_rgb(35_39_46/0.04)]", className)}>
      {(title || actions) && (
        <header className="flex min-h-14 items-center justify-between gap-3 border-b border-mes-line px-5">
          <h2 className="flex items-center gap-2.5 text-[15px] font-semibold uppercase tracking-[0.04em] text-mes-ink-2">
            {Icon && <Icon className="size-5 text-mes-olive-strong" strokeWidth={2.2} />}
            {title}
          </h2>
          {actions}
        </header>
      )}
      <div className={cn("flex-1 p-5", bodyClassName)}>{children}</div>
    </section>
  )
}

/* ─── Кнопки: минимум 56 px по высоте, крупная иконка ─── */

type BtnVariant = "primary" | "secondary" | "warning" | "danger" | "ghost" | "dark"
type BtnSize = "md" | "lg" | "xl"

const BTN_VARIANT: Record<BtnVariant, string> = {
  primary: "bg-mes-olive-strong text-white hover:bg-mes-olive-deep active:bg-mes-olive-deep shadow-[0_2px_0_#4f6519]",
  secondary: "bg-mes-card text-mes-ink border border-mes-line-strong hover:bg-mes-panel active:bg-mes-line",
  warning: "bg-mes-amber text-white hover:bg-mes-amber-strong active:bg-mes-amber-strong shadow-[0_2px_0_#b86d05]",
  danger: "bg-mes-card text-mes-red-strong border-2 border-mes-red/50 hover:bg-mes-red-soft active:bg-mes-red-soft",
  ghost: "bg-transparent text-mes-ink-2 hover:bg-mes-panel active:bg-mes-line",
  dark: "bg-mes-ink text-white hover:bg-black active:bg-black shadow-[0_2px_0_#000]",
}
const BTN_SIZE: Record<BtnSize, string> = {
  md: "min-h-14 px-5 text-[17px] gap-2.5 rounded-xl",
  lg: "min-h-[72px] px-6 text-[19px] gap-3 rounded-2xl",
  xl: "min-h-24 px-7 text-[22px] gap-3.5 rounded-2xl",
}

export function Btn({
  variant = "secondary",
  size = "md",
  icon: Icon,
  sub,
  block,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: BtnSize; icon?: LucideIcon; sub?: ReactNode; block?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex select-none items-center justify-center font-semibold transition-[background,transform] duration-100 active:translate-y-px disabled:pointer-events-none disabled:opacity-40",
        BTN_VARIANT[variant],
        BTN_SIZE[size],
        block && "w-full",
        sub && "justify-start text-left",
        className,
      )}
      {...rest}
    >
      {Icon && <Icon className={cn("shrink-0", size === "md" ? "size-6" : size === "lg" ? "size-7" : "size-8")} strokeWidth={2.2} />}
      {sub ? (
        <span className="flex flex-col leading-tight">
          <span>{children}</span>
          <span className="mt-0.5 text-[13px] font-medium opacity-75">{sub}</span>
        </span>
      ) : (
        children
      )}
    </button>
  )
}

/* ─── Статусы ─── */

export function StatusPill({ tone, children, size = "md", pulse, className }: { tone: Tone; children: ReactNode; size?: "sm" | "md" | "lg"; pulse?: boolean; className?: string }) {
  const t = TONE[tone]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 whitespace-nowrap rounded-full border font-semibold",
        t.soft,
        t.text,
        t.border,
        size === "sm" && "h-7 px-2.5 text-[13px]",
        size === "md" && "h-9 px-3.5 text-[15px]",
        size === "lg" && "h-12 px-5 text-[18px]",
        className,
      )}
    >
      <span className={cn("relative size-2.5 rounded-full", t.dot)}>
        {pulse && <span className={cn("absolute inset-0 animate-ping rounded-full", t.dot)} />}
      </span>
      {children}
    </span>
  )
}

export function VolumeBadge({ volume, size = "md" }: { volume: Volume; size?: "sm" | "md" | "lg" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-xl font-bold tabular-nums",
        volume === 19 ? "bg-mes-ink text-white" : "bg-mes-blue-soft text-mes-blue ring-1 ring-mes-blue/30",
        size === "sm" && "h-7 min-w-12 px-2 text-[13px]",
        size === "md" && "h-10 min-w-16 px-3 text-[17px]",
        size === "lg" && "h-16 min-w-24 px-4 text-[30px]",
      )}
    >
      {volume} л
    </span>
  )
}

/* ─── Сегментированный переключатель ─── */

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  size = "md",
  className,
}: {
  options: { value: T; label: ReactNode; sub?: ReactNode; icon?: LucideIcon }[]
  value: T
  onChange: (v: T) => void
  size?: "md" | "lg"
  className?: string
}) {
  return (
    <div className={cn("grid gap-1.5 rounded-2xl bg-mes-panel p-1.5 ring-1 ring-mes-line", className)} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => {
        const on = o.value === value
        const Icon = o.icon
        return (
          <button
            key={String(o.value)}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "flex items-center justify-center gap-2.5 rounded-xl px-3 font-semibold transition-colors",
              size === "md" ? "min-h-12 text-[16px]" : "min-h-[68px] text-[19px]",
              on ? "bg-mes-card text-mes-ink shadow-sm ring-2 ring-mes-olive" : "text-mes-ink-2 hover:bg-mes-card/70",
            )}
          >
            {Icon && <Icon className={cn("size-6", on ? "text-mes-olive-strong" : "text-mes-ink-3")} />}
            <span className="flex flex-col items-center leading-tight">
              {o.label}
              {o.sub && <span className="text-[12px] font-medium text-mes-ink-3">{o.sub}</span>}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/* ─── Переключатель-строка (всё поле — зона касания) ─── */

export function ToggleRow({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; description?: ReactNode }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex min-h-[72px] w-full items-center justify-between gap-6 rounded-xl px-4 py-3 text-left hover:bg-mes-panel">
      <span>
        <span className="block text-[17px] font-semibold text-mes-ink">{label}</span>
        {description && <span className="mt-0.5 block text-[14px] text-mes-ink-3">{description}</span>}
      </span>
      <span className={cn("relative h-9 w-16 shrink-0 rounded-full transition-colors", checked ? "bg-mes-olive-strong" : "bg-mes-line-strong")}>
        <span className={cn("absolute top-1 size-7 rounded-full bg-white shadow transition-[left]", checked ? "left-8" : "left-1")} />
      </span>
    </button>
  )
}

/* ─── Поля ввода ─── */

export function Field({ label, hint, error, children, className }: { label: ReactNode; hint?: ReactNode; error?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cn("flex flex-col gap-2", className)}>
      <span className="text-[14px] font-semibold uppercase tracking-[0.04em] text-mes-ink-2">{label}</span>
      {children}
      {error ? <span className="text-[14px] font-medium text-mes-red-strong">{error}</span> : hint && <span className="text-[14px] text-mes-ink-3">{hint}</span>}
    </label>
  )
}

export function TextInput({ className, invalid, ...rest }: ComponentProps<"input"> & { invalid?: boolean }) {
  return (
    <input
      className={cn(
        "h-14 w-full rounded-xl border bg-mes-card px-4 text-[18px] text-mes-ink outline-none placeholder:text-mes-ink-3 focus:border-mes-olive focus:ring-4 focus:ring-mes-olive/20",
        invalid ? "border-mes-red" : "border-mes-line-strong",
        className,
      )}
      {...rest}
    />
  )
}

/* ─── KPI ─── */

export function Kpi({ label, value, sub, tone = "neutral", icon: Icon, className }: { label: string; value: ReactNode; sub?: ReactNode; tone?: Tone; icon?: LucideIcon; className?: string }) {
  const t = TONE[tone]
  return (
    <div className={cn("relative flex flex-col justify-between overflow-hidden rounded-2xl border border-mes-line bg-mes-card p-5", className)}>
      <span className={cn("absolute inset-y-0 left-0 w-1.5", t.dot)} />
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-semibold uppercase tracking-[0.05em] text-mes-ink-2">{label}</span>
        {Icon && (
          <span className={cn("flex size-10 items-center justify-center rounded-xl", t.soft)}>
            <Icon className={cn("size-5", t.text)} strokeWidth={2.2} />
          </span>
        )}
      </div>
      <div className="mt-3 text-[44px] font-bold leading-none tracking-tight text-mes-ink tabular-nums">{value}</div>
      {sub && <div className="mt-2 text-[14px] text-mes-ink-3">{sub}</div>}
    </div>
  )
}

export function ProgressBar({ value, max, tone = "success", className }: { value: number; max: number; tone?: Tone; className?: string }) {
  const pct = Math.min(100, (value / Math.max(1, max)) * 100)
  return (
    <div className={cn("h-4 w-full overflow-hidden rounded-full bg-mes-line", className)}>
      <div className={cn("h-full rounded-full transition-[width] duration-300", TONE[tone].dot)} style={{ width: `${pct}%` }} />
    </div>
  )
}

/* ─── Оверлеи ─── */

function useEsc(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", h)
    return () => window.removeEventListener("keydown", h)
  }, [open, onClose])
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  icon: Icon,
  tone = "neutral",
  width = "max-w-3xl",
  footer,
  children,
  dismissable = true,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  subtitle?: ReactNode
  icon?: LucideIcon
  tone?: Tone
  width?: string
  footer?: ReactNode
  children: ReactNode
  dismissable?: boolean
}) {
  useEsc(open && dismissable, onClose)
  if (!open) return null
  const t = TONE[tone]
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-mes-ink/45 p-4 backdrop-blur-[2px] sm:p-8" onPointerDown={(e) => dismissable && e.target === e.currentTarget && onClose()}>
      <div className={cn("mes-fade-up flex max-h-full w-full flex-col overflow-hidden rounded-3xl bg-mes-card shadow-2xl", width)}>
        <header className="flex items-start gap-4 border-b border-mes-line px-7 py-5">
          {Icon && (
            <span className={cn("flex size-14 shrink-0 items-center justify-center rounded-2xl", t.soft)}>
              <Icon className={cn("size-7", tone === "neutral" ? "text-mes-olive-strong" : t.text)} strokeWidth={2.2} />
            </span>
          )}
          <div className="min-w-0 flex-1 pt-1">
            <h2 className="text-[24px] font-bold leading-tight text-mes-ink">{title}</h2>
            {subtitle && <p className="mt-1 text-[16px] text-mes-ink-2">{subtitle}</p>}
          </div>
          {dismissable && (
            <button type="button" onClick={onClose} aria-label="Закрыть" className="flex size-14 shrink-0 items-center justify-center rounded-2xl text-mes-ink-2 hover:bg-mes-panel active:bg-mes-line">
              <X className="size-7" />
            </button>
          )}
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-7 py-6">{children}</div>
        {footer && <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-mes-line bg-mes-panel px-7 py-5">{footer}</footer>}
      </div>
    </div>
  )
}

export function Drawer({ open, onClose, title, subtitle, footer, children, width = "max-w-[720px]" }: { open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode; footer?: ReactNode; children: ReactNode; width?: string }) {
  useEsc(open, onClose)
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-mes-ink/35" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={cn("mes-slide-in flex h-full w-full flex-col bg-mes-card shadow-2xl", width)}>
        <header className="flex items-start gap-4 border-b border-mes-line px-7 py-5">
          <div className="min-w-0 flex-1">
            <h2 className="text-[24px] font-bold text-mes-ink">{title}</h2>
            {subtitle && <div className="mt-1 text-[16px] text-mes-ink-2">{subtitle}</div>}
          </div>
          <button type="button" onClick={onClose} aria-label="Закрыть" className="flex size-14 items-center justify-center rounded-2xl text-mes-ink-2 hover:bg-mes-panel">
            <X className="size-7" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-7 py-6">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-3 border-t border-mes-line bg-mes-panel px-7 py-5">{footer}</footer>}
      </div>
    </div>
  )
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  tone = "critical",
  icon,
  title,
  message,
  confirmLabel,
  cancelLabel = "Отмена",
  children,
  confirmDisabled,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  tone?: Tone
  icon?: LucideIcon
  title: ReactNode
  message?: ReactNode
  confirmLabel: string
  cancelLabel?: string
  children?: ReactNode
  confirmDisabled?: boolean
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      icon={icon}
      tone={tone}
      width="max-w-2xl"
      footer={
        <>
          <Btn size="lg" onClick={onClose} className="min-w-44">
            {cancelLabel}
          </Btn>
          <Btn size="lg" variant={tone === "critical" ? "dark" : tone === "warning" ? "warning" : "primary"} onClick={onConfirm} disabled={confirmDisabled} className={cn("min-w-60", tone === "critical" && "bg-mes-red shadow-[0_2px_0_#a8301f] hover:bg-mes-red-strong")}>
            {confirmLabel}
          </Btn>
        </>
      }
    >
      {message && <p className="text-[18px] leading-relaxed text-mes-ink-2">{message}</p>}
      {children}
    </Modal>
  )
}

export function EmptyState({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <span className="flex size-16 items-center justify-center rounded-2xl bg-mes-panel ring-1 ring-mes-line">
        <Icon className="size-8 text-mes-ink-3" />
      </span>
      <p className="text-[19px] font-semibold text-mes-ink">{title}</p>
      {text && <p className="max-w-md text-[15px] text-mes-ink-3">{text}</p>}
      {action}
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[30px] font-bold leading-tight tracking-tight text-mes-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-[16px] text-mes-ink-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </div>
  )
}

/** Кнопка-фильтр («чип») для панелей фильтрации — всё ещё 48 px по высоте */
export function Chip({ on, onClick, children, count }: { on: boolean; onClick: () => void; children: ReactNode; count?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-12 items-center gap-2 rounded-xl border px-4 text-[16px] font-semibold transition-colors",
        on ? "border-mes-olive bg-mes-olive-soft text-mes-olive-deep" : "border-mes-line-strong bg-mes-card text-mes-ink-2 hover:bg-mes-panel",
      )}
    >
      {children}
      {count !== undefined && <span className={cn("rounded-md px-1.5 text-[13px] tabular-nums", on ? "bg-mes-olive-strong text-white" : "bg-mes-panel text-mes-ink-3")}>{count}</span>}
    </button>
  )
}
