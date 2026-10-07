import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link, NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom'
import { ArrowLeft, CloudOff, Delete, History, LayoutGrid, Menu, RefreshCw, Search } from 'lucide-react'
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
    <div className="terminal min-h-[100dvh] bg-paper mx-auto max-w-[520px] relative">
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
      <div className="sticky top-0 z-30 bg-night text-white px-4 py-2.5 flex items-start gap-2.5 text-[14px] leading-snug safe-t" role="status">
        <CloudOff size={18} className="text-signal shrink-0 mt-0.5" />
        <div>
          <b className="font-semibold">Нет связи.</b> Операции временно сохраняются на устройстве.
          {net.queue.length > 0 && <span className="text-white/70"> В очереди: {net.queue.length}</span>}
        </div>
      </div>
    )
  return (
    <div className="sticky top-0 z-30 bg-ok text-white px-4 py-2.5 flex items-center gap-2.5 text-[14px] safe-t" role="status">
      <RefreshCw size={16} className={net.syncing ? 'animate-spin' : ''} />
      {net.syncing ? `Синхронизация: ${net.queue.length} ${plural(net.queue.length, 'операция', 'операции', 'операций')}…` : `Синхронизировано: ${net.lastSynced}`}
    </div>
  )
}

/** Dark operation header — the "terminal" look. */
export function OpHeader({ title, step, onBack, right }: { title: string; step?: string; onBack?: () => void; right?: ReactNode }) {
  const nav = useNavigate()
  return (
    <header className="sticky top-0 z-20 bg-night text-white safe-t">
      <div className="h-14 flex items-center gap-1 px-1.5">
        <button onClick={onBack ?? (() => nav('/m'))} className="h-11 w-11 grid place-items-center rounded-lg active:bg-white/10" aria-label="Назад">
          <ArrowLeft size={22} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-[17px] font-semibold truncate">{title}</div>
        </div>
        {step && <div className="font-mono text-[13px] text-white/60 px-2">{step}</div>}
        {right}
      </div>
    </header>
  )
}

export function BottomNav() {
  const item = 'flex-1 flex flex-col items-center justify-center gap-0.5 h-14 text-[11px] font-medium'
  const cls = ({ isActive }: { isActive: boolean }) => cx(item, isActive ? 'text-ink' : 'text-ink-3')
  return (
    <nav className="fixed bottom-0 inset-x-0 z-20 bg-surface/95 backdrop-blur border-t border-line safe-b">
      <div className="mx-auto max-w-[520px] flex">
        <NavLink to="/m" end className={cls}><LayoutGrid size={22} />Сегодня</NavLink>
        <NavLink to="/m/search" className={cls}><Search size={22} />Поиск</NavLink>
        <NavLink to="/m/journal" className={cls}><History size={22} />Журнал</NavLink>
        <NavLink to="/m/more" className={cls}><Menu size={22} />Ещё</NavLink>
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
        <div className="text-[13px] text-ink-2 font-mono mt-0.5 truncate">{sub ?? product.sku}</div>
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
  const k = 'h-14 rounded-xl bg-surface border border-line text-2xl font-medium active:bg-sunken'
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <button onClick={() => { setFresh(false); set(value - 1) }} className="h-16 w-16 rounded-xl bg-sunken text-3xl font-medium active:bg-line" aria-label="Меньше">−</button>
        <div className="flex-1 h-16 rounded-xl bg-surface border-2 border-ink grid place-items-center">
          <span className="text-[40px] leading-none font-semibold tnum" data-testid="qty">{value}<span className="text-lg text-ink-3 font-normal ml-1.5">{unit}</span></span>
        </div>
        <button onClick={() => { setFresh(false); set(value + 1) }} className="h-16 w-16 rounded-xl bg-sunken text-3xl font-medium active:bg-line" aria-label="Больше">+</button>
      </div>
      {max !== undefined && <div className="text-[13px] text-ink-3 mb-2 text-center">Максимум: {max} {unit}</div>}
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => <button key={d} className={k} onClick={() => digit(d)}>{d}</button>)}
        <button className={cx(k, 'text-base text-ink-2')} onClick={() => { setFresh(true); set(0) }}>C</button>
        <button className={k} onClick={() => digit(0)}>0</button>
        <button className={cx(k, 'grid place-items-center text-ink-2')} onClick={() => { setFresh(false); set(Math.floor(value / 10)) }} aria-label="Стереть"><Delete size={22} /></button>
      </div>
    </div>
  )
}

export function StickyAction({ children }: { children: ReactNode }) {
  return (
    <div className="fixed bottom-0 inset-x-0 z-20 bg-paper/95 backdrop-blur border-t border-line safe-b">
      <div className="mx-auto max-w-[520px] px-4 pt-3 grid gap-2">{children}</div>
    </div>
  )
}

export function BigButton({ children, onClick, variant = 'primary', disabled, testId }: { children: ReactNode; onClick?: () => void; variant?: 'primary' | 'ok' | 'secondary' | 'signal'; disabled?: boolean; testId?: string }) {
  const v = {
    primary: 'bg-ink text-white disabled:bg-ink-3',
    ok: 'bg-ok text-white disabled:bg-[#9cc9b0]',
    secondary: 'bg-surface border border-line-2 text-ink',
    signal: 'bg-signal text-signal-ink',
  }[variant]
  return (
    <button data-testid={testId} disabled={disabled} onClick={onClick} className={cx('h-16 w-full rounded-xl text-lg font-semibold flex items-center justify-center gap-2 active:translate-y-px', v)}>
      {children}
    </button>
  )
}

export function Section({ title, children, right }: { title: ReactNode; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="mt-6">
      <div className="flex items-center justify-between px-1 mb-2">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-3">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  )
}

export const CardLink = ({ to, children, className }: { to: string; children: ReactNode; className?: string }) => (
  <Link to={to} className={cx('block bg-surface rounded-xl border border-line px-4 py-3 active:bg-sunken', className)}>{children}</Link>
)

/** Keeps the HID scanner live on screens without a ScanPad. */
export function HiddenScan({ onScan }: { onScan: (c: string) => void }) {
  useHidScanner((c) => { if (!isBlocked()) onScan(c) })
  return null
}
