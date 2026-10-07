import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, Search as SearchIcon, X } from 'lucide-react'
import { useApp } from '@/app/state'
import * as S from '@/domain/services'
import { ScanPad } from '@/scan/ScanPad'
import { flashOk } from '@/scan/signals'
import { BoxTag, CellTag, ProductThumb, StatusBadge } from '@/ui/kit'
import { BottomNav, HiddenScan, Section } from './common'
import { cellCodes, productCodes } from './demo'
import type { Scoped } from '@/domain/db'

/** Text search over products / orders / cells. Exact code hits are handled by resolveCode first. */
export function searchAll(s: Scoped, q: string) {
  const t = q.trim().toLowerCase()
  if (!t) return { products: [], orders: [], cells: [] }
  const words = t.split(/\s+/)
  const products = s.products.filter((p) => {
    const hay = `${p.name} ${p.sku} ${p.article} ${p.brand} ${p.category} ${p.size ?? ''} ${p.color ?? ''} ${s.barcodes.filter((b) => b.productId === p.id).map((b) => b.code).join(' ')}`.toLowerCase()
    return words.every((w) => hay.includes(w))
  }).slice(0, 20)
  const orders = s.orders.filter((o) => o.number.includes(t.replace(/^(ord-|#|№)/, '')) || o.customer.toLowerCase().includes(t)).slice(0, 10)
  const cells = s.cells.filter((c) => c.code.toLowerCase().includes(t)).slice(0, 12)
  return { products, orders, cells }
}

export function MobileSearch() {
  const { s, org } = useApp()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const [text, setText] = useState(q)
  const nav = useNavigate()

  const resolved = useMemo(() => (q ? S.resolveCode(s, q) : null), [s, q])
  const found = useMemo(() => searchAll(s, q), [s, q])

  const go = (v: string) => { setText(v); setParams(v ? { q: v } : {}) }

  return (
    <div className="pb-24">
      <div className="sticky top-0 z-20 bg-background px-4 pt-[max(14px,env(safe-area-inset-top))] pb-3 border-b border-border">
        <form onSubmit={(e) => { e.preventDefault(); go(text) }} className="flex items-center gap-2 h-12 px-3.5 rounded-xl bg-card border border-border">
          <SearchIcon size={20} className="text-muted-foreground/80" />
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Товар, SKU, штрихкод, заказ, ячейка" className="flex-1 bg-transparent text-[16px] focus:outline-none min-w-0" enterKeyHint="search" />
          {text && <button type="button" onClick={() => go('')} aria-label="Очистить"><X size={18} className="text-muted-foreground/80" /></button>}
        </form>
      </div>

      <div className="px-4 pt-4">
        {q && <HiddenScan onScan={(c) => { flashOk(); go(c) }} />}
        {!q && <ScanPad onScan={(c) => { flashOk(); go(c) }} prompt="Или просто сканируйте" demo={[...productCodes(s, undefined, 3), ...cellCodes(s, undefined, 2)]} demoEnabled={org.settings.demoScanner} />}

        {resolved?.kind === 'product' && <ProductCard id={resolved.product.id} />}
        {resolved?.kind === 'cell' && <CellCard id={resolved.cell.id} />}
        {resolved?.kind === 'order' && <OrderCard id={resolved.order.id} />}
        {resolved?.kind === 'container' && (
          <div className="wms-panel p-4">
            <BoxTag code={resolved.container.code} />
            <div className="mt-2 text-muted-foreground">{resolved.container.orderId ? 'Привязан к заказу:' : 'Свободный короб'}</div>
            {resolved.container.orderId && <div className="mt-3"><OrderCard id={resolved.container.orderId} /></div>}
          </div>
        )}

        {resolved?.kind === 'unknown' && (
          <>
            {found.products.length + found.orders.length + found.cells.length === 0 ? (
              <div className="text-center text-muted-foreground py-10">Ничего не найдено по «{q}»</div>
            ) : (
              <>
                {found.products.length > 0 && (
                  <Section title="Товары">
                    <div className="wms-panel divide-y divide-border">
                      {found.products.map((p) => {
                        const st = S.productStock(s, p.id)
                        return (
                          <button key={p.id} onClick={() => go(p.sku)} className="w-full text-left flex items-center gap-3 px-3 py-2.5">
                            <ProductThumb product={p} size={40} />
                            <div className="flex-1 min-w-0"><div className="text-[15px] font-medium truncate">{p.name}</div><div className="text-[12px] font-mono text-muted-foreground">{p.sku}</div></div>
                            <span className="tnum font-semibold">{st.total}</span>
                          </button>
                        )
                      })}
                    </div>
                  </Section>
                )}
                {found.orders.length > 0 && (
                  <Section title="Заказы">
                    <div className="grid gap-2">{found.orders.map((o) => <button key={o.id} onClick={() => go(o.number)} className="wms-panel px-4 py-3 flex items-center gap-3 text-left"><span className="font-mono font-semibold">№{o.number}</span><span className="flex-1 text-muted-foreground text-[14px] truncate">{o.customer}</span><StatusBadge status={o.status} /></button>)}</div>
                  </Section>
                )}
                {found.cells.length > 0 && (
                  <Section title="Ячейки"><div className="flex flex-wrap gap-2">{found.cells.map((c) => <button key={c.id} onClick={() => go(c.code)}><CellTag code={c.code} size="lg" /></button>)}</div></Section>
                )}
              </>
            )}
          </>
        )}
        {q && <button onClick={() => { go(''); nav('/m/search') }} className="mt-6 w-full h-12 rounded-xl border border-border bg-card font-medium text-muted-foreground">Новый поиск</button>}
      </div>
      <BottomNav />
    </div>
  )
}

export function ProductCard({ id }: { id: string }) {
  const { s } = useApp()
  const p = s.products.find((x) => x.id === id)!
  const st = S.productStock(s, id)
  const codes = s.barcodes.filter((b) => b.productId === id)
  return (
    <div className="wms-panel" data-testid="product-card">
      <div className="p-4 flex gap-4">
        <ProductThumb product={p} size={88} className="rounded-xl" />
        <div className="min-w-0">
          <div className="text-[19px] font-semibold leading-tight">{p.name}</div>
          <div className="text-[14px] font-mono text-muted-foreground mt-1">{p.sku}</div>
          <div className="text-[13px] text-muted-foreground/80 font-mono">{codes.map((c) => c.code).join(', ')}</div>
          {p.archived && <span className="inline-block mt-1 text-[12px] px-1.5 rounded bg-muted">В архиве</span>}
        </div>
      </div>
      <div className="grid grid-cols-3 border-t border-border text-center">
        <Stat label="Всего" value={st.total} big />
        <Stat label="Доступно" value={st.available} />
        <Stat label="В резерве" value={st.reserved} />
      </div>
      <div className="border-t border-border">
        {st.cells.length === 0 && <div className="px-4 py-4 text-muted-foreground text-[15px]">Нет в ячейках</div>}
        {st.cells.map((c) => (
          <Link key={c.cell.id} to={`/m/search?q=${c.cell.code}`} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 active:bg-muted">
            <CellTag code={c.cell.code} size="lg" />
            <span className="flex-1" />
            <span className="text-[24px] font-semibold tnum">{c.qty}</span><span className="text-muted-foreground/80">шт.</span>
          </Link>
        ))}
        {st.inBoxes > 0 && <div className="px-4 py-3 text-[14px] text-muted-foreground border-t border-border">В сборочных коробах: <b className="text-foreground">{st.inBoxes} шт.</b></div>}
      </div>
    </div>
  )
}

function Stat({ label, value, big }: { label: string; value: number; big?: boolean }) {
  return (
    <div className="py-3 border-r border-border last:border-0">
      <div className={big ? 'text-[28px] font-bold tnum leading-none' : 'text-[22px] font-semibold tnum leading-none'}>{value}</div>
      <div className="text-[12px] text-muted-foreground/80 mt-1">{label}</div>
    </div>
  )
}

export function CellCard({ id }: { id: string }) {
  const { s } = useApp()
  const c = s.cells.find((x) => x.id === id)!
  const content = S.cellContents(s, id)
  return (
    <div className="wms-panel">
      <div className="p-4 flex items-center justify-between">
        <CellTag code={c.code} size="lg" />
        <span className="text-muted-foreground text-[14px]">{content.reduce((a, x) => a + x.qty, 0)} шт. · {content.length} SKU</span>
      </div>
      <div className="border-t border-border divide-y divide-border">
        {content.length === 0 && <div className="px-4 py-5 text-muted-foreground">Ячейка пустая</div>}
        {content.map((x) => (
          <Link key={x.product.id} to={`/m/search?q=${encodeURIComponent(x.product.sku)}`} className="flex items-center gap-3 px-4 py-3">
            <ProductThumb product={x.product} size={44} />
            <div className="flex-1 min-w-0"><div className="text-[15px] font-medium leading-tight">{x.product.name}</div><div className="text-[12px] font-mono text-muted-foreground">{x.product.sku}</div></div>
            <span className="text-[22px] font-semibold tnum">{x.qty}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

function OrderCard({ id }: { id: string }) {
  const { s } = useApp()
  const o = s.orders.find((x) => x.id === id)!
  const items = s.orderItems.filter((i) => i.orderId === id)
  const next = o.status === 'to_pick' || o.status === 'picking' ? `/m/pick/${o.id}` : o.status === 'picked' ? '/m/pack' : null
  return (
    <div className="wms-panel">
      <div className="p-4 flex items-center justify-between">
        <div><div className="font-mono text-[22px] font-semibold">№{o.number}</div><div className="text-[14px] text-muted-foreground">{S.CHANNEL_LABEL[o.channel]} · {o.customer}</div></div>
        <StatusBadge status={o.status} />
      </div>
      <div className="border-t border-border divide-y divide-border">
        {items.map((i) => {
          const p = s.products.find((x) => x.id === i.productId)!
          return <div key={i.id} className="flex items-center gap-3 px-4 py-2.5"><ProductThumb product={p} size={36} /><span className="flex-1 text-[14px] truncate">{p.name}</span><span className="tnum font-semibold">{i.qty}</span></div>
        })}
      </div>
      {next && <Link to={next} className="flex items-center justify-center gap-2 h-14 bg-primary text-primary-foreground font-semibold">{o.status === 'picked' ? 'Упаковать' : 'Собрать'} <ArrowRight size={18} /></Link>}
    </div>
  )
}
