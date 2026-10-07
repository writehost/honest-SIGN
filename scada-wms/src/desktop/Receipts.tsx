import { Fragment, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useApp } from '@/app/state'
import * as S from '@/domain/services'
import { Button, Field, Input, Modal, Pill, ProductThumb, Select, toast } from '@/ui/kit'
import { PageHead } from './shared'
import { cx, fmtWhen } from '@/lib/format'

export function Receipts() {
  const { s, ctx } = useApp()
  const [creating, setCreating] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const list = [...s.receipts].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return (
    <div className="max-w-[1200px]">
      <PageHead title="Поставки" sub="Ожидаемые приёмки. Кладовщик выбирает поставку на телефоне и видит, сколько ещё принять." actions={<Button variant="primary" onClick={() => setCreating(true)}><Plus size={16} />Поставка</Button>} />
      <div className="bg-surface border border-line rounded-xl overflow-hidden">
        <table className="dtable">
          <thead><tr><th>Номер</th><th>Поставщик</th><th>Создана</th><th className="text-right">Позиций</th><th className="w-[260px]">Принято</th><th>Статус</th></tr></thead>
          <tbody>
            {list.map((r) => {
              const exp = r.lines.reduce((a, l) => a + l.expectedQty, 0)
              const got = r.lines.reduce((a, l) => a + l.receivedQty, 0)
              return (
                <Fragment key={r.id}>
                  <tr className={cx('cursor-pointer', open === r.id && 'sel')} onClick={() => setOpen(open === r.id ? null : r.id)}>
                    <td className="font-mono font-semibold">{r.number}</td>
                    <td>{r.supplier}</td>
                    <td className="text-ink-3">{fmtWhen(r.createdAt)}</td>
                    <td className="text-right tnum">{r.lines.length}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-sunken overflow-hidden"><div className="h-full bg-ok" style={{ width: `${Math.min(100, exp ? (got / exp) * 100 : 0)}%` }} /></div>
                        <span className="tnum text-[12px] w-16 text-right">{got} / {exp}</span>
                      </div>
                    </td>
                    <td>{r.status === 'done' ? <Pill tone="ok">Принята</Pill> : r.status === 'in_progress' ? <Pill tone="warn">Принимается</Pill> : <Pill tone="info">Ожидается</Pill>}</td>
                  </tr>
                  {open === r.id && (
                    <tr>
                      <td colSpan={6} className="!bg-paper">
                        <div className="grid gap-1 py-1">
                          {r.lines.map((l) => {
                            const p = s.products.find((x) => x.id === l.productId)!
                            return (
                              <div key={l.productId} className="flex items-center gap-3 text-[13px]">
                                <ProductThumb product={p} size={24} /><span className="flex-1">{p.name}</span><span className="font-mono text-[12px] text-ink-3 w-24">{p.sku}</span>
                                <span className={cx('tnum w-20 text-right', l.receivedQty >= l.expectedQty ? 'text-ok font-semibold' : '')}>{l.receivedQty} / {l.expectedQty}</span>
                              </div>
                            )
                          })}
                          {r.status !== 'done' && <div className="pt-2"><Button size="sm" onClick={() => { S.closeReceipt(ctx, r.id); toast('Поставка закрыта') }}>Закрыть поставку</Button></div>}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
        {!list.length && <div className="py-12 text-center text-sm text-ink-3">Поставок нет. Принимать товар можно и без документа — «Быстрая приёмка» на телефоне.</div>}
      </div>
      {creating && <ReceiptForm onClose={() => setCreating(false)} />}
    </div>
  )
}

function ReceiptForm({ onClose }: { onClose: () => void }) {
  const { s, ctx } = useApp()
  const [supplier, setSupplier] = useState('')
  const [lines, setLines] = useState([{ productId: '', expectedQty: 10 }])
  const [err, setErr] = useState('')
  const save = () => {
    try {
      S.createReceipt(ctx, { supplier, lines: lines.filter((l) => l.productId) })
      toast('Поставка создана')
      onClose()
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)) }
  }
  return (
    <Modal open onClose={onClose} title="Новая поставка" width={580} footer={<><Button onClick={onClose}>Отмена</Button><Button variant="primary" onClick={save}>Создать</Button></>}>
      <Field label="Поставщик"><Input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="ООО «Поставщик»" /></Field>
      <div className="mt-4 text-[12px] font-medium text-ink-2 mb-1">Ожидаемые позиции</div>
      <div className="grid gap-2">
        {lines.map((l, i) => (
          <div key={i} className="flex gap-2">
            <Select value={l.productId} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, productId: e.target.value } : x)))} className="flex-1">
              <option value="">Товар…</option>{s.products.filter((p) => !p.archived).map((p) => <option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}
            </Select>
            <Input type="number" min={1} value={l.expectedQty} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, expectedQty: Math.max(1, Number(e.target.value) || 1) } : x)))} className="w-24 tnum" />
            <button onClick={() => setLines(lines.filter((_, j) => j !== i))} className="p-1.5 text-ink-3 hover:text-err" aria-label="Удалить"><Trash2 size={15} /></button>
          </div>
        ))}
        <button onClick={() => setLines([...lines, { productId: '', expectedQty: 10 }])} className="text-[13px] text-info font-medium text-left">+ Позиция</button>
      </div>
      {err && <div className="mt-3 rounded-md bg-err-bg text-err text-[13px] px-3 py-2">{err}</div>}
    </Modal>
  )
}
