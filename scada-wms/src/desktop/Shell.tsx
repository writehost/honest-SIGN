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
import { CellTag, Logo, ProductThumb, StatusBadge } from '@/ui/kit'
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
    <div className="h-[100dvh] flex bg-background text-foreground">
      {/* Sidebar — same structure and classes as scada_system components/wms/sidebar.tsx */}
      <aside className="w-64 shrink-0 border-r border-sidebar-border/80 bg-sidebar flex flex-col">
        <div className="flex h-16 shrink-0 items-center px-3"><Logo /></div>
        <div className="mx-2 mb-1 rounded-md bg-sidebar-accent/60 px-2.5 py-2">
          <div className="truncate text-[12px] font-semibold text-sidebar-foreground">{org.name}</div>
          <div className="truncate text-[11px] text-muted-foreground">{warehouse?.name ?? 'Склад не создан'}</div>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          <Group title="Работа">
            <Item to="/app" end icon={<LayoutDashboard className="h-4 w-4" />}>Сегодня</Item>
            <Item to="/app/orders" icon={<ShoppingCart className="h-4 w-4" />} count={toPick}>Заказы</Item>
            <Item to="/app/receipts" icon={<ArrowDownToLine className="h-4 w-4" />} count={receipts}>Поставки</Item>
          </Group>
          <Group title="Учёт">
            <Item to="/app/products" icon={<Package className="h-4 w-4" />}>Товары</Item>
            <Item to="/app/stock" icon={<Boxes className="h-4 w-4" />}>Остатки</Item>
            <Item to="/app/warehouse" icon={<Grid3x3 className="h-4 w-4" />}>Склад и ячейки</Item>
            <Item to="/app/journal" icon={<History className="h-4 w-4" />}>Операции</Item>
          </Group>
          <Group title="Настройка">
            <Item to="/app/import" icon={<FileUp className="h-4 w-4" />}>Импорт</Item>
            <Item to="/app/users" icon={<UsersIcon className="h-4 w-4" />}>Пользователи</Item>
          </Group>
        </nav>
        <div className="grid gap-0.5 p-3">
          <Item to="/m" icon={<Smartphone className="h-4 w-4" />}>Терминал склада</Item>
          <Item to="/app/settings" icon={<Cog className="h-5 w-5" />}>Настройки</Item>
          <div className="mt-2 flex items-center gap-2.5 border-t border-sidebar-border/80 px-1 pt-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-foreground text-[12px] font-semibold text-background">{user.name.slice(0, 1)}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-sidebar-foreground">{user.name}</span>
              <span className="block text-[11px] text-muted-foreground">Владелец</span>
            </span>
            <button onClick={() => { setSession(null); nav('/login') }} className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground" aria-label="Выйти"><LogOut className="h-4 w-4" /></button>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Header — scada_system components/wms/header.tsx */}
        <header className="h-16 shrink-0 border-b border-border/45 bg-card px-6 shadow-sm flex items-center gap-4">
          <GlobalSearch />
          <span className="flex-1" />
          <NetStatus />
        </header>
        <main className="flex-1 overflow-y-auto"><div className="mx-auto max-w-[1600px] p-6"><Suspense fallback={null}><Outlet /></Suspense></div></main>
      </div>
    </div>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-4">
      <h2 className="mb-1 px-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{title}</h2>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

function Item({ to, icon, children, count, end }: { to: string; icon: ReactNode; children: ReactNode; count?: number; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => cx(
        'relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors',
        isActive ? 'bg-sidebar-accent text-sidebar-foreground' : 'text-muted-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-foreground',
      )}
    >
      {({ isActive }) => (
        <>
          {isActive && <span className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-primary" />}
          <span className={cx('flex-shrink-0', isActive && 'text-primary')}>{icon}</span>
          <span className="flex-1">{children}</span>
          {!!count && <span className="flex h-4 min-w-4 items-center justify-center rounded bg-muted px-1 text-[10px] font-medium text-foreground tnum">{count}</span>}
        </>
      )}
    </NavLink>
  )
}

