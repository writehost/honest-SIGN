import { useMemo, useState } from 'react'
import { ArrowRight, Download } from 'lucide-react'
import { useApp } from '@/app/state'
import { describe, MOVEMENT_LABEL } from '@/app/movement'
import { download, toCsv } from '@/lib/csv'
import { Button, Input, Select } from '@/ui/kit'
import { PageHead } from './shared'
import { LocMini } from './Overview'
import { fmtDate, fmtTime } from '@/lib/format'
import type { MovementType } from '@/domain/types'
import { PLANS } from '@/domain/plans'

export function Journal() {
  const { s, org } = useApp()
  const [type, setType] = useState<MovementType | ''>('')
  const [userId, setUserId] = useState('')
  const [q, setQ] = useState('')
  const horizon = Date.now() - PLANS[org.plan].historyDays * 86400_000

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase()
    return s.movements
      .filter((m) => Date.parse(m.ts) >= horizon)
      .filter((m) => !type || m.type === type)
      .filter((m) => !userId || m.userId === userId)
      .map((m) => ({ m, d: describe(s, m) }))
      .filter(({ d }) => !t || `${d.product?.sku} ${d.product?.name} ${d.from} ${d.to} ${d.doc}`.toLowerCase().includes(t))
      .sort((a, b) => b.m.ts.localeCompare(a.m.ts))
  }, [s, type, userId, q, horizon])

  const exportCsv = () => download('journal.csv', toCsv([
    ['Дата', 'Время', 'Сотрудник', 'Операция', 'SKU', 'Товар', 'Кол-во', 'Откуда', 'Куда', 'Документ'],
    ...rows.map(({ m, d }) => [fmtDate(m.ts), fmtTime(m.ts), d.user?.name ?? '', MOVEMENT_LABEL[m.type], d.product?.sku ?? '', d.product?.name ?? '', m.qty, d.from, d.to, d.doc]),
  ]))

  return (
    <div className="max-w-[1500px]">
      <PageHead title="Операции" sub={`Журнал складских движений · хранится ${PLANS[org.plan].historyDays} дн. на тарифе ${PLANS[org.plan].name}`} actions={<Button onClick={exportCsv}><Download size={15} />CSV</Button>} />
      <div className="flex items-center gap-2 mb-3">
        <Input placeholder="SKU, товар, ячейка, заказ" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-[300px]" />
        <Select value={type} onChange={(e) => setType(e.target.value as MovementType | '')} className="w-[180px]">
          <option value="">Все операции</option>{(Object.keys(MOVEMENT_LABEL) as MovementType[]).map((t) => <option key={t} value={t}>{MOVEMENT_LABEL[t]}</option>)}
        </Select>
        <Select value={userId} onChange={(e) => setUserId(e.target.value)} className="w-[200px]">
          <option value="">Все сотрудники</option>{s.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </Select>
        <span className="text-[13px] text-ink-3 ml-2">{rows.length} записей</span>
      </div>
      <div className="bg-surface border border-line rounded-xl overflow-hidden">
        <table className="dtable">
          <thead><tr><th>Время</th><th>Сотрудник</th><th>Операция</th><th>SKU</th><th>Товар</th><th className="text-right">Кол-во</th><th>Откуда → Куда</th><th>Документ</th></tr></thead>
          <tbody>
            {rows.slice(0, 500).map(({ m, d }) => (
              <tr key={m.id}>
                <td className="tnum whitespace-nowrap"><span className="text-ink-3">{fmtDate(m.ts)}</span> {fmtTime(m.ts)}</td>
                <td>{d.user?.name}</td>
                <td>{MOVEMENT_LABEL[m.type]}</td>
                <td className="font-mono text-[12px]">{d.product?.sku}</td>
                <td className="text-ink-2 max-w-[280px] truncate">{d.product?.name}</td>
                <td className="text-right tnum font-semibold">{d.sign}{m.qty}</td>
                <td>
                  <span className="inline-flex items-center gap-1.5">
                    {d.from ? <LocMini code={d.from} box={d.fromType === 'container'} /> : <span className="text-ink-3 text-[12px]">{m.type === 'receipt' ? 'поставка' : '—'}</span>}
                    <ArrowRight size={12} className="text-ink-3" />
                    {d.to ? <LocMini code={d.to} box={d.toType === 'container'} /> : <span className="text-ink-3 text-[12px]">{m.type === 'ship' ? 'покупателю' : m.type === 'pack' ? 'упаковано' : 'списано'}</span>}
                  </span>
                </td>
                <td className="text-ink-2">{d.doc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
