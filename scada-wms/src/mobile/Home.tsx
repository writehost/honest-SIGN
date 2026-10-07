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
      <header className="px-5 pt-[max(18px,env(safe-area-inset-top))] pb-4 bg-paper">
        <div className="flex items-center justify-between">
          <div className="text-[13px] text-ink-2 truncate">{warehouse?.name ?? 'Склад'}</div>
          <Link to="/m/more" className="h-9 w-9 rounded-full bg-night text-white grid place-items-center text-sm font-semibold" aria-label="Профиль">
            {user.name.slice(0, 1)}
          </Link>
        </div>
        <h1 className="mt-3 text-[30px] font-bold tracking-tight leading-none">Сегодня</h1>
        <div className="mt-1.5 text-[15px] text-ink-2 first-letter:uppercase">{today}</div>
      </header>

      <div className="px-4">
        <Link to="/m/search" className="flex items-center gap-3 h-14 px-4 rounded-xl bg-surface border border-line-2 text-ink-3 text-[16px]">
          <ScanLine size={22} className="text-ink" />
          Сканируйте или найдите товар
        </Link>

        <div className="mt-5 grid gap-2.5">
          <OpRow
            to="/m/pick"
            dark
            icon={<ShoppingBasket size={26} />}
            title="Сборка"
            note={mine ? `Продолжить заказ №${mine.number}` : toPick ? `${toPick} ${plural(toPick, 'заказ', 'заказа', 'заказов')} к сборке` : 'Нет заказов к сборке'}
            count={toPick}
          />
          <OpRow to="/m/pack" icon={<PackageCheck size={26} />} title="Упаковка" note={toPack ? `${toPack} ${plural(toPack, 'заказ ждёт', 'заказа ждут', 'заказов ждут')} проверки` : 'Нечего упаковывать'} count={toPack} />
          <OpRow to="/m/receive" icon={<ArrowDownToLine size={26} />} title="Приёмка" note={receipts ? `${receipts} ${plural(receipts, 'поставка ожидается', 'поставки ожидаются', 'поставок ожидается')}` : 'Принять товар на склад'} count={receipts} />
          <OpRow to="/m/move" icon={<ArrowLeftRight size={26} />} title="Перемещение" note="Из ячейки в ячейку" />
          <OpRow to="/m/inventory" icon={<ClipboardCheck size={26} />} title="Инвентаризация" note="Пересчитать ячейку" />
        </div>
      </div>
      <BottomNav />
    </div>
  )
}

function OpRow({ to, icon, title, note, count, dark }: { to: string; icon: ReactNode; title: string; note: string; count?: number; dark?: boolean }) {
  return (
    <Link
      to={to}
      className={cx(
        'flex items-center gap-4 rounded-2xl px-4 h-[84px] active:translate-y-px',
        dark ? 'bg-night text-white' : 'bg-surface border border-line',
      )}
    >
      <div className={cx('h-12 w-12 rounded-xl grid place-items-center shrink-0', dark ? 'bg-signal text-signal-ink' : 'bg-sunken text-ink')}>{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-[20px] font-semibold leading-tight">{title}</div>
        <div className={cx('text-[14px] truncate mt-0.5', dark ? 'text-white/70' : 'text-ink-2')}>{note}</div>
      </div>
      {count ? (
        <span className={cx('min-w-9 h-9 px-2.5 rounded-full grid place-items-center text-[17px] font-semibold tnum', dark ? 'bg-white text-ink' : 'bg-ink text-white')}>{count}</span>
      ) : (
        <ChevronRight size={22} className={dark ? 'text-white/50' : 'text-ink-3'} />
      )}
    </Link>
  )
}