function NetStatus() {
  const net = useNet()
  if (net.online) return <span className="flex items-center gap-1.5 rounded-md border border-border/70 bg-background px-2 py-1 text-[12px] font-medium text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-success" />Синхронизировано</span>
  return <span className="flex items-center gap-1.5 text-[12px] text-amber-800"><CloudOff size={14} />Нет связи · в очереди {net.queue.length}</span>
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
      <div className="flex items-center gap-2 h-9 pl-3 pr-2 rounded-xl bg-card shadow-sm border border-border/70 transition-[box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
        <Search size={16} className="text-muted-foreground" />
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
        <span className="pointer-events-none rounded-md border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">Ctrl K</span>
      </div>
      {open && q && (
        <div className="absolute top-11 left-0 right-0 z-30 bg-popover border border-border/70 rounded-xl shadow-lg overflow-hidden max-h-[70vh] overflow-y-auto">
          {exact?.kind === 'product' && <ExactProduct id={exact.product.id} onOpen={() => go(`/app/products?open=${exact.product.id}`)} />}
          {exact?.kind === 'cell' && (
            <button onMouseDown={() => go(`/app/warehouse?cell=${exact.cell.id}`)} className="w-full text-left px-4 py-3 hover:bg-accent/25">
              <CellTag code={exact.cell.code} />
              <div className="mt-2 grid gap-1">
                {S.cellContents(s, exact.cell.id).map((x) => <div key={x.product.id} className="flex text-[13px]"><span className="flex-1">{x.product.name}</span><span className="tnum font-semibold">{x.qty}</span></div>)}
                {S.cellContents(s, exact.cell.id).length === 0 && <span className="text-[13px] text-muted-foreground/80">Пусто</span>}
              </div>
            </button>
          )}
          {exact?.kind === 'order' && (
            <button onMouseDown={() => go(`/app/orders?open=${exact.order.id}`)} className="w-full text-left px-4 py-3 hover:bg-accent/25 flex items-center gap-3">
              <span className="font-mono font-semibold">№{exact.order.number}</span><span className="flex-1 text-[13px] text-muted-foreground">{exact.order.customer}</span><StatusBadge status={exact.order.status} />
            </button>
          )}
          {exact?.kind === 'unknown' && (
            <>
              {found.products.slice(0, 6).map((p) => (
                <button key={p.id} onMouseDown={() => go(`/app/products?open=${p.id}`)} className="w-full text-left px-4 py-2 hover:bg-accent/25 flex items-center gap-3">
                  <ProductThumb product={p} size={28} /><span className="flex-1 text-[13px]">{p.name}</span><span className="font-mono text-[12px] text-muted-foreground/80">{p.sku}</span><span className="tnum text-[13px] font-semibold w-10 text-right">{S.productStock(s, p.id).total}</span>
                </button>
              ))}
              {found.orders.slice(0, 4).map((o) => (
                <button key={o.id} onMouseDown={() => go(`/app/orders?open=${o.id}`)} className="w-full text-left px-4 py-2 hover:bg-accent/25 flex items-center gap-3 text-[13px]">
                  <ShoppingCart size={15} className="text-muted-foreground/80" /><span className="font-mono font-semibold">№{o.number}</span><span className="flex-1 text-muted-foreground truncate">{o.customer}</span><StatusBadge status={o.status} />
                </button>
              ))}
              {found.cells.length > 0 && <div className="px-4 py-2 flex flex-wrap gap-1.5">{found.cells.slice(0, 10).map((c) => <button key={c.id} onMouseDown={() => go(`/app/warehouse?cell=${c.id}`)}><CellTag code={c.code} /></button>)}</div>}
              {found.products.length + found.orders.length + found.cells.length === 0 && <div className="px-4 py-6 text-center text-[13px] text-muted-foreground/80">Ничего не найдено</div>}
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
    <button onMouseDown={onOpen} className="w-full text-left px-4 py-3 hover:bg-accent/25" data-testid="search-product">
      <div className="flex items-center gap-3">
        <ProductThumb product={p} size={44} />
        <div className="flex-1"><div className="font-semibold">{p.name}</div><div className="font-mono text-[12px] text-muted-foreground/80">{p.sku}</div></div>
        <div className="text-right"><div className="text-[22px] font-semibold tnum leading-none">{st.total}</div><div className="text-[11px] text-muted-foreground/80">всего</div></div>
      </div>
      <div className="mt-2.5 grid gap-1 pl-14">
        {st.cells.map((c) => <div key={c.cell.id} className="flex items-center gap-2 text-[13px]"><CellTag code={c.cell.code} size="sm" /><span className="flex-1" /><span className="tnum font-semibold">{c.qty}</span></div>)}
      </div>
    </button>
  )
}
