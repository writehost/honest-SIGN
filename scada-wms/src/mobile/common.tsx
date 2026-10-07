import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link, NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, CloudOff, Delete, History, LayoutGrid, Menu, RefreshCw, Search } from 'lucide-react'
import { useApp, useSession } from '@/app/state'
import { useNet } from '@/lib/net'
import { SignalLayer, isBlocked } from '@/scan/signals'
import { useHidScanner } from '@/scan/useHidScanner'
import { cx, plural } from '@/lib/format'
import { ProductThumb } from '@/ui/kit'
import type { Product } from '@/domain/types'

export function MobileShell() {
  const { session } = useSession()
  const { org } = useApp()
  if (!session || !org) return <Navigate to="/login" replace />
  return (
    <div className="terminal min-h-[100dvh] bg-background mx-auto max-w-[520px] relative">
      <NetBanner />
      <Outlet />
      <SignalLayer />
    </div>
  )
}

export function NetBanner() {
  const net = useNet()
  if (net.online && !net.syncing && !net.lastSynced) return null
  if (!net.online)
    return (
      <div className="sticky top-0 z-30 border-b border-amber-500/35 bg-[color-mix(in_oklch,var(--background)_85%,orange)] px-4 py-2.5 flex items-start gap-2.5 text-[14px] leading-snug text-foreground safe-t" role="status">
        <CloudOff size={18} className="text-amber-700 shrink-0 mt-0.5" />
        <div>
          <b className="font-semibold text-amber-950">Нет связи.</b> Операции временно сохраняются на устройстве.
          {net.queue.length > 0 && <span className="text-muted-foreground"> В очереди: {net.queue.length}</span>}
        </div>
      </div>
    )
  return (
    <div className="sticky top-0 z-30 border-b border-success/30 bg-card text-success px-4 py-2.5 flex items-center gap-2.5 text-[14px] font-medium safe-t" role="status">
      <RefreshCw size={16} className={net.syncing ? 'animate-spin' : ''} />
      {net.syncing ? `Синхронизация: ${net.queue.length} ${plural(net.queue.length, 'операция', 'операции', 'операций')}…` : `Синхронизировано: ${net.lastSynced}`}
    </div>
  )
}

/** Operation header — same as the TSD screens of the main WMS: white bar, outline back button. */
export function OpHeader({ title, step, onBack, right }: { title: string; step?: string; onBack?: () => void; right?: ReactNode }) {
  const nav = useNavigate()
  return (
    <header className="sticky top-0 z-20 bg-card shadow-sm safe-t">
      <div className="flex min-h-[60px] items-center gap-3 px-4 py-2.5">
        <button onClick={onBack ?? (() => nav('/m'))} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-background text-foreground active:bg-accent" aria-label="Назад">
          <ArrowLeft size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[17px] font-semibold leading-tight text-foreground">{title}</div>
          {step && <div className="font-mono text-[12px] text-muted-foreground">шаг {step}</div>}
        </div>
        {right}
      </div>
    </header>
  )
}

export function BottomNav() {
  const item = (to: string, end: boolean, icon: ReactNode, label: string) => (
    <NavLink to={to} end={end} className={({ isActive }) => cx('flex flex-1 flex-col items-center gap-1 rounded-xl py-1 transition-all', isActive ? 'text-foreground' : 'text-muted-foreground')}>
      {({ isActive }) => (
        <>
          <span className={cx('grid h-8 w-8 place-items-center rounded-lg transition-all', isActive && 'bg-primary text-primary-foreground')}>{icon}</span>
          <span className="text-[11px] font-medium leading-tight">{label}</span>
        </>
      )}
    </NavLink>
  )
  return (
    <nav className="fixed bottom-0 inset-x-0 z-20 bg-card shadow-lg border-t border-border/70 safe-b">
      <div className="mx-auto flex max-w-[520px] px-2 pt-1.5">
        {item('/m', true, <LayoutGrid size={18} />, 'Сегодня')}
        {item('/m/search', false, <Search size={18} />, 'Поиск')}
        {item('/m/journal', false, <History size={18} />, 'Журнал')}
        {item('/m/more', false, <Menu size={18} />, 'Ещё')}
      </div>
    </nav>
  )
}

export function ProductLine({ product, right, sub, size = 56 }: { product: Product; right?: ReactNode; sub?: ReactNode; size?: number }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <ProductThumb product={product} size={size} />
      <div className="min-w-0 flex-1">
        <div className="text-[16px] font-semibold leading-tight">{product.name}</div>
        <div className="text-[13px] text-muted-foreground font-mono mt-0.5 truncate">{sub ?? product.sku}</div>
      </div>
      {right}
    </div>
  )
}

