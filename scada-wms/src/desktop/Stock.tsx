import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download } from 'lucide-react'
import { useApp } from '@/app/state'
import * as S from '@/domain/services'
import { download, toCsv } from '@/lib/csv'
import { Button, CellTag, Input, ProductThumb } from '@/ui/kit'
import { PageHead } from './shared'
import { cx } from '@/lib/format'

export function StockPage() {
  const { s } = useApp()
  const [q, setQ] = useState('')
  const [view, setView] = useState<'product' | 'cell'>('product')
  const [onlyStock, setOnlyStock] = useState(true)

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase()
    return s.products
      .filter((p) => !p.archived)
      .map((p) => ({ p, st: S.productStock(s, p.id) }))
      .filter((x) => !onlyStock || x.st.total > 0)
      .filter((x) => !t || `${x.p.name} ${x.p.sku} ${x.st.cells.map((c) => c.cell.code).join(' ')}`.toLowerCase().includes(t))
      .sort((a, b) => a.p.name.localeCompare(b.p.name))
  }, [s, q, onlyStock])

  const flat = useMemo(() => {
    const t = q.trim().toLowerCase()
    return s.stock
      .filter((b) => b.locationType === 'cell' && b.qty > 0)
      .map((b) => ({ b, cell: s.cells.find((c) => c.id === b.locationId)!, p: s.products.find((p) => p.id === b.productId)! }))
      .filter((x) => x.cell && x.p && (!t || `${x.cell.code} ${x.p.name} ${x.p.sku}`.toLowerCase().includes(t)))
      .sort((a, b) => a.cell.code.localeCompare(b.cell.code))
  }, [s, q])

  const total = rows.reduce((a, x) => a + x.st.total, 0)
  const exportCsv = () => download('ostatki.csv', toCsv([
    ['SKU', 'Название', 'Ячейка', 'Количество', 'Резерв'],
    ...flat.map((x) => [x.p.sku, x.p.name, x.cell.code, x.b.qty, x.b.reserved]),
  ]))

  return (
    <div className="max-w-[1500px]">
      <PageHead title="Остатки" sub={`${rows.length} SKU · ${total} шт. на складе`} actions={<Button onClick={exportCsv}><Download size={15} />CSV</Button>} />
      <div className="flex items-center gap-2 mb-3">
        <Input placeholder="Товар, SKU или ячейка" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-[320px]" />
        <div className="flex p-0.5 bg-sunken rounded-md">
          {(['product', 'cell'] as const).map((v) => <button key={v} onClick={() => setView(v)} className={cx('h-8 px-3 rounded text-[13px]', view === v ? 'bg-surface shadow-sm font-medium' : 'text-ink-2')}>{v === 'product' ? 'По товарам' : 'По ячейкам'}</button>)}
        </div>
        {view === 'product' && <label className="flex items-center gap-2 text-[13px] text-ink-2 ml-2"><input type="checkbox" checked={onlyStock} onChange={(e) => setOnlyStock(e.target.checked)} className="accent-[#15171a]" />Только в наличии</label>}
      </div>

      <div className="bg-surface border border-line rounded-xl overflow-hidden">
        {view === 'product' ? (
          <table className="dtable">
            <thead><tr><th className="w-12" /><th>Товар</th><th>SKU</th><th className="text-right">Остаток</th><th className="text-right">Резерв</th><th className="text-right">Доступно</th><th className="text-right">В коробах</th><th>Ячейки</th></tr></thead>
            <tbody>
              {rows.map(({ p, st }) => (
                <tr key={p.id}>
                  <td><ProductThumb product={p} size={28} /></td>
                  <td><Link to={`/app/products?open=${p.id}`} className="font-medium hover:underline">{p.name}</Link></td>
                  <td className="font-mono text-[12px]">{p.sku}</td>
                  <td className="text-right tnum font-semibold">{st.total}</td>
                  <td className="text-right tnum text-ink-2">{st.reserved || ''}</td>
                  <td className={cx('text-right tnum', st.available === 0 ? 'text-err font-semibold' : st.available <= 3 ? 'text-warn font-semibold' : '')}>{st.available}</td>
                  <td className="text-right tnum text-ink-2">{st.inBoxes || ''}</td>
                  <td><div className="flex flex-wrap gap-1.5">{st.cells.map((c) => <span key={c.cell.id} className="inline-flex items-center gap-1"><CellTag code={c.cell.code} size="sm" /><span className="tnum text-[12px] font-medium">{c.qty}</span></span>)}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="dtable">
            <thead><tr><th>Ячейка</th><th className="w-12" /><th>Товар</th><th>SKU</th><th className="text-right">Количество</th><th className="text-right">Резерв</th></tr></thead>
            <tbody>
              {flat.map(({ b, cell, p }) => (
                <tr key={cell.id + p.id}>
                  <td><Link to={`/app/warehouse?cell=${cell.id}`}><CellTag code={cell.code} size="sm" /></Link></td>
                  <td><ProductThumb product={p} size={24} /></td>
                  <td>{p.name}</td>
                  <td className="font-mono text-[12px]">{p.sku}</td>
                  <td className="text-right tnum font-semibold">{b.qty}</td>
                  <td className="text-right tnum text-ink-2">{b.reserved || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
