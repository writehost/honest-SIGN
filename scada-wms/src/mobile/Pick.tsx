import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { Box, CheckCircle2, ChevronRight, Pause } from 'lucide-react'
import { useApp } from '@/app/state'
import * as S from '@/domain/services'
import { DomainError } from '@/domain/db'
import { runOp } from '@/lib/net'
import { usePersistentState } from '@/lib/persist'
import { ScanPad } from '@/scan/ScanPad'
import { flashOk, showError } from '@/scan/signals'
import { BoxTag, CellTag, ProductThumb } from '@/ui/kit'
import { BigButton, DoneScreen, OpHeader, Section, StickyAction } from './common'
import { barcodeOf, cellCodes, productCodes } from './demo'
import { cx, fmtWhen, plural } from '@/lib/format'
import type { Order, Product } from '@/domain/types'

// ─────────────────────────────── queue ───────────────────────────────

export function MobilePickList() {
  const { s, ctx, user } = useApp()
  const nav = useNavigate()
  const mine = s.orders.filter((o) => o.status === 'picking' && o.pickerId === user.id)
  const queue = s.orders.filter((o) => o.status === 'to_pick').sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const others = s.orders.filter((o) => o.status === 'picking' && o.pickerId !== user.id)

  const start = (o: Order) => {
    try {
      runOp(`Начата сборка №${o.number}`, () => S.startPicking(ctx, o.id))
      nav(`/m/pick/${o.id}`)
    } catch (e) {
      showError({ tone: 'err', title: 'Нельзя начать', reason: e instanceof Error ? e.message : String(e) })
    }
  }

  return (
    <div className="pb-36">
      <OpHeader title="Сборка" />
      <div className="px-4 pt-4">
        {mine.length > 0 && (
          <Section title="Вы собираете">
            <div className="grid gap-2">{mine.map((o) => <OrderRow key={o.id} o={o} onClick={() => nav(`/m/pick/${o.id}`)} accent />)}</div>
          </Section>
        )}
        <Section title={`К сборке · ${queue.length}`}>
          {queue.length === 0 ? (
            <div className="wms-panel px-4 py-8 text-center text-muted-foreground">Все заказы собраны. Отличная работа.</div>
          ) : (
            <div className="grid gap-2">{queue.map((o) => <OrderRow key={o.id} o={o} onClick={() => start(o)} />)}</div>
          )}
        </Section>
        {others.length > 0 && (
          <Section title="Собирают другие">
            <div className="grid gap-2 opacity-70">{others.map((o) => <OrderRow key={o.id} o={o} />)}</div>
          </Section>
        )}
      </div>
      {queue.length > 0 && mine.length === 0 && (
        <StickyAction>
          <BigButton testId="start-next" onClick={() => start(queue[0])}>Начать заказ №{queue[0].number} <ChevronRight size={22} /></BigButton>
        </StickyAction>
      )}
    </div>
  )
}

function OrderRow({ o, onClick, accent }: { o: Order; onClick?: () => void; accent?: boolean }) {
  const { s } = useApp()
  const items = s.orderItems.filter((i) => i.orderId === o.id)
  const units = items.reduce((a, i) => a + i.qty, 0)
  const picked = items.reduce((a, i) => a + i.pickedQty, 0)
  const picker = s.users.find((u) => u.id === o.pickerId)
  return (
    <button disabled={!onClick} onClick={onClick} className={cx('w-full text-left rounded-xl px-4 py-3.5 flex items-center gap-3', accent ? 'bg-card border border-primary shadow-[inset_4px_0_0_var(--primary)]' : 'bg-card border border-border/70 shadow-sm active:bg-accent/25')}>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[19px] font-semibold">№{o.number}</span>
          <span className={cx('text-[13px] truncate', 'text-muted-foreground')}>{S.CHANNEL_LABEL[o.channel]}</span>
        </div>
        <div className={cx('text-[14px] mt-0.5', 'text-muted-foreground')}>
          {items.length} {plural(items.length, 'позиция', 'позиции', 'позиций')} · {units} шт.
          {o.status === 'picking' && ` · взято ${picked}`}
          {picker && o.status === 'picking' && !accent && ` · ${picker.name}`}
          {o.status === 'to_pick' && ` · ${fmtWhen(o.createdAt)}`}
        </div>
      </div>
      {onClick && <ChevronRight size={22} className={'text-muted-foreground'} />}
    </button>
  )
}

