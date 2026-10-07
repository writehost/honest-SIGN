import { useEffect, useSyncExternalStore } from 'react'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
import { Box, Cable, CheckCircle2, Droplets, Dumbbell, House, Package, Shirt, X, XCircle, AlertTriangle } from 'lucide-react'
import { cx } from '@/lib/format'
import type { OrderStatus, Product } from '@/domain/types'
import { STATUS_LABEL } from '@/domain/services'

// ─── Button ───
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'signal' | 'ok'
type BtnSize = 'sm' | 'md' | 'lg' | 'xl'
const V: Record<BtnVariant, string> = {
  primary: 'bg-ink text-white hover:bg-night-2 disabled:bg-ink-3',
  secondary: 'bg-surface text-ink border border-line-2 hover:border-ink-3 disabled:text-ink-3',
  ghost: 'text-ink-2 hover:bg-sunken hover:text-ink disabled:text-ink-3',
  danger: 'bg-err text-white hover:brightness-95',
  signal: 'bg-signal text-signal-ink hover:brightness-95',
  ok: 'bg-ok text-white hover:brightness-95',
}
const Z: Record<BtnSize, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-md',
  md: 'h-9 px-3.5 text-sm gap-2 rounded-md',
  lg: 'h-12 px-5 text-base gap-2 rounded-lg font-semibold',
  xl: 'h-16 px-6 text-lg gap-3 rounded-xl font-semibold',
}
export function Button({
  variant = 'secondary', size = 'md', className, children, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: BtnSize }) {
  return (
    <button
      {...rest}
      className={cx('inline-flex items-center justify-center font-medium transition-colors select-none whitespace-nowrap active:translate-y-px', V[variant], Z[size], className)}
    >
      {children}
    </button>
  )
}

// ─── Location label — signal-yellow, like the physical rack sticker ───
export function CellTag({ code, size = 'md', muted, className }: { code: string; size?: 'sm' | 'md' | 'lg' | 'xl'; muted?: boolean; className?: string }) {
  const sz = {
    sm: 'text-[12px] px-1.5 py-px rounded-[3px]',
    md: 'text-[13px] px-2 py-0.5 rounded-sm',
    lg: 'text-2xl px-3 py-1 rounded-md',
    xl: 'text-[56px] leading-none px-4 py-3 rounded-lg tracking-tight',
  }[size]
  return (
    <span className={cx('inline-block font-mono font-semibold tnum whitespace-nowrap', muted ? 'bg-sunken text-ink-2' : 'bg-signal text-signal-ink', sz, className)}>
      {code}
    </span>
  )
}

export function BoxTag({ code, className }: { code: string; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1 font-mono font-semibold text-[13px] px-2 py-0.5 rounded-sm bg-night text-white', className)}>
      <Box size={13} strokeWidth={2.2} />
      {code}
    </span>
  )
}

// ─── Product image or a quiet colour tile ───
const CAT_ICON: Record<string, typeof Shirt> = { Одежда: Shirt, Косметика: Droplets, Спорт: Dumbbell, Дом: House, Аксессуары: Cable }
function isDark(hex?: string) {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return false
  const n = parseInt(hex.slice(1), 16)
  const l = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)
  return l < 140
}
export function ProductThumb({ product, size = 40, className }: { product?: Product; size?: number; className?: string }) {
  if (product?.photo)
    return <img src={product.photo} alt="" width={size} height={size} className={cx('object-cover rounded-md bg-sunken shrink-0', className)} style={{ width: size, height: size }} />
  const Icon = (product && CAT_ICON[product.category]) || Package
  const bg = product?.swatch ?? '#e4e2dc'
  return (
    <div className={cx('rounded-md shrink-0 grid place-items-center border border-black/5', className)} style={{ width: size, height: size, background: bg }}>
      <Icon size={size * 0.46} strokeWidth={1.5} color={isDark(bg) ? 'rgba(255,255,255,.85)' : 'rgba(0,0,0,.55)'} />
    </div>
  )
}

// ─── Status ───
const ST: Record<OrderStatus, string> = {
  new: 'bg-sunken text-ink-2',
  to_pick: 'bg-info-bg text-info',
  picking: 'bg-warn-bg text-warn',
  picked: 'bg-[#efe9fb] text-[#6236b8]',
  packed: 'bg-ok-bg text-ok',
  shipped: 'bg-transparent text-ink-3 border border-line',
}
export function StatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  return <span className={cx('inline-flex items-center h-[22px] px-2 rounded text-[12px] font-medium whitespace-nowrap', ST[status], className)}>{STATUS_LABEL[status]}</span>
}

