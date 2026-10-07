import { Link, useNavigate } from 'react-router-dom'
import { ArrowDownToLine, ArrowLeftRight, ChevronRight, ClipboardCheck, PackageCheck, ScanLine, ShoppingBasket } from 'lucide-react'
import type { ReactNode } from 'react'
import { useApp } from '@/app/state'
import { BottomNav } from './common'
import { useHidScanner } from '@/scan/useHidScanner'
import { plural, cx } from '@/lib/format'

export function MobileHome() {
  const { s, user, warehouse } = useApp()
  const nav = useNavigate()
  useHidScanner((code) => nav(`/m/search?q=${encodeURIComponent(code)}`))

  const toPick = s.orders.filter((o) => o.status === 'to_pick').length
  const mine = s.orders.find((o) => o.status === 'picking' && o.pickerId === user.id)
  const toPack = s.orders.filter((o) => o.status === 'picked').length
  const receipts = s.receipts.filter((r) => r.status !== 'done').length
  const today = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="pb-24">
      <header className="px-4 pt-[max(16px,env(safe-area-inset-top))] pb-3">
        <div className="flex items-center gap-3">
          <Link to="/m/more" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-foreground text-background text-[15px] font-semibold" aria-label="Профиль">
            {user.name.slice(0, 1)}
          </Link>
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-bold text-foreground">{user.name}</div>
            <div className="truncate text-xs text-muted-foreground">{warehouse?.name ?? 'Склад'}</div>
          </div>
        </div>
        <div className="mt-4 flex items-baseline justify-between gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Сегодня</h1>
          <span className="text-[13px] text-muted-foreground first-letter:uppercase">{today}</span>
        </div>
      </header>

      <div className="px-4">
        <Link to="/m/search" className="flex h-12 items-center gap-3 rounded-xl border border-input bg-card px-3.5 text-[15px] text-muted-foreground shadow-xs">
          <ScanLine size={20} className="text-foreground" />
          Сканируйте или найдите товар
        </Link>

        <h2 className="mt-5 mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Операции</h2>
        <nav className="wms-panel divide-y divide-border/70">
          <OpRow
            to="/m/pick"
            main
            icon={<ShoppingBasket size={22} />}
            title="Сборка"
            note={mine ? `Продолжить заказ №${mine.number}` : toPick ? `${toPick} ${plural(toPick, 'заказ', 'заказа', 'заказов')} к сборке` : 'Нет заказов к сборке'}
            count={toPick}
          />
          <OpRow to="/m/pack" icon={<PackageCheck size={22} />} title="Упаковка" note={toPack ? `${toPack} ${plural(toPack, 'заказ ждёт', 'заказа ждут', 'заказов ждут')} проверки` : 'Нечего упаковывать'} count={toPack} />
          <OpRow to="/m/receive" icon={<ArrowDownToLine size={22} />} title="Приёмка" note={receipts ? `${receipts} ${plural(receipts, 'поставка ожидается', 'поставки ожидаются', 'поставок ожидается')}` : 'Принять товар на склад'} count={receipts} />
          <OpRow to="/m/move" icon={<ArrowLeftRight size={22} />} title="Перемещение" note="Из ячейки в ячейку" />
          <OpRow to="/m/inventory" icon={<ClipboardCheck size={22} />} title="Инвентаризация" note="Пересчитать ячейку" />
        </nav>
      </div>
      <BottomNav />
    </div>
  )
}

function OpRow({ to, icon, title, note, count, main }: { to: string; icon: ReactNode; title: string; note: string; count?: number; main?: boolean }) {
  return (
    <Link to={to} className="flex min-h-[76px] items-center gap-3.5 px-4 py-3 transition-colors active:bg-accent/25">
      <div className={cx('grid h-11 w-11 shrink-0 place-items-center rounded-xl', main ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground')}>{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-[17px] font-semibold leading-tight text-foreground">{title}</div>
        <div className="mt-0.5 truncate text-[14px] text-muted-foreground">{note}</div>
      </div>
      {count ? (
        <span className={cx('grid h-7 min-w-7 place-items-center rounded-md px-2 text-[14px] font-semibold tnum', main ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground')}>{count}</span>
      ) : null}
      <ChevronRight size={18} className="shrink-0 text-muted-foreground" />
    </Link>
  )
}
