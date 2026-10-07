import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ChevronRight, Truck, Zap } from 'lucide-react'
import { useApp } from '@/app/state'
import * as S from '@/domain/services'
import { DomainError } from '@/domain/db'
import { runOp } from '@/lib/net'
import { usePersistentState } from '@/lib/persist'
import { ScanPad } from '@/scan/ScanPad'
import { flashOk, showError } from '@/scan/signals'
import { CellTag, toast } from '@/ui/kit'
import { BigButton, HiddenScan, Numpad, OpHeader, ProductLine, Section, StickyAction } from './common'
import { cellCodes, productCodes } from './demo'
import { cx, fmtTime } from '@/lib/format'

type Step = 'pick-receipt' | 'product' | 'qty' | 'cell' | 'confirm'
interface Draft {
  step: Step
  receiptId?: string
  productId?: string
  qty: number
  cellId?: string
  placed: { productId: string; qty: number; cellCode: string; ts: string }[]
}
const START: Draft = { step: 'pick-receipt', qty: 1, placed: [] }

export function MobileReceive() {
  const { s, ctx, org } = useApp()
  const nav = useNavigate()
  const [d, setD] = usePersistentState<Draft>(`receive/${ctx.userId}`, START)
  const set = (p: Partial<Draft>) => setD({ ...d, ...p })
  const quick = org.settings.quickReceive
  const product = s.products.find((p) => p.id === d.productId)
  const receipt = s.receipts.find((r) => r.id === d.receiptId)
  const suggested = useMemo(() => (d.productId ? S.suggestCell(s, d.productId) : undefined), [s, d.productId])
  const cell = s.cells.find((c) => c.id === d.cellId)
  const openReceipts = s.receipts.filter((r) => r.status !== 'done')

  const stepNo = { 'pick-receipt': 0, product: 1, qty: 2, cell: 3, confirm: 4 }[d.step]

  const onProduct = (code: string) => {
    const r = S.resolveCode(s, code)
    if (r.kind !== 'product') {
      showError({
        tone: 'err',
        title: r.kind === 'cell' ? 'Это ячейка, а не товар' : 'Товар не найден',
        reason: r.kind === 'cell' ? 'Сначала отсканируйте товар, потом — ячейку.' : 'Такого штрихкода нет в справочнике. Попросите владельца добавить товар или проверьте этикетку.',
        scanned: { caption: 'Отсканировано', primary: code },
      })
      return
    }
    if (r.product.archived) {
      showError({ tone: 'err', title: 'Товар в архиве', reason: `«${r.product.name}» снят с учёта. Обратитесь к владельцу.` })
      return
    }
    // Scanning the same item again while entering quantity = +1 (scan each unit mode)
    if (d.step === 'qty' && r.product.id === d.productId) {
      flashOk()
      set({ qty: d.qty + 1 })
      return
    }
    if (receipt && !receipt.lines.some((l) => l.productId === r.product.id)) {
      showError({
        tone: 'warn',
        title: 'Этого товара нет в поставке',
        reason: `В поставке ${receipt.number} от «${receipt.supplier}» такой позиции нет. Проверьте, тот ли это товар.`,
        scanned: { caption: 'Отсканировано', primary: r.product.sku, secondary: r.product.name },
        dismissLabel: 'Отложить товар',
        confirm: { label: 'Всё равно принять сверх поставки', onConfirm: () => setD({ ...d, productId: r.product.id, qty: 1, step: 'qty' }) },
      })
      return
    }
    flashOk()
    setD({ ...d, productId: r.product.id, qty: 1, step: 'qty' })
  }

  const onCell = (code: string) => {
    const r = S.resolveCode(s, code)
    if (r.kind !== 'cell') {
      showError({
        tone: 'err',
        title: 'Это не ячейка',
        reason: 'Отсканируйте QR-код на стеллаже.',
        expected: suggested ? { caption: 'Рекомендуемая ячейка', primary: suggested.code } : undefined,
        scanned: { caption: 'Отсканировано', primary: code, secondary: r.kind === 'product' ? r.product.name : undefined },
      })
      return
    }
    const accept = () => {
      if (quick) commit(r.cell.id)
      else { flashOk(); setD({ ...d, cellId: r.cell.id, step: 'confirm' }) }
    }
    if (suggested && r.cell.id !== suggested.id) {
      const content = S.cellContents(s, r.cell.id).filter((x) => x.product.id !== d.productId)
      showError({
        tone: 'warn',
        title: 'Не та ячейка',
        reason: content.length
          ? `В ${r.cell.code} уже лежит другой товар (${content.map((x) => x.product.sku).join(', ')}). Смешивание SKU в ячейке — частая причина пересорта.`
          : `Система рекомендовала ${suggested.code}.`,
        expected: { caption: 'Рекомендуемая', primary: suggested.code },
        scanned: { caption: 'Отсканировано', primary: r.cell.code },
        dismissLabel: `Положу в ${suggested.code}`,
        confirm: { label: `Положить в ${r.cell.code}`, onConfirm: accept },
      })
      return
    }
    accept()
  }

  const commit = (cellId: string) => {
    if (!product) return
    const c = s.cells.find((x) => x.id === cellId)!
    try {
      runOp(`Приёмка ${product.sku} × ${d.qty} → ${c.code}`, () =>
        S.receive(ctx, { productId: product.id, qty: d.qty, cellId, receiptId: d.receiptId }))
      flashOk(true)
      toast(`Размещено: ${d.qty} шт. в ${c.code}`)
      setD({ ...d, step: 'product', productId: undefined, cellId: undefined, qty: 1, placed: [{ productId: product.id, qty: d.qty, cellCode: c.code, ts: new Date().toISOString() }, ...d.placed] })
    } catch (e) {
      showError({ tone: 'err', title: 'Не удалось принять', reason: e instanceof DomainError ? e.message : String(e) })
    }
  }

  const finish = () => {
    if (receipt) {
      const allDone = receipt.lines.every((l) => l.receivedQty >= l.expectedQty)
      if (allDone) runOp(`Закрыта поставка ${receipt.number}`, () => S.closeReceipt(ctx, receipt.id))
    }
    setD(START)
    nav('/m')
  }

  const back = () => {
    if (d.step === 'qty') set({ step: 'product', productId: undefined })
    else if (d.step === 'cell') set({ step: 'qty' })
    else if (d.step === 'confirm') set({ step: 'cell', cellId: undefined })
    else if (d.step === 'product' && !d.placed.length) set({ step: 'pick-receipt', receiptId: undefined })
    else nav('/m')
  }

  return (
    <div className="pb-44">
      <OpHeader
        title={receipt ? `Приёмка · ${receipt.number}` : 'Приёмка'}
        step={stepNo > 0 ? `${stepNo}/${quick ? 3 : 4}` : undefined}
        onBack={back}
        right={quick && d.step !== 'pick-receipt' ? <span className="mr-2 inline-flex items-center gap-1 text-[12px] text-signal font-medium"><Zap size={13} />Быстро</span> : undefined}
      />

      <div className="px-4 pt-4">
        {d.step === 'pick-receipt' && (
          <>
            <button
              onClick={() => set({ step: 'product', receiptId: undefined })}
              className="w-full text-left rounded-2xl bg-night text-white px-5 py-5 active:translate-y-px"
              data-testid="quick-receive"
            >
              <div className="flex items-center gap-2 text-signal text-[13px] font-semibold uppercase tracking-wide"><Zap size={15} />Без документа</div>
              <div className="text-[22px] font-semibold mt-1">Принять товар</div>
              <div className="text-white/70 text-[15px] mt-0.5">товар → количество → ячейка</div>
            </button>
            {openReceipts.length > 0 && (
              <Section title="Ожидаемые поставки">
                <div className="grid gap-2">
                  {openReceipts.map((r) => {
                    const exp = r.lines.reduce((a, l) => a + l.expectedQty, 0)
                    const got = r.lines.reduce((a, l) => a + l.receivedQty, 0)
                    return (
                      <button key={r.id} onClick={() => set({ step: 'product', receiptId: r.id })} className="text-left bg-surface border border-line rounded-xl px-4 py-3.5 flex items-center gap-3 active:bg-sunken">
                        <Truck size={22} className="text-ink-2 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-[16px] truncate">{r.supplier}</div>
                          <div className="text-[13px] text-ink-2 font-mono">{r.number} · {r.lines.length} поз. · {got}/{exp} шт.</div>
                        </div>
                        <ChevronRight size={20} className="text-ink-3" />
                      </button>
                    )
                  })}
                </div>
              </Section>
            )}
          </>
        )}

        {d.step === 'product' && (
          <>
            <ScanPad onScan={onProduct} prompt="Шаг 1 · Сканируйте товар" demo={receipt ? productCodes(s, receipt.lines.find((l) => l.receivedQty < l.expectedQty)?.productId) : productCodes(s)} demoEnabled={org.settings.demoScanner} />
            {receipt && <ReceiptProgress receipt={receipt} />}
          </>
        )}

        {d.step === 'qty' && product && (
          <>
            <div className="bg-surface rounded-2xl border border-line p-4"><ProductLine product={product} /></div>
            <div className="mt-2 mb-4 text-[14px] text-ink-2 px-1">
              Укажите количество — или сканируйте каждую единицу, счётчик прибавится сам.
              {receipt && (() => { const l = receipt.lines.find((x) => x.productId === product.id); return l ? <> По поставке: <b className="text-ink">{l.expectedQty - l.receivedQty} шт.</b> осталось.</> : null })()}
            </div>
            <Numpad value={d.qty} onChange={(qty) => set({ qty })} unit={product.unit} />
            <HiddenScan onScan={onProduct} />
            <StickyAction>
              <BigButton testId="qty-next" disabled={d.qty < 1} onClick={() => { flashOk(); set({ step: 'cell' }) }}>
                Дальше — в ячейку <ChevronRight size={22} />
              </BigButton>
            </StickyAction>
          </>
        )}

        {d.step === 'cell' && product && (
          <>
            <div className="bg-surface rounded-2xl border border-line p-3 mb-3">
              <ProductLine product={product} size={44} right={<span className="text-[22px] font-semibold tnum pr-1">{d.qty}<span className="text-sm text-ink-3 ml-1">{product.unit}</span></span>} />
            </div>
            <ScanPad
              compact
              onScan={onCell}
              prompt="Шаг 3 · Сканируйте ячейку"
              target={suggested ? (
                <div className="flex items-center gap-3">
                  <span className="text-[15px] text-ink-2">Рекомендуем</span>
                  <CellTag code={suggested.code} size="lg" />
                </div>
              ) : <span className="text-ink-2">Создайте ячейки на компьютере</span>}
              demo={cellCodes(s, suggested?.id)}
              demoEnabled={org.settings.demoScanner}
            />
          </>
        )}

        {d.step === 'confirm' && product && cell && (
          <>
            <div className="rounded-2xl bg-surface border border-line overflow-hidden">
              <div className="p-4"><ProductLine product={product} /></div>
              <div className="grid grid-cols-2 border-t border-line">
                <div className="p-4 border-r border-line">
                  <div className="text-[12px] uppercase tracking-wide text-ink-3 font-medium">Количество</div>
                  <div className="text-[34px] font-semibold tnum leading-tight">{d.qty} <span className="text-base text-ink-3">{product.unit}</span></div>
                </div>
                <div className="p-4">
                  <div className="text-[12px] uppercase tracking-wide text-ink-3 font-medium mb-1.5">Ячейка</div>
                  <CellTag code={cell.code} size="lg" />
                </div>
              </div>
            </div>
            <StickyAction>
              <BigButton variant="ok" testId="confirm-receive" onClick={() => commit(cell.id)}><Check size={24} /> Подтвердить размещение</BigButton>
            </StickyAction>
          </>
        )}

        {d.step !== 'pick-receipt' && d.placed.length > 0 && (
          <Section title={`Принято за сессию · ${d.placed.reduce((a, x) => a + x.qty, 0)} шт.`} right={<button onClick={finish} className="text-[14px] font-semibold text-info">Завершить</button>}>
            <div className="bg-surface rounded-xl border border-line divide-y divide-line">
              {d.placed.slice(0, 8).map((x, i) => {
                const p = s.products.find((pp) => pp.id === x.productId)
                return (
                  <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="font-mono text-[12px] text-ink-3 w-10">{fmtTime(x.ts)}</span>
                    <span className="flex-1 min-w-0 truncate text-[14px]">{p?.name}</span>
                    <span className="tnum font-semibold text-[15px]">{x.qty}</span>
                    <CellTag code={x.cellCode} size="sm" />
                  </div>
                )
              })}
            </div>
          </Section>
        )}
      </div>
    </div>
  )
}

function ReceiptProgress({ receipt }: { receipt: NonNullable<ReturnType<typeof useApp>['s']['receipts'][number]> }) {
  const { s } = useApp()
  return (
    <Section title="По поставке">
      <div className="bg-surface rounded-xl border border-line divide-y divide-line">
        {receipt.lines.map((l) => {
          const p = s.products.find((x) => x.id === l.productId)
          const done = l.receivedQty >= l.expectedQty
          return (
            <div key={l.productId} className="flex items-center gap-3 px-4 py-3">
              <span className={cx('h-5 w-5 rounded-full grid place-items-center shrink-0', done ? 'bg-ok text-white' : 'border-2 border-line-2')}>{done && <Check size={13} strokeWidth={3} />}</span>
              <span className="flex-1 min-w-0 truncate text-[15px]">{p?.name}</span>
              <span className="tnum text-[15px] font-semibold">{l.receivedQty}<span className="text-ink-3 font-normal">/{l.expectedQty}</span></span>
            </div>
          )
        })}
      </div>
    </Section>
  )
}