export function Pill({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'ok' | 'err' | 'warn' | 'info'; className?: string }) {
  const t = { neutral: 'bg-sunken text-ink-2', ok: 'bg-ok-bg text-ok', err: 'bg-err-bg text-err', warn: 'bg-warn-bg text-warn', info: 'bg-info-bg text-info' }[tone]
  return <span className={cx('inline-flex items-center gap-1 h-[22px] px-2 rounded text-[12px] font-medium whitespace-nowrap', t, className)}>{children}</span>
}

// ─── Form controls ───
export function Field({ label, hint, error, children, className }: { label: string; hint?: ReactNode; error?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="block text-[12px] font-medium text-ink-2 mb-1">{label}</span>
      {children}
      {error ? <span className="block text-[12px] text-err mt-1">{error}</span> : hint ? <span className="block text-[12px] text-ink-3 mt-1">{hint}</span> : null}
    </label>
  )
}
export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={cx('w-full h-9 px-3 rounded-md bg-surface border border-line-2 text-sm placeholder:text-ink-3 focus:outline-none focus:border-ink focus:ring-2 focus:ring-ink/10', className)} />
}
export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={cx('w-full h-9 px-2.5 rounded-md bg-surface border border-line-2 text-sm focus:outline-none focus:border-ink', className)}>
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
      <div className="absolute inset-0 bg-night/25" onClick={onClose} />
      <aside className="relative h-full bg-surface shadow-2xl flex flex-col rise" style={{ width: `min(${width}px, 100vw)` }}>
        <header className="h-14 shrink-0 px-5 flex items-center justify-between border-b border-line">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-sunken text-ink-2" aria-label="Закрыть"><X size={18} /></button>
        </header>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <footer className="shrink-0 px-5 py-3 border-t border-line flex justify-end gap-2">{footer}</footer>}
      </aside>
    </div>
  )
}

export function Modal({ open, onClose, title, children, footer, width = 460 }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; width?: number }) {
  useEsc(open, onClose)
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-night/30" onClick={onClose} />
      <div className="relative bg-surface rounded-xl shadow-2xl w-full rise" style={{ maxWidth: width }}>
        <header className="px-5 pt-4 pb-2 flex items-center justify-between">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-sunken text-ink-2" aria-label="Закрыть"><X size={18} /></button>
        </header>
        <div className="px-5 pb-4">{children}</div>
        {footer && <footer className="px-5 py-3 border-t border-line flex justify-end gap-2">{footer}</footer>}
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
        <div key={t.id} className="rise pointer-events-auto bg-night text-white text-sm rounded-lg px-4 py-3 shadow-xl flex items-start gap-2.5 w-full">
          {t.tone === 'ok' ? <CheckCircle2 size={18} className="text-[#5fd394] shrink-0 mt-px" /> : t.tone === 'err' ? <XCircle size={18} className="text-[#ff7b70] shrink-0 mt-px" /> : <AlertTriangle size={18} className="text-signal shrink-0 mt-px" />}
          <span className="leading-snug">{t.text}</span>
        </div>
      ))}
    </div>
  )
}

export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: ReactNode; action?: ReactNode }) {
  return (
    <div className="py-16 px-6 text-center flex flex-col items-center">
      {icon && <div className="text-ink-3 mb-3">{icon}</div>}
      <div className="font-semibold">{title}</div>
      {text && <div className="text-sm text-ink-2 mt-1 max-w-sm">{text}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="font-mono text-[11px] px-1.5 py-px rounded border border-line-2 bg-surface text-ink-2">{children}</kbd>
}

export function Logo({ className, inverted }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cx('inline-flex items-center gap-2 font-semibold tracking-tight', className)}>
      <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="7" fill={inverted ? '#ffd23f' : '#16181b'} />
        <path d="M8 9h4M8 9v4M24 9h-4M24 9v4M8 23h4M8 23v-4M24 23h-4M24 23v-4" stroke={inverted ? '#16181b' : '#ffd23f'} strokeWidth="2.4" strokeLinecap="round" />
        <rect x="13" y="13" width="6" height="6" rx="1" fill={inverted ? '#16181b' : '#ffffff'} />
      </svg>
      <span>SCADA <span className="font-normal opacity-60">Mini WMS</span></span>
    </span>
  )
}
