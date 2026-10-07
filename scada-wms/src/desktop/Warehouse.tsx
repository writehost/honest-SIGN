import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus, Printer } from 'lucide-react'
import { useApp } from '@/app/state'
import * as S from '@/domain/services'
import { Button, CellTag, Drawer, Input, Modal, ProductThumb, toast } from '@/ui/kit'
import { CellRangeForm, LabelPreview, LabelPrinter, PageHead, QrImg } from './shared'
import { cx } from '@/lib/format'

export function Warehouse() {
  const { s, warehouse } = useApp()
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = useState<'cells' | 'boxes'>('cells')
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState<string[] | null>(null)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [printing, setPrinting] = useState<string[] | null>(null)
  const cellId = params.get('cell')

  const zones = useMemo(() => s.zones.map((z) => {
    const cells = s.cells.filter((c) => c.zoneId === z.id).sort((a, b) => a.code.localeCompare(b.code))
    const racks = new Map<string, typeof cells>()
    for (const c of cells) {
      const rack = c.code.split('-').slice(0, 2).join('-')
      racks.set(rack, [...(racks.get(rack) ?? []), c])
    }
    return { z, cells, racks: [...racks.entries()] }
  }).sort((a, b) => a.z.code.localeCompare(b.z.code)), [s])

  const load = (id: string) => s.stock.filter((b) => b.locationType === 'cell' && b.locationId === id && b.qty > 0)
  const busy = s.cells.filter((c) => load(c.id).length > 0).length
  const toggle = (code: string) => { const n = new Set(sel); if (n.has(code)) n.delete(code); else n.add(code); setSel(n) }

  return (
    <div className="max-w-[1500px]">
      <PageHead
        title="Склад и ячейки"
        sub={`${warehouse?.name ?? ''} · ${s.cells.length} ячеек, занято ${busy} · ${s.containers.filter((c) => c.code.startsWith('BOX-')).length} сборочных коробов`}
        actions={
          <>
            {sel.size > 0 && <Button onClick={() => setPrinting([...sel].sort())}><Printer size={15} />Этикетки · {sel.size}</Button>}
            <Button variant="primary" onClick={() => { setCreated(null); setCreating(true) }} data-testid="cells-new"><Plus size={16} />Ячейки</Button>
          </>
        }
      />
      <div className="flex items-center gap-1 border-b border-line mb-4">
        {(['cells', 'boxes'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cx('h-9 px-3 text-[13px] -mb-px border-b-2', tab === t ? 'border-ink font-medium' : 'border-transparent text-ink-2')}>{t === 'cells' ? 'Ячейки' : 'Сборочные короба'}</button>
        ))}
        <span className="flex-1" />
        {tab === 'cells' && s.cells.length > 0 && (
          <div className="flex items-center gap-3 pb-1.5 text-[12px] text-ink-2">
            <button onClick={() => setSel(new Set(s.cells.map((c) => c.code)))} className="hover:text-ink">Выбрать все</button>
            {sel.size > 0 && <button onClick={() => setSel(new Set())} className="hover:text-ink">Снять выбор</button>}
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-surface border border-line-2" />пусто</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-[#fff6d1] border border-[#f0d77a]" />занято</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-err-bg border border-err/40" />несколько SKU</span>
          </div>
        )}
      </div>

      {tab === 'cells' ? (
        zones.length === 0 ? (
          <div className="bg-surface border border-line rounded-xl p-10 text-center">
            <div className="font-semibold">Ячеек пока нет</div>
            <div className="text-sm text-ink-2 mt-1">Создайте диапазон, например A-01-01 → A-01-20, и распечатайте QR-этикетки.</div>
            <Button variant="primary" className="mt-4" onClick={() => setCreating(true)}>Создать ячейки</Button>
          </div>
        ) : (
          <div className="grid gap-5">
            {zones.map(({ z, cells, racks }) => (
              <section key={z.id} className="bg-surface border border-line rounded-xl">
                <div className="h-11 px-5 flex items-center gap-3 border-b border-line">
                  <span className="font-mono font-semibold">Зона {z.code}</span>
                  <span className="text-[12px] text-ink-3">{cells.length} ячеек · {racks.length} стеллаж(а)</span>
                  <span className="flex-1" />
                  <button onClick={() => setPrinting(cells.map((c) => c.code))} className="text-[12px] text-info font-medium inline-flex items-center gap-1"><Printer size={13} />Этикетки зоны</button>
                </div>
                <div className="p-4 grid gap-3">
                  {racks.map(([rack, rc]) => (
                    <div key={rack} className="flex items-start gap-3">
                      <div className="w-14 pt-2 font-mono text-[12px] text-ink-3">{rack}</div>
                      <div className="flex-1 grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(112px, 1fr))' }}>
                        {rc.map((c) => {
                          const l = load(c.id)
                          const qty = l.reduce((a, b) => a + b.qty, 0)
                          return (
                            <button
                              key={c.id}
                              onClick={(e) => (e.shiftKey || e.metaKey || e.ctrlKey || sel.size ? toggle(c.code) : setParams({ cell: c.id }))}
                              className={cx('relative text-left rounded-md border px-2.5 py-2 h-[58px] transition-colors',
                                l.length > 1 ? 'bg-err-bg border-err/40' : l.length ? 'bg-[#fff6d1] border-[#f0d77a]' : 'bg-surface border-line-2 hover:border-ink-3',
                                sel.has(c.code) && 'ring-2 ring-ink', cellId === c.id && 'ring-2 ring-info')}
                            >
                              <div className="font-mono text-[13px] font-semibold">{c.code}</div>
                              <div className="text-[11px] text-ink-2 mt-0.5 tnum">{l.length ? `${qty} шт · ${l.length} SKU` : 'пусто'}</div>
                              <input type="checkbox" checked={sel.has(c.code)} onChange={() => toggle(c.code)} onClick={(e) => e.stopPropagation()} className="absolute top-2 right-2 accent-[#15171a] opacity-40 hover:opacity-100" aria-label={`Выбрать ${c.code}`} />
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )
      ) : (
        <Boxes onPrint={setPrinting} />
      )}

      {creating && (
        <Modal open onClose={() => setCreating(false)} title="Создать ячейки" width={640}>
          {!created ? (
            <CellRangeForm onCreated={(codes) => setCreated(codes)} />
          ) : (
            <div>
              <div className="text-sm mb-3">Создано ячеек: <b>{created.length}</b>. Распечатайте этикетки и наклейте на стеллажи.</div>
              <div className="bg-sunken rounded-lg p-3 mb-4"><LabelPreview codes={created} max={3} /></div>
              <LabelPrinter codes={created} title="Новых ячеек" />
            </div>
          )}
        </Modal>
      )}
      {printing && (
        <Modal open onClose={() => setPrinting(null)} title="Печать этикеток" width={640}>
          <div className="bg-sunken rounded-lg p-3 mb-4"><LabelPreview codes={printing} max={3} /></div>
          <LabelPrinter codes={printing} />
        </Modal>
      )}
      {cellId && s.cells.some((c) => c.id === cellId) && <CellDrawer id={cellId} onClose={() => setParams({})} onPrint={(c) => setPrinting([c])} />}
    </div>
  )
}

function CellDrawer({ id, onClose, onPrint }: { id: string; onClose: () => void; onPrint: (code: string) => void }) {
  const { s } = useApp()
  const c = s.cells.find((x) => x.id === id)!
  const content = S.cellContents(s, id)
  const history = s.movements.filter((m) => m.from?.id === id || m.to?.id === id).sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 10)
  return (
    <Drawer open onClose={onClose} title={<CellTag code={c.code} size="md" />} width={480} footer={<Button onClick={() => onPrint(c.code)}><Printer size={15} />Этикетка</Button>}>
      <div className="flex items-center gap-4">
        <QrImg text={c.code} size={96} />
        <div className="text-[13px] text-ink-2">Зона {s.zones.find((z) => z.id === c.zoneId)?.code}<br />{content.reduce((a, x) => a + x.qty, 0)} шт. · {content.length} SKU</div>
      </div>
      {content.length > 1 && <div className="mt-4 rounded-md bg-err-bg text-err text-[13px] px-3 py-2">В ячейке несколько разных SKU — повышенный риск пересорта. Разнесите товары по разным ячейкам.</div>}
      <h3 className="mt-5 mb-2 text-[13px] font-semibold">Содержимое</h3>
      <div className="border border-line rounded-lg divide-y divide-line">
        {content.map((x) => (
          <Link key={x.product.id} to={`/app/products?open=${x.product.id}`} className="flex items-center gap-3 px-3 py-2 hover:bg-paper">
            <ProductThumb product={x.product} size={32} />
            <div className="flex-1 min-w-0"><div className="text-[13px] truncate">{x.product.name}</div><div className="font-mono text-[11px] text-ink-3">{x.product.sku}</div></div>
            {x.reserved > 0 && <span className="text-[12px] text-warn">резерв {x.reserved}</span>}
            <span className="tnum font-semibold">{x.qty}</span>
          </Link>
        ))}
        {!content.length && <div className="px-3 py-3 text-[13px] text-ink-3">Пусто</div>}
      </div>
      <h3 className="mt-5 mb-2 text-[13px] font-semibold">Последние движения</h3>
      <div className="text-[13px] grid gap-1.5">
        {history.map((m) => (
          <div key={m.id} className="flex gap-2"><span className="font-mono text-[12px] text-ink-3 w-12">{new Date(m.ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span><span className="flex-1 truncate">{s.products.find((p) => p.id === m.productId)?.sku}</span><span className={cx('tnum font-semibold', m.to?.id === id ? 'text-ok' : 'text-ink-2')}>{m.to?.id === id ? '+' : '−'}{m.qty}</span></div>
        ))}
      </div>
    </Drawer>
  )
}

function Boxes({ onPrint }: { onPrint: (codes: string[]) => void }) {
  const { s, ctx } = useApp()
  const [n, setN] = useState(10)
  const boxes = s.containers.filter((c) => c.code.startsWith('BOX-')).sort((a, b) => a.code.localeCompare(b.code))
  return (
    <div className="grid grid-cols-[1fr_320px] gap-6">
      <div className="bg-surface border border-line rounded-xl overflow-hidden">
        <table className="dtable">
          <thead><tr><th>Короб</th><th>Статус</th><th>Заказ</th><th className="text-right">Товара внутри</th></tr></thead>
          <tbody>
            {boxes.map((b) => {
              const o = s.orders.find((x) => x.id === b.orderId)
              const qty = s.stock.filter((x) => x.locationType === 'container' && x.locationId === b.id).reduce((a, x) => a + x.qty, 0)
              return (
                <tr key={b.id}>
                  <td className="font-mono font-semibold">{b.code}</td>
                  <td>{o ? <span className="text-warn">Занят</span> : <span className="text-ok">Свободен</span>}</td>
                  <td>{o && <Link to={`/app/orders?open=${o.id}`} className="font-mono hover:underline">№{o.number}</Link>}</td>
                  <td className="text-right tnum">{qty || ''}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="bg-surface border border-line rounded-xl p-5 h-fit">
        <div className="font-semibold text-sm">Зачем короба</div>
        <p className="text-[13px] text-ink-2 mt-1">Сборщик сканирует QR пластикового короба в начале сборки — всё, что он возьмёт, привяжется к заказу. Два заказа, собранные параллельно, не перепутаются.</p>
        <div className="mt-4 flex items-center gap-2">
          <Input type="number" value={n} min={1} max={500} onChange={(e) => setN(Number(e.target.value) || 1)} className="w-20 tnum" />
          <Button variant="primary" onClick={() => { const c = S.createContainers(ctx, n); toast(`Создано коробов: ${c.length}`); onPrint(c.map((x) => x.code)) }}>Создать и распечатать</Button>
        </div>
        {boxes.length > 0 && <button onClick={() => onPrint(boxes.map((b) => b.code))} className="mt-3 text-[13px] text-info font-medium">Перепечатать все этикетки</button>}
      </div>
    </div>
  )
}
