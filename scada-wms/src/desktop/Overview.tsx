import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowRight, Truck } from 'lucide-react'
import { useApp } from '@/app/state'
import * as S from '@/domain/services'
import { describe, MOVEMENT_LABEL } from '@/app/movement'
import { Button, CellTag, ProductThumb, StatusBadge, StatusDot, toast } from '@/ui/kit'
import { PageHead } from './shared'
import { fmtTime, plural } from '@/lib/format'
import type { OrderStatus } from '@/domain/types'

const FLOW: OrderStatus[] = ['new', 'to_pick', 'picking', 'picked', 'packed', 'shipped']

export function Overview() {
  const { s, ctx, user } = useApp()
  const nav = useNavigate()
  const today = new Date().toDateString()
  const count = (st: OrderStatus) => s.orders.filter((o) => o.status === st && (st !== 'shipped' || new Date(o.events.at(-1)?.ts ?? o.createdAt).toDateString() === today)).length
  const stuck = s.orders.filter((o) => o.status === 'new')
  const packed = s.orders.filter((o) => o.status === 'packed')
  const low = s.products.filter((p) => !p.archived).map((p) => ({ p, st: S.productStock(s, p.id) })).filter((x) => x.st.available <= 3).sort((a, b) => a.st.available - b.st.available).slice(0, 6)
  const receipts = s.receipts.filter((r) => r.status !== 'done')
  const recent = [...s.movements].sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 12)
  const todayOps = s.movements.filter((m) => new Date(m.ts).toDateString() === today)
  const workers = s.users.map((u) => ({ u, n: todayOps.filter((m) => m.userId === u.id).length })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n)

  const release = (id: string) => {
    try { S.releaseOrder(ctx, id); toast('Заказ передан в сборку') } catch (e) { toast(e instanceof Error ? e.message : String(e), 'err') }
  }

  return (
    <div className="max-w-[1400px]">
      <PageHead title={`Добрый день, ${user.name.split(' ')[0]}`} sub={new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })} />

      <div className="grid grid-cols-6 wms-panel">
        {FLOW.map((st, i) => (
          <button key={st} onClick={() => nav(`/app/orders?status=${st}`)} className="text-left p-4 border-r border-border/70 last:border-0 hover:bg-accent/20 transition-colors relative group">
            <div className="wms-metric-label flex items-center gap-1.5"><StatusDot status={st} />{S.STATUS_LABEL[st]}{st === 'shipped' && ' сегодня'}</div>
            <div className="wms-metric-value">{count(st)}</div>
            {i < FLOW.length - 1 && <ArrowRight size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/40" />}
          </button>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-[1.25fr_1fr] gap-6">
        <div className="grid gap-6 content-start">
          <Panel title="Требует внимания">
            {stuck.length + packed.length + receipts.length === 0 && <div className="px-5 py-6 text-[13px] text-muted-foreground/80">Всё идёт по плану</div>}
            {stuck.map((o) => {
              const short = s.orderItems.filter((i) => i.orderId === o.id).map((i) => ({ i, st: S.productStock(s, i.productId), p: s.products.find((p) => p.id === i.productId)! })).filter((x) => x.st.available < x.i.qty)
              return (
                <Row key={o.id}>
                  <AlertTriangle size={16} className="text-amber-800 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px]"><Link to={`/app/orders?open=${o.id}`} className="font-mono font-semibold hover:underline">№{o.number}</Link> не передан в сборку</div>
                    <div className="text-[12px] text-muted-foreground truncate">{short.length ? short.map((x) => `${x.p.sku}: нужно ${x.i.qty}, доступно ${x.st.available}`).join('; ') : 'Остатка хватает — можно передать'}</div>
                  </div>
                  <Button size="sm" onClick={() => release(o.id)} disabled={short.length > 0}>В сборку</Button>
                </Row>
              )
            })}
            {packed.length > 0 && (
              <Row>
                <Truck size={16} className="text-success shrink-0" />
                <div className="flex-1 text-[13px]">{packed.length} {plural(packed.length, 'заказ упакован', 'заказа упакованы', 'заказов упаковано')} и ждут отгрузки</div>
                <Button size="sm" variant="primary" onClick={() => { const n = S.shipOrders(ctx, packed.map((o) => o.id)); toast(`Отгружено: ${n}`) }}>Отгрузить все</Button>
              </Row>
            )}
            {receipts.map((r) => (
              <Row key={r.id}>
                <span className="h-4 w-4 rounded-full border-2 border-foreground/40 shrink-0" />
                <div className="flex-1 text-[13px]">Поставка <span className="font-mono">{r.number}</span> · {r.supplier} <span className="text-muted-foreground/80">· {r.lines.reduce((a, l) => a + l.receivedQty, 0)}/{r.lines.reduce((a, l) => a + l.expectedQty, 0)} шт.</span></div>
                <Link to="/app/receipts" className="text-[12px] link font-medium">Открыть</Link>
              </Row>
            ))}
          </Panel>

          <Panel title="Заканчивается" action={<Link to="/app/stock" className="text-[12px] link font-medium">Все остатки</Link>}>
            {low.map(({ p, st }) => (
              <Row key={p.id}>
                <ProductThumb product={p} size={28} />
                <span className="flex-1 text-[13px] truncate">{p.name}</span>
                <span className="font-mono text-[12px] text-muted-foreground/80 w-24">{p.sku}</span>
                <span className={`tnum text-[13px] font-semibold w-20 text-right ${st.available === 0 ? 'text-destructive' : 'text-amber-800'}`}>{st.available} доступно</span>
              </Row>
            ))}
            {low.length === 0 && <div className="px-5 py-6 text-[13px] text-muted-foreground/80">Остатков достаточно</div>}
          </Panel>
        </div>

        <div className="grid gap-6 content-start">
          <Panel title="Последние операции" action={<Link to="/app/journal" className="text-[12px] link font-medium">Журнал</Link>}>
            {recent.map((m) => {
              const d = describe(s, m)
              return (
                <Row key={m.id}>
                  <span className="font-mono text-[12px] text-muted-foreground/80 w-10">{fmtTime(m.ts)}</span>
                  <span className="text-[12px] text-muted-foreground w-[92px] truncate">{MOVEMENT_LABEL[m.type]}</span>
                  <span className="font-mono text-[12px] w-[82px] truncate">{d.product?.sku}</span>
                  <span className="tnum text-[13px] font-semibold w-12 text-right">{d.sign}{m.qty}</span>
                  <span className="flex-1 flex items-center gap-1 justify-end">
                    {d.from && <LocMini code={d.from} box={d.fromType === 'container'} />}
                    {d.from && d.to && <ArrowRight size={12} className="text-muted-foreground/80" />}
                    {d.to && <LocMini code={d.to} box={d.toType === 'container'} />}
                  </span>
                </Row>
              )
            })}
          </Panel>
          <Panel title="Сегодня работали">
            {workers.length === 0 && <div className="px-5 py-6 text-[13px] text-muted-foreground/80">Пока никто</div>}
            {workers.map(({ u, n }) => (
              <Row key={u.id}>
                <span className="h-6 w-6 rounded-full bg-muted grid place-items-center text-[11px] font-semibold">{u.name.slice(0, 1)}</span>
                <span className="flex-1 text-[13px]">{u.name}</span>
                <span className="text-[12px] text-muted-foreground/80">{n} {plural(n, 'операция', 'операции', 'операций')}</span>
              </Row>
            ))}
          </Panel>
          {s.orders.filter((o) => o.status === 'picking').length > 0 && (
            <Panel title="Собирается сейчас">
              {s.orders.filter((o) => o.status === 'picking').map((o) => (
                <Row key={o.id}><span className="font-mono text-[13px] font-semibold">№{o.number}</span><span className="flex-1 text-[13px] text-muted-foreground">{s.users.find((u) => u.id === o.pickerId)?.name}</span><StatusBadge status={o.status} /></Row>
              ))}
            </Panel>
          )}
        </div>
      </div>
    </div>
  )
}

export function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="wms-panel">
      <div className="wms-panel-header flex items-center justify-between"><h2 className="wms-panel-title">{title}</h2>{action}</div>
      <div className="divide-y divide-border/70">{children}</div>
    </section>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-2.5 flex items-center gap-3 min-h-[44px] text-foreground">{children}</div>
}

export function LocMini({ code, box }: { code: string; box?: boolean }) {
  return box ? <span className="font-mono font-semibold text-[11px] bg-foreground text-background px-1.5 rounded-[6px] leading-[18px]">{code}</span> : <CellTag code={code} size="sm" />
}
