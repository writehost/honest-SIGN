import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Check, ChevronRight, RotateCcw, Trash2 } from 'lucide-react'
import { useApp } from '@/app/state'
import * as S from '@/domain/services'
import { runOp } from '@/lib/net'
import { usePersistentState } from '@/lib/persist'
import { ScanPad } from '@/scan/ScanPad'
import { flashOk, showError } from '@/scan/signals'
import { BoxTag, ProductThumb } from '@/ui/kit'
import { BigButton, DoneScreen, OpHeader, Section, StickyAction } from './common'
import { barcodeOf, productCodes } from './demo'
import { cx, plural } from '@/lib/format'
import type { Order } from '@/domain/types'

interface PackDraft {
  orderId?: string
  counts: Record<string, number>
  /** Scanned units that do not belong in the parcel. Each must be removed explicitly. */
  extras: { key: string; code: string; label: string; reason: 'foreign' | 'over' }[]
  doneOrderId?: string
}
const START: PackDraft = { counts: {}, extras: [] }

export function MobilePack() {
  const { s, ctx, org } = useApp()
  const nav = useNavigate()
  const [d, setD] = usePersistentState<PackDraft>(`pack/${ctx.userId}`, START)
  const order = s.orders.find((o) => o.id === d.orderId && o.status === 'picked')
  const waiting = s.orders.filter((o) => o.status === 'picked').sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  const open = (o: Order) => {
    if (o.status !== 'picked') {
      showError({
        tone: 'err',
        title: o.status === 'packed' || o.status === 'shipped' ? 'Заказ уже упакован' : 'Заказ ещё не собран',
        reason: `Заказ №${o.number} в статусе «${S.STATUS_LABEL[o.status]}».`,
      })
      return
    }
    flashOk()
    setD({ ...START, orderId: o.id })
  }

  if (d.doneOrderId) {
    const done = s.orders.find((o) => o.id === d.doneOrderId)
    return (
      <DoneScreen
        title={<>Заказ №{done?.number} упакован</>}
        text="Комплектность проверена. Можно закрывать коробку и клеить этикетку маркетплейса."
        primary={waiting.length > 0 ? { label: `Следующий заказ · ещё ${waiting.length}`, onClick: () => setD(START), testId: 'pack-next' } : undefined}
        secondary={{ label: 'На главную', onClick: () => { setD(START); nav('/m') } }}
      />
    )
  }

  if (!order) {
    const onScan = (code: string) => {
      const r = S.resolveCode(s, code)
      if (r.kind === 'order') return open(r.order)
      if (r.kind === 'container') {
        const o = s.orders.find((x) => x.id === r.container.orderId)
        if (o) return open(o)
        showError({ tone: 'err', title: 'Короб пустой', reason: `Короб ${r.container.code} не привязан ни к одному заказу.` })
        return
      }
      showError({
        tone: 'err',
        title: 'Сначала заказ',
        reason: 'Отсканируйте QR заказа или сборочного короба, потом товары.',
        scanned: { caption: 'Отсканировано', primary: code, secondary: r.kind === 'product' ? r.product.name : undefined },
      })
    }
    return (
      <div className="pb-10">
        <OpHeader title="Упаковка" />
        <div className="px-4 pt-4">
          <ScanPad
            onScan={onScan}
            prompt="Сканируйте короб или QR заказа"
            demo={waiting.slice(0, 4).map((o) => {
              const box = s.containers.find((c) => c.id === o.containerId)
              return { code: box?.code ?? `ORD-${o.number}`, label: `Заказ №${o.number}`, tone: 'ok' as const }
            })}
            demoEnabled={org.settings.demoScanner}
          />
          <Section title={`Ждут упаковки · ${waiting.length}`}>
            {waiting.length === 0 ? (
              <div className="wms-panel px-4 py-8 text-center text-muted-foreground">Нет собранных заказов</div>
            ) : (
              <div className="grid gap-2">
                {waiting.map((o) => {
                  const box = s.containers.find((c) => c.id === o.containerId)
                  const n = s.orderItems.filter((i) => i.orderId === o.id).reduce((a, i) => a + i.qty, 0)
                  return (
                    <button key={o.id} onClick={() => open(o)} className="text-left wms-panel px-4 py-3.5 flex items-center gap-3 active:bg-muted">
                      <div className="flex-1">
                        <div className="font-mono text-[19px] font-semibold">№{o.number}</div>
                        <div className="text-[14px] text-muted-foreground">{S.CHANNEL_LABEL[o.channel]} · {n} шт.</div>
                      </div>
                      {box && <BoxTag code={box.code} />}
                      <ChevronRight size={20} className="text-muted-foreground/80" />
                    </button>
                  )
                })}
              </div>
            )}
          </Section>
        </div>
      </div>
    )
  }

  const items = s.orderItems.filter((i) => i.orderId === order.id)
  const box = s.containers.find((c) => c.id === order.containerId)
  const missing = items.reduce((a, i) => a + Math.max(0, i.qty - (d.counts[i.productId] ?? 0)), 0)
  const total = items.reduce((a, i) => a + i.qty, 0)
  const ready = missing === 0 && d.extras.length === 0

  const onScan = (code: string) => {
    const r = S.resolveCode(s, code)
    if (r.kind === 'order' || r.kind === 'container') {
      showError({ tone: 'warn', title: 'Вы уже проверяете заказ', reason: `Сейчас открыт №${order.number}. Закончите его или сбросьте проверку.` })
      return
    }
    if (r.kind !== 'product') {
      showError({ tone: 'err', title: 'Неизвестный код', reason: 'Такого товара нет в справочнике. Отложите его в сторону.', scanned: { caption: 'Отсканировано', primary: code } })
      return
    }
    const it = items.find((i) => i.productId === r.product.id)
    const key = crypto.randomUUID()
    if (!it) {
      setD({ ...d, extras: [...d.extras, { key, code: r.product.sku, label: r.product.name, reason: 'foreign' }] })
      const expected = items.filter((i) => (d.counts[i.productId] ?? 0) < i.qty).map((i) => s.products.find((p) => p.id === i.productId)!)
      showError({
        tone: 'err',
        title: 'Неверный товар',
        reason: 'Этого товара нет в заказе. Уберите его из коробки.',
        expected: expected[0] ? { caption: 'В заказе', primary: expected[0].sku, secondary: expected[0].name } : undefined,
        scanned: { caption: 'Отсканировано', primary: r.product.sku, secondary: r.product.name },
      })
      return
    }
    const have = d.counts[it.productId] ?? 0
    if (have >= it.qty) {
      setD({ ...d, extras: [...d.extras, { key, code: r.product.sku, label: r.product.name, reason: 'over' }] })
      showError({ tone: 'err', title: 'Лишняя единица', reason: `По заказу нужно ${it.qty} шт. «${r.product.name}» — все уже отсканированы. Уберите лишнюю.` })
      return
    }
    const counts = { ...d.counts, [it.productId]: have + 1 }
    setD({ ...d, counts })
    flashOk(items.every((i) => (counts[i.productId] ?? 0) >= i.qty))
  }

  const complete = () => {
    try {
      runOp(`Упаковка №${order.number}`, () => S.completePacking(ctx, order.id, d.counts, d.extras.length))
      setD({ ...START, doneOrderId: order.id })
    } catch (e) {
      showError({ tone: 'err', title: 'Нельзя завершить', reason: e instanceof Error ? e.message : String(e) })
    }
  }

  return (
    <div className="pb-48">
      <OpHeader title={`Упаковка №${order.number}`} step={`${total - missing}/${total}`} onBack={() => setD(START)} right={box && <span className="mr-2"><BoxTag code={box.code} /></span>} />
      <div className="px-4 pt-4">
        <ScanPad compact onScan={onScan} prompt="Сканируйте каждый товар, кладя его в коробку" demo={demoFor()} demoEnabled={org.settings.demoScanner} />

        {d.extras.length > 0 && (
          <Section title={<span className="text-destructive">Лишнее в коробке · {d.extras.length}</span>}>
            <div className="grid gap-2">
              {d.extras.map((x) => (
                <div key={x.key} className="rounded-xl bg-destructive/5 border border-destructive/30 px-4 py-3 flex items-center gap-3">
                  <AlertTriangle size={20} className="text-destructive shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[15px] font-semibold text-destructive">{x.reason === 'foreign' ? 'Не из этого заказа' : 'Лишняя единица'}</div>
                    <div className="text-[14px] truncate">{x.code} · {x.label}</div>
                  </div>
                  <button onClick={() => setD({ ...d, extras: d.extras.filter((e) => e.key !== x.key) })} className="h-11 px-3 rounded-lg bg-white border border-destructive/30 text-destructive text-[14px] font-semibold flex items-center gap-1.5" data-testid="remove-extra">
                    <Trash2 size={16} /> Убрал
                  </button>
                </div>
              ))}
            </div>
          </Section>
        )}

        <Section title="Ожидается в заказе" right={<button onClick={() => setD({ ...START, orderId: order.id })} className="text-[13px] text-muted-foreground inline-flex items-center gap-1"><RotateCcw size={14} />Сбросить</button>}>
          <div className="grid gap-2">
            {items.map((i) => {
              const p = s.products.find((x) => x.id === i.productId)!
              const got = d.counts[i.productId] ?? 0
              const ok = got >= i.qty
              return (
                <div key={i.id} className={cx('rounded-xl border px-3 py-3 flex items-center gap-3', ok ? 'bg-card border-primary/60 shadow-[inset_4px_0_0_var(--primary)]' : 'bg-card border-border/70 shadow-sm')}>
                  <ProductThumb product={p} size={48} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[15px] font-semibold leading-tight">{p.name}</div>
                    <div className="text-[13px] text-muted-foreground font-mono">{p.sku}</div>
                  </div>
                  <div className={cx('text-[24px] font-bold tnum', ok ? 'text-success' : 'text-foreground')}>
                    {got}<span className="text-muted-foreground/80 font-medium text-lg">/{i.qty}</span>
                  </div>
                  {ok && <Check size={22} className="text-success" strokeWidth={3} />}
                </div>
              )
            })}
          </div>
        </Section>
      </div>
      <StickyAction>
        {!ready && (
          <div className="text-[14px] text-center text-muted-foreground -mb-0.5" data-testid="pack-blocker">
            {d.extras.length > 0
              ? `Уберите лишнее: ${d.extras.length} ${plural(d.extras.length, 'единица', 'единицы', 'единиц')}`
              : `Не хватает ${missing} ${plural(missing, 'единицы', 'единиц', 'единиц')}`}
          </div>
        )}
        <BigButton variant="ok" disabled={!ready} onClick={complete} testId="complete-pack">
          <Check size={24} /> Упаковано
        </BigButton>
      </StickyAction>
    </div>
  )

  function demoFor() {
    const need = items.find((i) => (d.counts[i.productId] ?? 0) < i.qty) ?? items[0]
    const list = productCodes(s, need?.productId, 4)
    return need ? [{ code: barcodeOf(s, need.productId), label: list[0]?.label ?? '', tone: 'ok' as const }, ...list.slice(1)] : list
  }
}