/** Big quantity entry — never opens the phone keyboard. */
export function Numpad({ value, onChange, max, unit = 'шт' }: { value: number; onChange: (n: number) => void; max?: number; unit?: string }) {
  const [fresh, setFresh] = useState(true)
  const set = (n: number) => onChange(Math.max(0, max !== undefined ? Math.min(n, max) : n))
  const digit = (d: number) => {
    const next = fresh ? d : Number(`${value}${d}`)
    setFresh(false)
    if (next <= 99999) set(next)
  }
  const k = 'h-14 rounded-xl bg-card border border-border/70 shadow-xs text-2xl font-medium text-foreground active:bg-accent'
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <button onClick={() => { setFresh(false); set(value - 1) }} className="h-16 w-16 rounded-xl border border-border bg-secondary text-3xl font-medium active:bg-accent" aria-label="Меньше">−</button>
        <div className="flex-1 h-16 rounded-xl bg-card border border-primary ring-[3px] ring-primary/20 grid place-items-center">
          <span className="text-[40px] leading-none font-semibold tnum" data-testid="qty">{value}<span className="text-lg text-muted-foreground/80 font-normal ml-1.5">{unit}</span></span>
        </div>
        <button onClick={() => { setFresh(false); set(value + 1) }} className="h-16 w-16 rounded-xl border border-border bg-secondary text-3xl font-medium active:bg-accent" aria-label="Больше">+</button>
      </div>
      {max !== undefined && <div className="text-[13px] text-muted-foreground/80 mb-2 text-center">Максимум: {max} {unit}</div>}
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => <button key={d} className={k} onClick={() => digit(d)}>{d}</button>)}
        <button className={cx(k, 'text-base text-muted-foreground')} onClick={() => { setFresh(true); set(0) }}>C</button>
        <button className={k} onClick={() => digit(0)}>0</button>
        <button className={cx(k, 'grid place-items-center text-muted-foreground')} onClick={() => { setFresh(false); set(Math.floor(value / 10)) }} aria-label="Стереть"><Delete size={22} /></button>
      </div>
    </div>
  )
}

export function StickyAction({ children }: { children: ReactNode }) {
  return (
    <div className="fixed bottom-0 inset-x-0 z-20 bg-card shadow-lg border-t border-border/70 safe-b">
      <div className="mx-auto max-w-[520px] px-4 pt-3 grid gap-2">{children}</div>
    </div>
  )
}

export function BigButton({ children, onClick, variant = 'primary', disabled, testId }: { children: ReactNode; onClick?: () => void; variant?: 'primary' | 'ok' | 'secondary' | 'signal'; disabled?: boolean; testId?: string }) {
  const v = {
    primary: 'bg-primary text-primary-foreground shadow-sm',
    ok: 'bg-primary text-primary-foreground shadow-sm',
    secondary: 'bg-card border border-border text-foreground shadow-xs',
    signal: 'bg-primary text-primary-foreground shadow-sm',
  }[variant]
  return (
    <button data-testid={testId} disabled={disabled} onClick={onClick} className={cx('h-14 w-full rounded-xl text-base font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50', v)}>
      {children}
    </button>
  )
}

export function Section({ title, children, right }: { title: ReactNode; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="mt-5">
      <div className="flex items-center justify-between px-1 mb-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  )
}

export const CardLink = ({ to, children, className }: { to: string; children: ReactNode; className?: string }) => (
  <Link to={to} className={cx('block wms-panel/70 shadow-sm px-4 py-3 active:bg-accent/30', className)}>{children}</Link>
)

/** Keeps the HID scanner live on screens without a ScanPad. */
export function HiddenScan({ onScan }: { onScan: (c: string) => void }) {
  useHidScanner((c) => { if (!isBlocked()) onScan(c) })
  return null
}

/** End of an operation: calm page, the result in the status column, actions at the bottom. */
export function DoneScreen({ title, text, primary, secondary }: {
  title: ReactNode
  text: ReactNode
  primary?: { label: string; onClick: () => void; testId?: string }
  secondary: { label: string; onClick: () => void }
}) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <div className="h-1 bg-primary" />
      <div className="flex-1 px-4 pt-[max(24px,env(safe-area-inset-top))]">
        <div className="wms-panel">
          <div className="flex items-start gap-3 px-4 py-5">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><Check size={26} strokeWidth={2.6} /></div>
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-wide text-success">Готово</div>
              <h1 className="mt-0.5 text-[24px] font-bold leading-tight tracking-tight">{title}</h1>
              <p className="mt-2 text-[15px] leading-snug text-muted-foreground">{text}</p>
            </div>
          </div>
        </div>
      </div>
      <div className="grid gap-2 border-t border-border/70 bg-card px-4 pt-3 shadow-lg safe-b">
        {primary && <BigButton testId={primary.testId} onClick={primary.onClick}>{primary.label}</BigButton>}
        <BigButton variant="secondary" onClick={secondary.onClick}>{secondary.label}</BigButton>
      </div>
    </div>
  )
}
