import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ChevronRight, Eye, EyeOff } from 'lucide-react'
import { useApp } from '@/app/state'
import * as S from '@/domain/services'
import { runOp } from '@/lib/net'
import { usePersistentState } from '@/lib/persist'
import { ScanPad, Sheet } from '@/scan/ScanPad'
import { flashOk, showError } from '@/scan/signals'
import { CellTag, ProductThumb, toast } from '@/ui/kit'
import { BigButton, Numpad, OpHeader, Section, StickyAction } from './common'
import { cellCodes, productCodes } from './demo'
import { cx } from '@/lib/format'

interface Draft {
  sessionId?: string
  cellId?: string
  counts: Record<string, number>
  review: boolean
  doneCells: string[]
}
const START: Draft = { counts: {}, review: false, doneCells: [] }

const VERDICT: Record<S.InvVerdict, { label: string; cls: string }> = {
  ok: { label: 'Совпало', cls: 'bg-ok-bg text-ok' },
  missing: { label: 'Не хватает', cls: 'bg-warn-bg text-warn' },
  surplus: { label: 'Лишнее', cls: 'bg-info-bg text-info' },
  foreign: { label: 'Чужой товар', cls: 'bg-err text-white' },
}

export function MobileInventory() {
  const { s, ctx, org } = useApp()
  const nav = useNavigate()
  const [d, setD] = usePersistentState<Draft>(`inventory/${ctx.userId}`, START)
  const [showExpected, setShowExpected] = useState(true)
  const [edit, setEdit] = useState<string | null>(null)
  const cell = s.cells.find((c) => c.id === d.cellId)

  const ensureSession = () => d.sessionId ?? runOp('Начата инвентаризация', () => S.startInventory(ctx))

  const onCell = (code: string) => {
    const r = S.resolveCode(s, code)
    if (r.kind !== 'cell') {
      showError({ tone: 'err', title: 'Это не ячейка', reason: 'Инвентаризация начинается со скана QR ячейки.', scanned: { caption: 'Отсканировано', primary: code } })
      return
    }
    const sessionId = ensureSession()
    flashOk()
    setD({ ...d, sessionId, cellId: r.cell.id, counts: {}, review: false })
  }

  if (!cell) {
    return (
      <div className="pb-36">
        <OpHeader title="Инвентаризация" />
        <div className="px-4 pt-4">
          <ScanPad onScan={onCell} prompt="Сканируйте QR ячейки" target={<span className="text-[15px] text-ink-2">Покажем, что там должно лежать, потом пересчитаете фактическое.</span>} demo={cellCodes(s, undefined, 6)} demoEnabled={org.settings.demoScanner} />
          {d.doneCells.length > 0 && (
            <Section title={`Проверено ячеек · ${d.doneCells.length}`}>
              <div className="flex flex-wrap gap-1.5">{d.doneCells.map((c) => <CellTag key={c} code={c} />)}</div>
            </Section>
          )}
        </div>
        {d.sessionId && (
          <StickyAction>
            <BigButton variant="secondary" onClick={() => { runOp('Инвентаризация завершена', () => S.finishInventory(ctx, d.sessionId!)); setD(START); toast('Инвентаризация завершена'); nav('/m') }}>
              Завершить инвентаризацию
            </BigButton>
          </StickyAction>
        )}
      </div>
    )
  }

  const rows = S.diffCell(s, cell.id, d.counts)
  const order: S.InvVerdict[] = ['foreign', 'surplus', 'missing', 'ok']
  rows.sort((a, b) => order.indexOf(a.verdict) - order.indexOf(b.verdict))
  const issues = rows.filter((r) => r.verdict !== 'ok')
  const counted = Object.values(d.counts).reduce((a, n) => a + n, 0)

  const onItem = (code: string) => {
    const r = S.resolveCode(s, code)
    if (r.kind === 'cell') {
      if (r.cell.id === cell.id) return flashOk()
      showError({ tone: 'warn', title: 'Другая ячейка', reason: `Сейчас пересчитывается ${cell.code}. Закончите её, затем сканируйте ${r.cell.code}.` })
      return
    }
    if (r.kind !== 'product') {
      showError({ tone: 'err', title: 'Неизвестный код', reason: 'Товара нет в справочнике. Отложите его и сообщите владельцу.', scanned: { caption: 'Отсканировано', primary: code } })
      return
    }
    const counts = { ...d.counts, [r.product.id]: (d.counts[r.product.id] ?? 0) + 1 }
    setD({ ...d, counts })
    const expected = S.cellContents(s, cell.id).some((c) => c.product.id === r.product.id)
    if (!expected && !d.counts[r.product.id]) {
      const elsewhere = S.productStock(s, r.product.id).cells
      showError({
        tone: 'warn',
        title: 'Чужой товар',
        reason: elsewhere.length
          ? <>По системе этот товар лежит в <b>{elsewhere.map((e) => `${e.cell.code} (${e.qty} шт.)`).join(', ')}</b>. Возможен пересорт — проверьте и ту ячейку.</>
          : 'По системе этого товара нет ни в одной ячейке.',
        scanned: { caption: 'Найдено в ' + cell.code, primary: r.product.sku, secondary: r.product.name },
        dismissLabel: 'Понятно — учитываю',
      })
      return
    }
    flashOk()
  }

  const apply = () => {
    const n = runOp(`Инвентаризация ${cell.code}`, () => S.commitCellCount(ctx, d.sessionId!, cell.id, d.counts))
    flashOk(true)
    toast(n ? `${cell.code}: исправлено позиций — ${n}` : `${cell.code}: всё совпало`)
    setD({ ...d, cellId: undefined, counts: {}, review: false, doneCells: [...d.doneCells.filter((c) => c !== cell.code), cell.code] })
  }

  return (
    <div className="pb-44">
      <OpHeader title="Инвентаризация" onBack={() => setD({ ...d, cellId: undefined, counts: {}, review: false })} right={<span className="mr-2"><CellTag code={cell.code} /></span>} />
      <div className="px-4 pt-4">
        {!d.review && (
          <ScanPad compact onScan={onItem} prompt="Сканируйте каждую единицу в ячейке"
            demo={[...S.cellContents(s, cell.id).map((c) => ({ code: s.barcodes.find((b) => b.productId === c.product.id)?.code ?? c.product.sku, label: `${c.product.name} — лежит здесь`, tone: 'ok' as const })), ...productCodes(s, undefined, 8).filter((p) => !S.cellContents(s, cell.id).some((c) => s.barcodes.find((b) => b.productId === c.product.id)?.code === p.code)).slice(0, 2).map((p) => ({ ...p, label: `${p.label} — чужой`, tone: 'bad' as const }))]}
            demoEnabled={org.settings.demoScanner} />
        )}

        <Section
          title={d.review ? `Итог по ${cell.code}` : `Ожидается · посчитано ${counted}`}
          right={!d.review && <button onClick={() => setShowExpected(!showExpected)} className="text-[13px] text-ink-2 inline-flex items-center gap-1">{showExpected ? <EyeOff size={14} /> : <Eye size={14} />}{showExpected ? 'Скрыть' : 'Показать'} ожидаемое</button>}
        >
          {rows.length === 0 ? (
            <div className="bg-surface border border-line rounded-xl px-4 py-6 text-center text-ink-2">По системе ячейка пустая. Сканируйте, если что-то нашли.</div>
          ) : (
            <div className="grid gap-2">
              {rows.map((r) => (
                <button key={r.productId} onClick={() => !d.review && setEdit(r.productId)} className={cx('text-left rounded-xl border px-3 py-3 bg-surface', r.verdict === 'foreign' ? 'border-err' : 'border-line')}>
                  <div className="flex items-center gap-3">
                    <ProductThumb product={r.product} size={44} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[15px] font-semibold leading-tight">{r.product.name}</div>
                      <div className="text-[13px] font-mono text-ink-2">{r.product.sku}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[22px] font-bold tnum leading-none">{r.counted}{showExpected && <span className="text-ink-3 font-medium text-base"> / {r.expected}</span>}</div>
                      {(showExpected || d.review) && (r.counted > 0 || d.review) && <span className={cx('inline-block mt-1 text-[11px] font-semibold px-1.5 py-px rounded', VERDICT[r.verdict].cls)}>{VERDICT[r.verdict].label}</span>}
                    </div>
                  </div>
                  {r.verdict === 'foreign' && r.elsewhere.length > 0 && (
                    <div className="mt-2 text-[13px] text-err font-medium">По системе: {r.elsewhere.map((e) => `${e.cell.code} — ${e.qty} шт.`).join(', ')}</div>
                  )}
                </button>
              ))}
            </div>
          )}
        </Section>
      </div>

      <StickyAction>
        {!d.review ? (
          <BigButton onClick={() => setD({ ...d, review: true })} testId="inv-review">Закончить ячейку <ChevronRight size={22} /></BigButton>
        ) : (
          <>
            <div className="text-[14px] text-center text-ink-2">{issues.length ? `Расхождений: ${issues.length}. Остатки будут исправлены по факту.` : 'Расхождений нет'}</div>
            <BigButton variant="ok" onClick={apply} testId="inv-apply"><Check size={22} /> {issues.length ? 'Применить и дальше' : 'Подтвердить и дальше'}</BigButton>
            <button onClick={() => setD({ ...d, review: false })} className="h-10 text-[15px] text-ink-2">Пересчитать</button>
          </>
        )}
      </StickyAction>

      {edit && (() => {
        const p = s.products.find((x) => x.id === edit)!
        return (
          <Sheet title="Сколько фактически?" onClose={() => setEdit(null)}>
            <div className="flex items-center gap-3 mb-4"><ProductThumb product={p} size={44} /><div className="font-semibold">{p.name}</div></div>
            <Numpad value={d.counts[edit] ?? 0} onChange={(n) => setD({ ...d, counts: { ...d.counts, [edit]: n } })} unit={p.unit} />
            <div className="mt-3"><BigButton onClick={() => setEdit(null)}>Готово</BigButton></div>
          </Sheet>
        )
      })()}
    </div>
  )
}
