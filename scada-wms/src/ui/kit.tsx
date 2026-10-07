import { useEffect, useSyncExternalStore } from 'react'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
import { Box, Cable, CheckCircle2, Droplets, Dumbbell, House, Package, Shirt, X, XCircle, AlertTriangle } from 'lucide-react'
import { cx } from '@/lib/format'
import type { OrderStatus, Product } from '@/domain/types'
import { STATUS_LABEL } from '@/domain/services'

// ─── Button — same variants as scada_system components/ui/button.tsx ───
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'signal' | 'ok'
type BtnSize = 'sm' | 'md' | 'lg' | 'xl'
const PRIMARY = 'bg-primary text-primary-foreground hover:bg-primary/90'
const V: Record<BtnVariant, string> = {
  primary: PRIMARY,
  signal: PRIMARY,
  ok: PRIMARY,
  secondary: 'border border-border bg-background text-foreground shadow-xs hover:bg-accent hover:text-accent-foreground',
  ghost: 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
  danger: 'border border-destructive/30 bg-card text-destructive hover:bg-destructive/5',
}
const Z: Record<BtnSize, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-md',
  md: 'h-9 px-4 text-sm gap-2 rounded-md',
  lg: 'h-10 px-6 text-sm gap-2 rounded-md',
  xl: 'h-14 px-6 text-base gap-2 rounded-xl font-semibold',
}
export function Button({
  variant = 'secondary', size = 'md', className, children, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: BtnSize }) {
  return (
    <button
      {...rest}
      className={cx(
        'inline-flex items-center justify-center font-medium whitespace-nowrap select-none transition-all outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0',
        V[variant], Z[size], className,
      )}
    >
      {children}
    </button>
  )
}

// ─── Location code. Mono like location codes in the main WMS; the lime edge marks it as an address ───
export function CellTag({ code, size = 'md', muted, className }: { code: string; size?: 'sm' | 'md' | 'lg' | 'xl'; muted?: boolean; className?: string }) {
  const sz = {
    sm: 'text-[12px] pl-2 pr-1.5 py-px rounded-[6px] shadow-[inset_2px_0_0_var(--primary)]',
    md: 'text-[13px] pl-2.5 pr-2 py-0.5 rounded-[6px] shadow-[inset_3px_0_0_var(--primary)]',
    lg: 'text-[22px] pl-3.5 pr-3 py-1 rounded-[8px] shadow-[inset_4px_0_0_var(--primary)]',
    xl: 'text-[48px] leading-none pl-5 pr-4 py-2.5 rounded-[10px] tracking-tight shadow-[inset_6px_0_0_var(--primary)]',
  }[size]
  return (
    <span data-cell={code} className={cx('inline-block font-mono font-semibold tnum whitespace-nowrap border border-border bg-secondary', muted ? 'text-muted-foreground shadow-none' : 'text-foreground', sz, className)}>
      {code}
    </span>
  )
}

export function BoxTag({ code, className }: { code: string; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1 font-mono font-semibold text-[12px] px-2 py-0.5 rounded-[6px] bg-foreground text-background', className)}>
      <Box size={12} strokeWidth={2.2} />
      {code}
    </span>
  )
}

// ─── Product photo, or a neutral placeholder (no per-product colours) ───
const CAT_ICON: Record<string, typeof Shirt> = { Одежда: Shirt, Косметика: Droplets, Спорт: Dumbbell, Дом: House, Аксессуары: Cable }
export function ProductThumb({ product, size = 40, className }: { product?: Product; size?: number; className?: string }) {
  if (product?.photo)
    return <img src={product.photo} alt="" width={size} height={size} className={cx('object-cover rounded-md bg-muted shrink-0', className)} style={{ width: size, height: size }} />
  const Icon = (product && CAT_ICON[product.category]) || Package
  return (
    <div className={cx('rounded-md shrink-0 grid place-items-center bg-secondary border border-border/70 text-muted-foreground', className)} style={{ width: size, height: size }}>
      <Icon size={Math.round(size * 0.44)} strokeWidth={1.6} />
    </div>
  )
}

// ─── Status — the .wms-ag-status chip of the main WMS + a state dot ───
const DOT: Record<OrderStatus, string> = {
  new: 'bg-muted-foreground/40',
  to_pick: 'bg-foreground',
  picking: 'bg-amber-500',
  picked: 'bg-primary',
  packed: 'bg-success',
  shipped: 'bg-transparent border border-muted-foreground/60',
}
export function StatusDot({ status }: { status: OrderStatus }) {
  return <span className={cx('h-1.5 w-1.5 shrink-0 rounded-full', DOT[status])} />
}
export function StatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  return (
    <span className={cx('wms-ag-status gap-1.5 whitespace-nowrap py-1 text-[12px]', status === 'shipped' && 'text-muted-foreground', className)}>
      <span className={cx('h-1.5 w-1.5 rounded-full', DOT[status])} />
      {STATUS_LABEL[status]}
    </span>
  )
}

