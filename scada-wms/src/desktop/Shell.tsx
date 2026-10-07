import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  ArrowDownToLine, Boxes, CloudOff, FileUp, Grid3x3, History, LayoutDashboard, LogOut, Package, Search, Settings as Cog, ShoppingCart, Smartphone, Users as UsersIcon,
} from 'lucide-react'
import { useApp, useSession } from '@/app/state'
import * as S from '@/domain/services'
import { useHidScanner } from '@/scan/useHidScanner'
import { useNet } from '@/lib/net'
import { searchAll } from '@/mobile/Search'
import { CellTag, Kbd, Logo, ProductThumb, StatusBadge } from '@/ui/kit'
import { cx } from '@/lib/format'

export function DesktopShell() {
  const { session, setSession } = useSession()
  const { org, user, s, warehouse } = useApp()
  const nav = useNavigate()
  if (!session || !org || !user) return <Navigate to="/login" replace />
  if (user.role !== 'owner') return <Navigate to="/m" replace />
  const toPick = s.orders.filter((o) => o.status === 'to_pick' || o.status === 'new').length
  const receipts = s.receipts.filter((r) => r.status !== 'done').length

  return (
    <div className="h-[100dvh] flex bg-paper text-ink">
      <aside className="w-[232px] shrink-0 bg-surface border-r border-line flex flex-col">
        <div className="h-14 px-4 flex items-center border-b border-line"><Logo /></div>
        <div className="px-4 py-3 border-b border-line">
          <div className="text-[13px] font-semibold truncate">{org.name}</div>
          <div className="text-[12px] text-ink-3 truncate">{warehouse?.name ?? 'Склад не создан'}</div>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 py-3 text-[13px]">
          <Group title="Работа">
            <Item to="/app" end icon={<LayoutDashboard size={16} />}>Сегодня</Item>
            <Item to="/app/orders" icon={<ShoppingCart size={16} />} count={toPick}>Заказы</Item>
            <Item to="/app/receipts" icon={<ArrowDownToLine size={16} />} count={receipts}>Поставки</Item>
          </Group>
          <Group title="Учёт">
            <Item to="/app/products" icon={<Package size={16} />}>Товары</Item>
            <Item to="/app/stock" icon={<Boxes size={16} />}>Остатки</Item>
            <Item to="/app/warehouse" icon={<Grid3x3 size={16} />}>Склад и ячейки</Item>
            <Item to="/app/journal" icon={<History size={16} />}>Операции</Item>
          </Group>
          <Group title="Настройка">
            <Item to="/app/import" icon={<FileUp size={16} />}>Импорт</Item>
            <Item to="/app/users" icon={<UsersIcon size={16} />}>Пользователи</Item>
            <Item to="/app/settings" icon={<Cog size={16} />}>Настройки</Item>
          </Group>
        </nav>
        <div className="p-2 border-t border-line grid gap-1">
          <NavLink to="/m" className="flex items-center gap-2.5 h-9 px-2.5 rounded-md text-[13px] bg-night text-white hover:bg-night-2">
            <Smartphone size={16} className="text-signal" /> Терминал склада
          </NavLink>
          <div className="flex items-center gap-2.5 px-2.5 h-10">
            <span className="h-7 w-7 rounded-full bg-sunken grid place-items-center text-[12px] font-semibold">{user.name.slice(0, 1)}</span>
            <span className="flex-1 min-w-0 text-[13px] truncate">{user.name}</span>
            <button onClick={() => { setSession(null); nav('/login') }} className="p-1.5 rounded text-ink-3 hover:text-ink hover:bg-sunken" aria-label="Выйти"><LogOut size={15} /></button>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 shrink-0 border-b border-line bg-surface px-6 flex items-center gap-4">
          <GlobalSearch />
          <span className="flex-1" />
          <NetStatus />
        </header>
        <main className="flex-1 overflow-y-auto px-6 py-6"><Suspense fallback={null}><Outlet /></Suspense></main>
      </div>
    </div>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-4">
      <div className="px-2.5 mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-3">{title}</div>
      <div className="grid gap-px">{children}</div>
    </div>
  )
}

function Item({ to, icon, children, count, end }: { to: string; icon: ReactNode; children: ReactNode; count?: number; end?: boolean }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => cx('flex items-center gap-2.5 h-8 px-2.5 rounded-md', isActive ? 'bg-sunken text-ink font-medium' : 'text-ink-2 hover:bg-sunken/60 hover:text-ink')}>
      {icon}
      <span className="flex-1">{children}</span>
      {!!count && <span className="text-[11px] tnum font-semibold bg-ink text-white rounded px-1.5 leading-[18px]">{count}</span>}
    </NavLink>
  )
}

function NetStatus() {
  const net = useNet()
  if (net.online) return <span className="flex items-center gap-1.5 text-[12px] text-ink-3"><span className="h-1.5 w-1.5 rounded-full bg-ok" />Синхронизировано</span>
  return <span className="flex items-center gap-1.5 text-[12px] text-warn"><CloudOff size={14} />Нет связи · в очереди {net.queue.length}</span>
}

