import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Trash2, Truck } from 'lucide-react'
import { useApp } from '@/app/state'
import * as S from '@/domain/services'
import { Button, BoxTag, CellTag, Drawer, Field, Input, Modal, ProductThumb, Select, StatusBadge, toast } from '@/ui/kit'
import { PageHead, QrImg } from './shared'
import { cx, fmtWhen } from '@/lib/format'
import type { Channel, OrderStatus } from '@/domain/types'

const TABS: (OrderStatus | 'all')[] = ['all', 'new', 'to_pick', 'picking', 'picked', 'packed', 'shipped']

export function Orders() {
  const { s, ctx } = useApp()
  const [params, setParams] = useSearchParams()
  const status = (params.get('status') as OrderStatus | null) ?? 'all'
  const openId = params.get('open')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [creating, setCreating] = useState(false)

  const list = useMemo(() => s.orders.filter((o) => status === 'all' || o.status === status).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [s, status])
  const selected = list.filter((o) => sel.has(o.id))
  const setTab = (t: string) => { setSel(new Set()); setParams(t === 'all' ? {} : { status: t }) }

  const bulkRelease = () => {
    let ok = 0
    const errs: string[] = []
    for (const o of selected.filter((x) => x.status === 'new')) {
      try { S.releaseOrder(ctx, o.id); ok++ } catch (e) { errs.push(`№${o.number}: ${e instanceof Error ? e.message : e}`) }
    }
    toast(errs.length ? `В сборку: ${ok}. ${errs[0]}` : `В сборку: ${ok}`, errs.length ? 'warn' : 'ok')
    setSel(new Set())
  }
  const bulkShip = () => {
    const n = S.shipOrders(ctx, selected.map((o) => o.id))
    toast(`Отгружено: ${n}`)
    setSel(new Set())
  }

  return (
    <div className="max-w-[1500px]">
      <PageHead title="Заказы" sub="Новый → К сборке → Собирается → Собран → Упакован → Отгружен" actions={<Button variant="primary" onClick={() => setCreating(true)} data-testid="order-new"><Plus size={16} />Заказ</Button>} />
      <div className="flex items-center gap-1 border-b border-border mb-3">
        {TABS.map((t) => {
          const n = t === 'all' ? s.orders.length : s.orders.filter((o) => o.status === t).length
          return (
            <button key={t} onClick={() => setTab(t)} className={cx('h-9 px-3 text-[13px] -mb-px border-b-2', status === t ? 'border-primary font-medium' : 'border-transparent text-muted-foreground hover:text-foreground')}>
              {t === 'all' ? 'Все' : S.STATUS_LABEL[t]} <span className="text-muted-foreground/80 tnum ml-0.5">{n}</span>
            </button>
          )
        })}
        <span className="flex-1" />
        {selected.length > 0 && (
          <div className="flex items-center gap-2 pb-1.5">
            <span className="text-[13px] text-muted-foreground">Выбрано: {selected.length}</span>
            {selected.some((o) => o.status === 'new') && <Button size="sm" onClick={bulkRelease}>В сборку</Button>}
            {selected.some((o) => o.status === 'packed') && <Button size="sm" variant="primary" onClick={bulkShip}><Truck size={14} />Отгрузить</Button>}
          </div>
        )}
      </div>

      <div className="wms-panel">
        <table className="wms-ag-grid wms-ag-grid--fit">
          <thead><tr>
            <th className="w-8"><input type="checkbox" className="accent-primary" checked={selected.length > 0 && selected.length === list.length} onChange={(e) => setSel(new Set(e.target.checked ? list.map((o) => o.id) : []))} /></th>
            <th>Номер</th><th>Канал</th><th>Покупатель / склад МП</th><th>Позиции</th><th className="text-right">Шт.</th><th>Статус</th><th>Сборщик</th><th>Короб</th><th>Создан</th>
          </tr></thead>
          <tbody>
            {list.map((o) => {
              const items = s.orderItems.filter((i) => i.orderId === o.id)
              const box = s.containers.find((c) => c.id === o.containerId)
              return (
                <tr key={o.id} className={cx('wms-ag-row cursor-pointer', openId === o.id && 'sel')} onClick={() => setParams({ ...(status !== 'all' ? { status } : {}), open: o.id })}>
                  <td onClick={(e) => e.stopPropagation()}><input type="checkbox" className="accent-primary" checked={sel.has(o.id)} onChange={(e) => { const n = new Set(sel); if (e.target.checked) n.add(o.id); else n.delete(o.id); setSel(n) }} /></td>
                  <td className="font-mono font-semibold">{o.number}</td>
                  <td>{S.CHANNEL_LABEL[o.channel]}</td>
                  <td className="text-muted-foreground">{o.customer}</td>
                  <td className="max-w-[340px] truncate text-muted-foreground">{items.map((i) => s.products.find((p) => p.id === i.productId)?.name).join(', ')}</td>
                  <td className="text-right tnum">{items.reduce((a, i) => a + i.qty, 0)}</td>
                  <td><StatusBadge status={o.status} /></td>
                  <td className="text-muted-foreground">{s.users.find((u) => u.id === o.pickerId)?.name ?? ''}</td>
                  <td>{box && o.status !== 'shipped' && <span className="font-mono text-[12px]">{box.code}</span>}</td>
                  <td className="text-muted-foreground/80 tnum">{fmtWhen(o.createdAt)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {list.length === 0 && <div className="py-12 text-center text-sm text-muted-foreground/80">Заказов нет</div>}
      </div>

      {openId && s.orders.some((o) => o.id === openId) && <OrderDrawer id={openId} onClose={() => setParams(status !== 'all' ? { status } : {})} />}
      {creating && <OrderForm onClose={() => setCreating(false)} />}
    </div>
  )
}

function OrderDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { s, ctx } = useApp()
  const o = s.orders.find((x) => x.id === id)!
  const items = s.orderItems.filter((i) => i.orderId === id)
  const task = S.taskForOrder(s, id)
  const box = s.containers.find((c) => c.id === o.containerId)
  const act = (fn: () => void, ok: string) => { try { fn(); toast(ok) } catch (e) { toast(e instanceof Error ? e.message : String(e), 'err') } }
  return (
    <Drawer open onClose={onClose} width={560} title={<span className="flex items-center gap-3"><span className="font-mono">№{o.number}</span><StatusBadge status={o.status} /></span>} footer={
      <>
        {o.status === 'new' && <Button variant="primary" onClick={() => act(() => S.releaseOrder(ctx, o.id), 'Передан в сборку')}>Передать в сборку</Button>}
        {o.status === 'packed' && <Button variant="primary" onClick={() => act(() => S.shipOrders(ctx, [o.id]), 'Отгружен')}><Truck size={15} />Отгрузить</Button>}
      </>
    }>
      <div className="flex gap-5">
        <QrImg text={`ORD-${o.number}`} size={88} />
        <dl className="grid grid-cols-[100px_1fr] gap-y-1 text-[13px] content-start">
          <dt className="text-muted-foreground/80">Канал</dt><dd>{S.CHANNEL_LABEL[o.channel]}</dd>
          <dt className="text-muted-foreground/80">Покупатель</dt><dd>{o.customer || '—'}</dd>
          <dt className="text-muted-foreground/80">Создан</dt><dd>{fmtWhen(o.createdAt)}</dd>
          <dt className="text-muted-foreground/80">Сборщик</dt><dd>{s.users.find((u) => u.id === o.pickerId)?.name ?? '—'}</dd>
          <dt className="text-muted-foreground/80">Упаковщик</dt><dd>{s.users.find((u) => u.id === o.packerId)?.name ?? '—'}</dd>
          {box && <><dt className="text-muted-foreground/80">Короб</dt><dd><BoxTag code={box.code} /></dd></>}
        </dl>
      </div>
      <h3 className="mt-6 mb-2 text-[13px] font-semibold">Позиции</h3>
      <table className="wms-ag-grid wms-ag-grid--fit wms-ag-grid--compact">
        <thead><tr><th /><th>Товар</th><th className="text-right">Нужно</th><th className="text-right">Собрано</th><th className="text-right">Упаковано</th></tr></thead>
        <tbody>
          {items.map((i) => {
            const p = s.products.find((x) => x.id === i.productId)!
            return (
              <tr key={i.id} className="wms-ag-row">
                <td className="w-10"><ProductThumb product={p} size={28} /></td>
                <td><div>{p.name}</div><div className="font-mono text-[12px] text-muted-foreground/80">{p.sku}</div></td>
                <td className="text-right tnum font-semibold">{i.qty}</td>
                <td className={cx('text-right tnum', i.pickedQty >= i.qty && 'text-success font-semibold')}>{i.pickedQty}</td>
                <td className={cx('text-right tnum', i.packedQty >= i.qty && 'text-success font-semibold')}>{i.packedQty}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {task && (
        <>
          <h3 className="mt-6 mb-2 text-[13px] font-semibold">Маршрут сборки</h3>
          <div className="border border-border rounded-lg divide-y divide-border">
            {task.lines.map((l, n) => {
              const p = s.products.find((x) => x.id === l.productId)
              return (
                <div key={l.id} className="flex items-center gap-3 px-3 py-2 text-[13px]">
                  <span className="font-mono text-muted-foreground/80 w-4">{n + 1}</span>
                  <CellTag code={s.cells.find((c) => c.id === l.cellId)?.code ?? '?'} size="sm" />
                  <span className="flex-1 truncate">{p?.name}</span>
                  <span className="tnum">{l.pickedQty}/{l.qty}</span>
                </div>
              )
            })}
          </div>
        </>
      )}
      <h3 className="mt-6 mb-2 text-[13px] font-semibold">История</h3>
      <ol className="grid gap-2 text-[13px]">
        {[...o.events].reverse().map((e, i) => (
          <li key={i} className="flex gap-3"><span className="font-mono text-[12px] text-muted-foreground/80 w-20 shrink-0">{fmtWhen(e.ts)}</span><span className="flex-1">{e.text}</span><span className="text-muted-foreground/80">{s.users.find((u) => u.id === e.userId)?.name.split(' ')[0]}</span></li>
        ))}
      </ol>
    </Drawer>
  )
}

function OrderForm({ onClose }: { onClose: () => void }) {
  const { s, ctx } = useApp()
  const [channel, setChannel] = useState<Channel>('manual')
  const [customer, setCustomer] = useState('')
  const [number, setNumber] = useState('')
  const [release, setRelease] = useState(true)
  const [items, setItems] = useState<{ productId: string; qty: number }[]>([{ productId: '', qty: 1 }])
  const [err, setErr] = useState('')
  const products = s.products.filter((p) => !p.archived).sort((a, b) => a.name.localeCompare(b.name))

  const save = () => {
    const clean = items.filter((i) => i.productId)
    try {
      const r = S.createOrder(ctx, { channel, customer, number: number || undefined, items: clean }, release)
      if (release && !r.released) toast(`Заказ создан, но не передан в сборку: ${r.shortage}`, 'warn')
      else toast(release ? 'Заказ создан и передан в сборку' : 'Заказ создан')
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <Modal open onClose={onClose} title="Новый заказ" width={620} footer={<><Button onClick={onClose}>Отмена</Button><Button variant="primary" onClick={save} data-testid="order-save">Создать</Button></>}>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Канал"><Select value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>{(Object.keys(S.CHANNEL_LABEL) as Channel[]).map((c) => <option key={c} value={c}>{S.CHANNEL_LABEL[c]}</option>)}</Select></Field>
        <Field label="Покупатель / склад МП"><Input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="WB · Коледино" /></Field>
        <Field label="Номер" hint="Пусто — присвоим сами"><Input value={number} onChange={(e) => setNumber(e.target.value)} className="font-mono" /></Field>
      </div>
      <div className="mt-4 text-[12px] font-medium text-muted-foreground mb-1">Позиции</div>
      <div className="grid gap-2">
        {items.map((it, i) => {
          const st = it.productId ? S.productStock(s, it.productId) : null
          return (
            <div key={i} className="flex items-center gap-2">
              <Select value={it.productId} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, productId: e.target.value } : x)))} className="flex-1" data-testid={`oi-product-${i}`}>
                <option value="">Выберите товар…</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}
              </Select>
              <Input type="number" min={1} value={it.qty} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, qty: Math.max(1, Number(e.target.value) || 1) } : x)))} className="w-20 tnum" data-testid={`oi-qty-${i}`} />
              <span className={cx('w-24 text-[12px] tnum', st && st.available < it.qty ? 'text-destructive' : 'text-muted-foreground/80')}>{st ? `доступно ${st.available}` : ''}</span>
              <button onClick={() => setItems(items.filter((_, j) => j !== i))} className="p-1.5 text-muted-foreground/80 hover:text-destructive" aria-label="Удалить"><Trash2 size={15} /></button>
            </div>
          )
        })}
        <button onClick={() => setItems([...items, { productId: '', qty: 1 }])} className="text-[13px] link font-medium text-left">+ Позиция</button>
      </div>
      <label className="mt-4 flex items-center gap-2 text-[13px]"><input type="checkbox" checked={release} onChange={(e) => setRelease(e.target.checked)} className="accent-primary" />Сразу передать в сборку (зарезервировать товар)</label>
      {err && <div className="mt-3 rounded-md bg-destructive/5 text-destructive text-[13px] px-3 py-2">{err}</div>}
    </Modal>
  )
}