// ─────────────────────────────── task ────────────────────────────────

export function MobilePickTask() {
  const { orderId = '' } = useParams()
  const { s, ctx, org } = useApp()
  const nav = useNavigate()
  const order = s.orders.find((o) => o.id === orderId)
  const task = order ? S.taskForOrder(s, order.id) : undefined
  const [cellOk, setCellOk] = usePersistentState<Record<string, boolean>>(`pick/${orderId}`, {})
  const box = s.containers.find((c) => c.id === task?.containerId)
  const line = task?.lines.find((l) => l.pickedQty < l.qty)
  const lineNo = task && line ? task.lines.indexOf(line) + 1 : 0
  const product = s.products.find((p) => p.id === line?.productId)
  const cell = s.cells.find((c) => c.id === line?.cellId)
  const describe = (p?: Product) => p ? [p.size, p.color].filter(Boolean).join(' · ') : ''
  useEffect(() => {
    // Opened by link without pressing «Начать» — take the order now.
    if (order?.status === 'to_pick') {
      try { runOp(`Начата сборка №${order.number}`, () => S.startPicking(ctx, order.id)) } catch { /* shown in list */ }
    }
  }, [order?.status, order?.id, order?.number, ctx])

  if (!order || !task) return <Missing />
  if (order.status !== 'picking' && order.status !== 'to_pick') return <PickDone order={order} />

  // ── step 0: tote ──
  if (!box) {
    const onBox = (code: string) => {
      const r = S.resolveCode(s, code)
      if (r.kind === 'order' && r.order.id === order.id) return bind(null)
      if (r.kind !== 'container') {
        showError({ tone: 'err', title: 'Это не короб', reason: 'Отсканируйте QR на пустом сборочном коробе (BOX-…).', scanned: { caption: 'Отсканировано', primary: code } })
        return
      }
      bind(r.container.code)
    }
    const bind = (code: string | null) => {
      try {
        const c = runOp(`Короб для №${order.number}`, () => S.bindContainer(ctx, task.id, code))
        flashOk()
        void c
      } catch (e) {
        showError({ tone: 'err', title: e instanceof DomainError && e.code === 'CONTAINER_BUSY' ? 'Короб занят' : 'Это не короб', reason: e instanceof Error ? e.message : String(e) })
      }
    }
    const free = s.containers.filter((c) => !c.orderId && c.code.startsWith('BOX-'))
    return (
      <div className="pb-40">
        <OpHeader title={`Заказ №${order.number}`} step="короб" onBack={() => nav('/m/pick')} />
        <div className="px-4 pt-4">
          <OrderQr order={order} />
          <div className="mt-4">
            <ScanPad
              compact
              onScan={onBox}
              prompt="Возьмите пустой короб и сканируйте его QR"
              target={<span className="text-[15px] text-muted-foreground">Всё, что вы возьмёте, будет привязано к этому коробу — заказы не смешаются.</span>}
              demo={free.slice(0, 4).map((c) => ({ code: c.code, label: 'Свободный короб', tone: 'ok' as const }))}
              demoEnabled={org.settings.demoScanner}
            />
          </div>
        </div>
        <StickyAction>
          <BigButton variant="secondary" testId="no-box" onClick={() => bind(null)}>Без короба — пакет с QR заказа</BigButton>
        </StickyAction>
      </div>
    )
  }

  if (!line || !product || !cell) return <PickDone order={order} />

  const atCell = !!cellOk[line.id]
  const remaining = line.qty - line.pickedQty

  const onScan = (code: string) => {
    const r = S.resolveCode(s, code)
    if (!atCell) {
      if (r.kind === 'cell' && r.cell.id === cell.id) {
        flashOk()
        setCellOk({ ...cellOk, [line.id]: true })
        return
      }
      showError({
        tone: 'err',
        title: r.kind === 'cell' ? `Это не ячейка ${cell.code}` : r.kind === 'product' ? 'Сначала ячейка' : 'Неизвестный код',
        reason: r.kind === 'product' ? `Отсканируйте QR ячейки ${cell.code}, затем товар.` : `Идите к ячейке ${cell.code}.`,
        expected: { caption: 'Нужна ячейка', primary: cell.code },
        scanned: { caption: 'Отсканировано', primary: r.kind === 'cell' ? r.cell.code : code, secondary: r.kind === 'product' ? r.product.name : undefined },
      })
      return
    }
    if (r.kind === 'cell') {
      if (r.cell.id === cell.id) return flashOk()
      showError({ tone: 'err', title: `Это не ячейка ${cell.code}`, reason: 'Вы уже у нужной ячейки — сканируйте товар.', expected: { caption: 'Нужна ячейка', primary: cell.code }, scanned: { caption: 'Отсканировано', primary: r.cell.code } })
      return
    }
    if (r.kind !== 'product' || r.product.id !== product.id) {
      showError({
        tone: 'err',
        title: 'Неверный товар',
        reason: 'Верните его на место. Сборка не продолжится, пока не будет отсканирован нужный товар.',
        expected: { caption: 'Ожидалось', primary: product.sku, secondary: `${product.name}` },
        scanned: r.kind === 'product'
          ? { caption: 'Отсканировано', primary: r.product.sku, secondary: r.product.name }
          : { caption: 'Отсканировано', primary: code, secondary: 'Код не найден в справочнике' },
      })
      return
    }
    confirm(1)
  }

  const confirm = (qty: number) => {
    try {
      runOp(`Сборка №${order.number}: ${product.sku} × ${qty}`, () =>
        S.confirmPick(ctx, { taskId: task.id, lineId: line.id, cellId: cell.id, productId: product.id, qty }))
      flashOk(line.pickedQty + qty >= line.qty)
    } catch (e) {
      showError({ tone: 'err', title: 'Нельзя взять', reason: e instanceof Error ? e.message : String(e) })
    }
  }

  return (
    <div className="pb-48">
      <OpHeader
        title={`Заказ №${order.number}`}
        step={`${lineNo}/${task.lines.length}`}
        onBack={() => nav('/m/pick')}
        right={<span className="mr-2"><BoxTag code={box.code} /></span>}
      />
      <Progress done={task.lines.filter((l) => l.pickedQty >= l.qty).length} total={task.lines.length} />

      <div className="px-4 pt-4">
        <div className={cx('rounded-2xl border bg-card p-4 shadow-sm transition-all', atCell ? 'border-border/70' : 'border-primary ring-[3px] ring-primary/20')}>
          <div className="flex items-center justify-between">
            <div className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground/80">Идите</div>
            {atCell && <span className="inline-flex items-center gap-1 text-success text-[13px] font-semibold"><CheckCircle2 size={16} /> На месте</span>}
          </div>
          <div className="mt-2"><CellTag code={cell.code} size="xl" /></div>
        </div>

        <div className={cx('mt-3 rounded-2xl border bg-card p-4 shadow-sm transition-all', atCell ? 'border-primary ring-[3px] ring-primary/20' : 'border-border/70')}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground/80">Возьмите</div>
              <div className="mt-1 text-[52px] leading-none font-bold tnum" data-testid="take-qty">
                {remaining}<span className="text-2xl font-medium text-muted-foreground/80 ml-2">{product.unit}</span>
              </div>
              {line.pickedQty > 0 && <div className="text-[14px] text-success font-medium mt-1">Взято {line.pickedQty} из {line.qty}</div>}
            </div>
            <ProductThumb product={product} size={104} className="rounded-xl" />
          </div>
          <div className="mt-3 text-[19px] font-semibold leading-snug">{product.name}</div>
          <div className="mt-1 flex flex-wrap gap-x-3 text-[14px] text-muted-foreground">
            <span className="font-mono">{product.sku}</span>
            {describe(product) && <span>{describe(product)}</span>}
          </div>
        </div>

        <div className="mt-4">
          <ScanPad
            compact
            onScan={onScan}
            prompt={atCell ? `Сканируйте товар${remaining > 1 ? ' — каждую единицу' : ''}` : `Сканируйте ячейку ${cell.code}`}
            demo={atCell ? productCodes(s, product.id, 4) : cellCodes(s, cell.id, 4)}
            demoEnabled={org.settings.demoScanner}
          />
        </div>
      </div>

      <StickyAction>
        {atCell && line.pickedQty > 0 && remaining > 0 ? (
          <BigButton variant="ok" testId="confirm-rest" onClick={() => confirm(remaining)}>
            Взял ещё {remaining} — всего {line.qty} {product.unit}
          </BigButton>
        ) : (
          <div className="h-16 rounded-xl bg-muted text-muted-foreground grid place-items-center text-[15px] text-center px-4 leading-snug">
            {atCell ? 'Подтверждение — только сканом товара' : 'Сначала подойдите к ячейке и сканируйте её'}
          </div>
        )}
        <button onClick={() => nav('/m/pick')} className="h-11 text-[15px] text-muted-foreground font-medium inline-flex items-center justify-center gap-1.5"><Pause size={16} /> Пауза — вернуться позже</button>
      </StickyAction>
      <span hidden data-testid="expected-barcode">{barcodeOf(s, product.id)}</span>
    </div>
  )
}