/** One search box for products, SKUs, barcodes, orders and cells. A USB scanner fills it from anywhere. */
function GlobalSearch() {
  const { s } = useApp()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLInputElement>(null)

  useHidScanner((code) => { setQ(code); setOpen(true); ref.current?.focus() })
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); ref.current?.focus(); setOpen(true) }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  const exact = useMemo(() => (q ? S.resolveCode(s, q) : null), [s, q])
  const found = useMemo(() => searchAll(s, q), [s, q])
  const go = (to: string) => { setOpen(false); setQ(''); ref.current?.blur(); nav(to) }

  return (
    <div className="relative w-[520px]">
      <div className="flex items-center gap-2 h-9 px-3 rounded-md bg-paper border border-line focus-within:border-ink focus-within:bg-surface">
        <Search size={16} className="text-ink-3" />
        <input
          ref={ref}
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => { if (e.key === 'Escape') { setQ(''); ref.current?.blur() } }}
          placeholder="Товар, SKU, штрихкод, заказ или ячейка — или просто сканируйте"
          className="flex-1 bg-transparent text-[13px] focus:outline-none"
          data-testid="global-search"
        />
        <Kbd>Ctrl K</Kbd>
      </div>
      {open && q && (
        <div className="absolute top-11 left-0 right-0 z-30 bg-surface border border-line rounded-lg shadow-xl overflow-hidden max-h-[70vh] overflow-y-auto">
          {exact?.kind === 'product' && <ExactProduct id={exact.product.id} onOpen={() => go(`/app/products?open=${exact.product.id}`)} />}
          {exact?.kind === 'cell' && (
            <button onMouseDown={() => go(`/app/warehouse?cell=${exact.cell.id}`)} className="w-full text-left px-4 py-3 hover:bg-paper">
              <CellTag code={exact.cell.code} />
              <div className="mt-2 grid gap-1">
                {S.cellContents(s, exact.cell.id).map((x) => <div key={x.product.id} className="flex text-[13px]"><span className="flex-1">{x.product.name}</span><span className="tnum font-semibold">{x.qty}</span></div>)}
                {S.cellContents(s, exact.cell.id).length === 0 && <span className="text-[13px] text-ink-3">Пусто</span>}
              </div>
            </button>
          )}
          {exact?.kind === 'order' && (
            <button onMouseDown={() => go(`/app/orders?open=${exact.order.id}`)} className="w-full text-left px-4 py-3 hover:bg-paper flex items-center gap-3">
              <span className="font-mono font-semibold">№{exact.order.number}</span><span className="flex-1 text-[13px] text-ink-2">{exact.order.customer}</span><StatusBadge status={exact.order.status} />
            </button>
          )}
          {exact?.kind === 'unknown' && (
            <>
              {found.products.slice(0, 6).map((p) => (
                <button key={p.id} onMouseDown={() => go(`/app/products?open=${p.id}`)} className="w-full text-left px-4 py-2 hover:bg-paper flex items-center gap-3">
                  <ProductThumb product={p} size={28} /><span className="flex-1 text-[13px]">{p.name}</span><span className="font-mono text-[12px] text-ink-3">{p.sku}</span><span className="tnum text-[13px] font-semibold w-10 text-right">{S.productStock(s, p.id).total}</span>
                </button>
              ))}
              {found.orders.slice(0, 4).map((o) => (
                <button key={o.id} onMouseDown={() => go(`/app/orders?open=${o.id}`)} className="w-full text-left px-4 py-2 hover:bg-paper flex items-center gap-3 text-[13px]">
                  <ShoppingCart size={15} className="text-ink-3" /><span className="font-mono font-semibold">№{o.number}</span><span className="flex-1 text-ink-2 truncate">{o.customer}</span><StatusBadge status={o.status} />
                </button>
              ))}
              {found.cells.length > 0 && <div className="px-4 py-2 flex flex-wrap gap-1.5">{found.cells.slice(0, 10).map((c) => <button key={c.id} onMouseDown={() => go(`/app/warehouse?cell=${c.id}`)}><CellTag code={c.code} /></button>)}</div>}
              {found.products.length + found.orders.length + found.cells.length === 0 && <div className="px-4 py-6 text-center text-[13px] text-ink-3">Ничего не найдено</div>}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function ExactProduct({ id, onOpen }: { id: string; onOpen: () => void }) {
  const { s } = useApp()
  const p = s.products.find((x) => x.id === id)!
  const st = S.productStock(s, id)
  return (
    <button onMouseDown={onOpen} className="w-full text-left px-4 py-3 hover:bg-paper" data-testid="search-product">
      <div className="flex items-center gap-3">
        <ProductThumb product={p} size={44} />
        <div className="flex-1"><div className="font-semibold">{p.name}</div><div className="font-mono text-[12px] text-ink-3">{p.sku}</div></div>
        <div className="text-right"><div className="text-[22px] font-semibold tnum leading-none">{st.total}</div><div className="text-[11px] text-ink-3">всего</div></div>
      </div>
      <div className="mt-2.5 grid gap-1 pl-14">
        {st.cells.map((c) => <div key={c.cell.id} className="flex items-center gap-2 text-[13px]"><CellTag code={c.cell.code} size="sm" /><span className="flex-1" /><span className="tnum font-semibold">{c.qty}</span></div>)}
      </div>
    </button>
  )
}