export function Pill({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'ok' | 'err' | 'warn' | 'info'; className?: string }) {
  const t = {
    neutral: 'border-border/70 bg-background text-muted-foreground',
    info: 'border-border/70 bg-background text-foreground',
    ok: 'border-success/30 bg-success/10 text-success',
    err: 'border-destructive/20 bg-destructive/5 text-destructive',
    warn: 'border-amber-500/40 bg-amber-500/10 text-amber-900',
  }[tone]
  return <span className={cx('inline-flex items-center gap-1 rounded-md border px-1.5 py-1 text-[12px] font-medium leading-none whitespace-nowrap', t, className)}>{children}</span>
}

// ─── Form controls — scada_system components/ui/input.tsx ───
export function Field({ label, hint, error, children, className }: { label: string; hint?: ReactNode; error?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="block text-[13px] font-medium text-foreground mb-1.5">{label}</span>
      {children}
      {error ? <span className="block text-[12px] text-destructive mt-1">{error}</span> : hint ? <span className="block text-[12px] text-muted-foreground mt-1">{hint}</span> : null}
    </label>
  )
}
const FIELD = 'w-full min-w-0 h-9 rounded-md border border-input bg-card px-3 text-base md:text-sm shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:opacity-50'
export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={cx(FIELD, className)} />
}
export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={cx(FIELD, 'px-2.5', className)}>
      {children}
    </select>
  )
}

// ─── Overlays ───
export function Drawer({ open, onClose, title, children, footer, width = 520 }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; width?: number }) {
  useEsc(open, onClose)
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-foreground/20" onClick={onClose} />
      <aside className="relative h-full bg-card border-l border-border shadow-xl flex flex-col rise" style={{ width: `min(${width}px, 100vw)` }}>
        <header className="h-14 shrink-0 px-5 flex items-center justify-between border-b border-border">
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-muted text-muted-foreground" aria-label="Закрыть"><X size={18} /></button>
        </header>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <footer className="shrink-0 px-5 py-3 border-t border-border flex justify-end gap-2">{footer}</footer>}
      </aside>
    </div>
  )
}

export function Modal({ open, onClose, title, children, footer, width = 460 }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; width?: number }) {
  useEsc(open, onClose)
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-foreground/30" onClick={onClose} />
      <div className="relative bg-card border border-border/70 rounded-xl shadow-xl w-full rise" style={{ maxWidth: width }}>
        <header className="px-5 pt-4 pb-2 flex items-center justify-between">
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-muted text-muted-foreground" aria-label="Закрыть"><X size={18} /></button>
        </header>
        <div className="px-5 pb-4">{children}</div>
        {footer && <footer className="px-5 py-3 border-t border-border flex justify-end gap-2">{footer}</footer>}
      </div>
    </div>
  )
}

function useEsc(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
}

// ─── Toasts ───
type Toast = { id: number; text: string; tone: 'ok' | 'err' | 'warn' | 'info' }
let toasts: Toast[] = []
const tl = new Set<() => void>()
export function toast(text: string, tone: Toast['tone'] = 'ok') {
  const id = Date.now() + Math.random()
  toasts = [...toasts, { id, text, tone }]
  tl.forEach((l) => l())
  setTimeout(() => { toasts = toasts.filter((t) => t.id !== id); tl.forEach((l) => l()) }, 3200)
}
export function Toaster() {
  const list = useSyncExternalStore((l) => { tl.add(l); return () => tl.delete(l) }, () => toasts)
  return (
    <div className="fixed z-[60] bottom-4 left-1/2 -translate-x-1/2 flex flex-col gap-2 items-center pointer-events-none w-[min(92vw,440px)]">
      {list.map((t) => (
        <div key={t.id} className={cx('rise pointer-events-auto bg-card text-foreground text-sm rounded-md border border-border px-4 py-3 shadow-lg flex items-start gap-2.5 w-full border-l-4', t.tone === 'ok' ? 'border-l-primary' : t.tone === 'err' ? 'border-l-destructive' : 'border-l-amber-500')}>
          {t.tone === 'ok' ? <CheckCircle2 size={18} className="text-success shrink-0 mt-px" /> : t.tone === 'err' ? <XCircle size={18} className="text-destructive shrink-0 mt-px" /> : <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-px" />}
          <span className="leading-snug">{t.text}</span>
        </div>
      ))}
    </div>
  )
}

export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: ReactNode; action?: ReactNode }) {
  return (
    <div className="py-16 px-6 text-center flex flex-col items-center">
      {icon && <div className="text-muted-foreground/80 mb-3">{icon}</div>}
      <div className="font-semibold">{title}</div>
      {text && <div className="text-sm text-muted-foreground mt-1 max-w-sm">{text}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="font-mono text-[11px] px-1.5 py-px rounded border border-border bg-card text-muted-foreground">{children}</kbd>
}

/** Brand block exactly as in the main WMS sidebar: logo + "SCADA SYSTEM" / module name. */
export function Logo({ className, sub = 'Mini WMS', size = 32 }: { className?: string; sub?: string; size?: number }) {
  return (
    <span className={cx('inline-flex min-w-0 items-center gap-2.5', className)}>
      <img src="/logo-64.png" alt="" width={size} height={size} className="rounded-md object-contain shrink-0" style={{ width: size, height: size }} />
      <span className="min-w-0 text-left">
        <span className="block text-[13px] font-semibold leading-tight text-foreground">SCADA SYSTEM</span>
        <span className="block text-[11px] text-muted-foreground">{sub}</span>
      </span>
    </span>
  )
}