function Progress({ done, total }: { done: number; total: number }) {
  return (
    <div className="bg-card px-4 pb-2.5 -mt-1 relative z-20">
      <div className="flex gap-1">
        {Array.from({ length: total }).map((_, i) => (
          <span key={i} className={cx('h-1.5 flex-1 rounded-full', i < done ? 'bg-primary' : i === done ? 'bg-foreground/40' : 'bg-muted')} />
        ))}
      </div>
    </div>
  )
}

function OrderQr({ order }: { order: Order }) {
  const [src, setSrc] = useState('')
  useEffect(() => { void QRCode.toDataURL(`ORD-${order.number}`, { margin: 0, scale: 6 }).then(setSrc) }, [order.number])
  const { s } = useApp()
  const items = s.orderItems.filter((i) => i.orderId === order.id)
  return (
    <div className="wms-panel p-4 flex items-center gap-4">
      {src && <img src={src} alt={`QR заказа ${order.number}`} className="w-[92px] h-[92px]" />}
      <div className="min-w-0">
        <div className="text-[13px] uppercase tracking-wide font-semibold text-muted-foreground/80">QR заказа</div>
        <div className="font-mono text-[26px] font-semibold leading-tight">ORD-{order.number}</div>
        <div className="text-[14px] text-muted-foreground">{S.CHANNEL_LABEL[order.channel]} · {items.reduce((a, i) => a + i.qty, 0)} шт.</div>
      </div>
    </div>
  )
}

function PickDone({ order }: { order: Order }) {
  const { s } = useApp()
  const nav = useNavigate()
  const box = s.containers.find((c) => c.id === order.containerId)
  const next = useMemo(() => s.orders.filter((o) => o.status === 'to_pick').sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0], [s])
  return (
    <DoneScreen
      title={<>Заказ №{order.number} собран</>}
      text={<>Отнесите {box ? <>короб <b className="font-mono text-foreground">{box.code}</b></> : 'товар'} на стол упаковки.</>}
      primary={next ? { label: 'Следующий заказ', onClick: () => nav('/m/pick'), testId: 'next-order' } : undefined}
      secondary={{ label: 'На главную', onClick: () => nav('/m') }}
    />
  )
}

function Missing() {
  return (
    <div>
      <OpHeader title="Сборка" />
      <div className="p-6 text-center">
        <Box className="mx-auto text-muted-foreground/80" size={40} />
        <div className="mt-3 font-semibold">Заказ не найден</div>
        <Link to="/m/pick" className="mt-4 inline-block link font-medium">К списку заказов</Link>
      </div>
    </div>
  )
}
