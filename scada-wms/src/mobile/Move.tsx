import { useNavigate } from 'react-router-dom'
import { ArrowDown, Check, ChevronRight } from 'lucide-react'
import { useApp } from '@/app/state'
import * as S from '@/domain/services'
import { runOp } from '@/lib/net'
import { usePersistentState } from '@/lib/persist'
import { ScanPad } from '@/scan/ScanPad'
import { flashOk, showError } from '@/scan/signals'
import { CellTag, ProductThumb, toast } from '@/ui/kit'
import { BigButton, Numpad, OpHeader, ProductLine, Section, StickyAction } from './common'
import { cellCodes, productCodes } from './demo'

type Step = 'start' | 'from' | 'pickFromCell' | 'qty' | 'to'
interface Draft { step: Step; via?: 'product' | 'cell'; productId?: string; fromId?: string; qty: number }
const START: Draft = { step: 'start', qty: 1 }

export function MobileMove() {
  const { s, ctx, org } = useApp()
  const nav = useNavigate()
  const [d, setD] = usePersistentState<Draft>(`move/${ctx.userId}`, START)
  const set = (p: Partial<Draft>) => setD({ ...d, ...p })
  const product = s.products.find((p) => p.id === d.productId)
  const from = s.cells.find((c) => c.id === d.fromId)
  const where = product ? S.productStock(s, product.id).cells : []
  const fromBal = product && from ? s.stock.find((b) => b.productId === product.id && b.locationType === 'cell' && b.locationId === from.id) : undefined
  const free = fromBal ? fromBal.qty - fromBal.reserved : 0

  const onStart = (code: string) => {
    const r = S.resolveCode(s, code)
    if (r.kind === 'product') {
      const cells = S.productStock(s, r.product.id).cells
      if (!cells.length) {
        showError({ tone: 'err', title: 'Товара нет на остатках', reason: `«${r.product.name}» не числится ни в одной ячейке.` })
        return
      }
      flashOk()
      setD({ ...START, step: 'from', via: 'product', productId: r.product.id })
    } else if (r.kind === 'cell') {
      if (!S.cellContents(s, r.cell.id).length) {
        showError({ tone: 'warn', title: 'Ячейка пустая', reason: `По системе в ${r.cell.code} ничего нет.` })
        return
      }
      flashOk()
      setD({ ...START, step: 'pickFromCell', via: 'cell', fromId: r.cell.id })
    } else {
      showError({ tone: 'err', title: 'Неизвестный код', reason: 'Отсканируйте товар или ячейку.', scanned: { caption: 'Отсканировано', primary: code } })
    }
  }

  const onFrom = (code: string) => {
    const r = S.resolveCode(s, code)
    if (r.kind !== 'cell') {
      showError({ tone: 'err', title: 'Это не ячейка', reason: 'Отсканируйте ячейку, откуда берёте товар.', scanned: { caption: 'Отсканировано', primary: code } })
      return
    }
    const here = where.find((w) => w.cell.id === r.cell.id)
    if (!here) {
      showError({
        tone: 'err',
        title: `В ${r.cell.code} нет этого товара`,
        reason: <>По системе «{product?.name}» лежит в: {where.map((w) => `${w.cell.code} — ${w.qty} шт.`).join(', ')}</>,
      })
      return
    }
    flashOk()
    const f = here.qty - here.reserved
    setD({ ...d, step: 'qty', fromId: r.cell.id, qty: Math.max(1, f) })
  }

  const onCellProduct = (code: string) => {
    const r = S.resolveCode(s, code)
    const content = from ? S.cellContents(s, from.id) : []
    if (r.kind !== 'product' || !content.some((c) => c.product.id === r.product.id)) {
      showError({ tone: 'err', title: 'Этого товара нет в ячейке', reason: `Выберите товар из списка содержимого ${from?.code}.` })
      return
    }
    choose(r.product.id)
  }
  const choose = (productId: string) => {
    const b = s.stock.find((x) => x.productId === productId && x.locationType === 'cell' && x.locationId === d.fromId)
    flashOk()
    setD({ ...d, step: 'qty', productId, qty: Math.max(1, b ? b.qty - b.reserved : 1) })
  }

  const onTo = (code: string) => {
    const r = S.resolveCode(s, code)
    if (r.kind !== 'cell') {
      showError({ tone: 'err', title: 'Это не ячейка', reason: 'Отсканируйте ячейку, куда кладёте товар.', scanned: { caption: 'Отсканировано', primary: code } })
      return
    }
    if (!product || !from) return
    try {
      runOp(`Перемещение ${product.sku} × ${d.qty}: ${from.code} → ${r.cell.code}`, () =>
        S.move(ctx, { productId: product.id, fromCellId: from.id, toCellId: r.cell.id, qty: d.qty }))
      flashOk(true)
      toast(`${d.qty} шт. ${from.code} → ${r.cell.code}`)
      setD(START)
    } catch (e) {
      showError({ tone: 'err', title: 'Нельзя переместить', reason: e instanceof Error ? e.message : String(e) })
    }
  }

  const back = () => {
    if (d.step === 'start') nav('/m')
    else if (d.step === 'qty') set(d.via === 'cell' ? { step: 'pickFromCell', productId: undefined } : { step: 'from', fromId: undefined })
    else if (d.step === 'to') set({ step: 'qty' })
    else setD(START)
  }

  const fromTo = (
    <div className="wms-panel p-3 mb-3">
      {product && <ProductLine product={product} size={44} />}
      {from && (
        <div className="flex items-center gap-2 mt-3 text-[15px]">
          <span className="text-muted-foreground">Из</span><CellTag code={from.code} />
          {d.step === 'to' && <><span className="text-muted-foreground ml-2">Кол-во</span><b className="tnum text-[18px]">{d.qty}</b></>}
        </div>
      )}
    </div>
  )

  return (
    <div className="pb-40">
      <OpHeader title="Перемещение" onBack={back} step={{ start: '1/4', from: '2/4', pickFromCell: '2/4', qty: '3/4', to: '4/4' }[d.step]} />
      <div className="px-4 pt-4">
        {d.step === 'start' && (
          <ScanPad onScan={onStart} prompt="Сканируйте товар или ячейку" target={<span className="text-[15px] text-muted-foreground">Ячейка покажет всё своё содержимое.</span>} demo={[...productCodes(s, undefined, 3), ...cellCodes(s, undefined, 3)]} demoEnabled={org.settings.demoScanner} />
        )}

        {d.step === 'from' && product && (
          <>
            {fromTo}
            <ScanPad compact onScan={onFrom} prompt="Сканируйте ячейку, откуда берёте" demo={cellCodes(s, where[0]?.cell.id, 3)} demoEnabled={org.settings.demoScanner} />
            <Section title="По системе лежит">
              <div className="wms-panel divide-y divide-border">
                {where.map((w) => (
                  <div key={w.cell.id} className="flex items-center px-4 py-3 gap-3">
                    <CellTag code={w.cell.code} />
                    <span className="flex-1" />
                    <span className="tnum font-semibold text-[17px]">{w.qty} шт.</span>
                    {w.reserved > 0 && <span className="text-[12px] text-amber-800">резерв {w.reserved}</span>}
                  </div>
                ))}
              </div>
            </Section>
          </>
        )}

        {d.step === 'pickFromCell' && from && (
          <>
            <div className="flex items-center gap-3 mb-3"><span className="text-muted-foreground">Ячейка</span><CellTag code={from.code} size="lg" /></div>
            <ScanPad compact onScan={onCellProduct} prompt="Сканируйте товар или выберите из списка" demo={S.cellContents(s, from.id).map((c) => ({ code: s.barcodes.find((b) => b.productId === c.product.id)?.code ?? c.product.sku, label: c.product.name, tone: 'ok' as const }))} demoEnabled={org.settings.demoScanner} />
            <Section title="Содержимое ячейки">
              <div className="grid gap-2">
                {S.cellContents(s, from.id).map((c) => (
                  <button key={c.product.id} onClick={() => choose(c.product.id)} className="text-left wms-panel px-3 py-3 flex items-center gap-3 active:bg-muted">
                    <ProductThumb product={c.product} size={44} />
                    <div className="flex-1 min-w-0"><div className="font-semibold text-[15px] leading-tight">{c.product.name}</div><div className="font-mono text-[13px] text-muted-foreground">{c.product.sku}</div></div>
                    <span className="tnum font-semibold text-[18px]">{c.qty}</span>
                    <ChevronRight size={18} className="text-muted-foreground/80" />
                  </button>
                ))}
              </div>
            </Section>
          </>
        )}

        {d.step === 'qty' && product && from && (
          <>
            {fromTo}
            {fromBal && fromBal.reserved > 0 && (
              <div className="mb-3 rounded-xl bg-amber-500/10 text-amber-800 px-4 py-3 text-[14px]">{fromBal.reserved} шт. зарезервировано под заказы — переместить можно {free} шт.</div>
            )}
            <Numpad value={d.qty} onChange={(qty) => set({ qty })} max={free} unit={product.unit} />
            <StickyAction>
              <BigButton disabled={d.qty < 1 || d.qty > free} onClick={() => { flashOk(); set({ step: 'to' }) }} testId="move-qty-next">
                Дальше — куда положить <ChevronRight size={22} />
              </BigButton>
            </StickyAction>
          </>
        )}

        {d.step === 'to' && product && from && (
          <>
            {fromTo}
            <div className="flex justify-center -mt-1 mb-2 text-muted-foreground/80"><ArrowDown size={22} /></div>
            <ScanPad compact onScan={onTo} prompt="Сканируйте новую ячейку" demo={cellCodes(s, undefined, 5).filter((c) => c.code !== from.code)} demoEnabled={org.settings.demoScanner} />
            <div className="mt-3 text-[14px] text-muted-foreground flex items-center gap-2"><Check size={16} className="text-success" /> После скана перемещение сохранится сразу</div>
          </>
        )}
      </div>
    </div>
  )
}
