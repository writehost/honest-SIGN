import { useRef, useState } from 'react'
import { CheckCircle2, Download, FileUp, Upload } from 'lucide-react'
import { useApp } from '@/app/state'
import * as S from '@/domain/services'
import { download, mapHeader, parseCsv, toCsv } from '@/lib/csv'
import { Button, Pill, toast } from '@/ui/kit'
import { PageHead } from './shared'
import type { Channel } from '@/domain/types'
import { cx } from '@/lib/format'

export type ImportKind = 'products' | 'orders' | 'stock'

const SPEC: Record<ImportKind, { title: string; desc: string; aliases: Record<string, string[]>; required: string[]; template: string[][] }> = {
  products: {
    title: 'Товары',
    desc: 'Создаёт новые товары и обновляет существующие по SKU. Несколько штрихкодов — через запятую.',
    aliases: {
      name: ['Название', 'Наименование', 'name', 'Товар'], article: ['Артикул', 'article', 'Артикул продавца'], sku: ['SKU', 'Код', 'sku'],
      barcodes: ['Штрихкод', 'Штрихкоды', 'barcode', 'EAN', 'Баркод'], brand: ['Бренд', 'brand'], category: ['Категория', 'category', 'Предмет'],
      unit: ['Ед', 'Единица', 'unit', 'Ед. изм.'], weight: ['Вес', 'weight'], size: ['Размер', 'size'], color: ['Цвет', 'color'],
      wb: ['Артикул WB', 'nmID', 'wb'], ozon: ['Ozon offer_id', 'offer_id', 'ozon'],
    },
    required: ['name', 'sku'],
    template: [['Название', 'Артикул', 'SKU', 'Штрихкод', 'Бренд', 'Категория', 'Размер', 'Цвет'], ['Футболка оверсайз белая M', 'TS-OV-W-M', 'SKU-20001', '4607001239991', 'Basic Lab', 'Одежда', 'M', 'Белый']],
  },
  orders: {
    title: 'Заказы',
    desc: 'Одна строка — одна позиция. Строки с одинаковым номером собираются в один заказ и сразу уходят в сборку.',
    aliases: {
      number: ['Номер', 'Номер заказа', 'number', 'Заказ'], channel: ['Канал', 'channel', 'Площадка'], customer: ['Покупатель', 'customer', 'Клиент', 'Склад МП'],
      code: ['SKU', 'Штрихкод', 'Артикул', 'code'], qty: ['Количество', 'Кол-во', 'qty'],
    },
    required: ['number', 'code', 'qty'],
    template: [['Номер', 'Канал', 'Покупатель', 'SKU', 'Количество'], ['WB-77120', 'wb', 'WB · Коледино', 'SKU-10023', '2'], ['WB-77120', 'wb', 'WB · Коледино', 'SKU-50233', '1']],
  },
  stock: {
    title: 'Начальные остатки',
    desc: 'Чтобы не принимать весь склад заново: что, в какой ячейке и сколько лежит прямо сейчас.',
    aliases: { code: ['SKU', 'Штрихкод', 'Артикул', 'code'], cell: ['Ячейка', 'cell', 'Место'], qty: ['Количество', 'Кол-во', 'qty', 'Остаток'] },
    required: ['code', 'cell', 'qty'],
    template: [['SKU', 'Ячейка', 'Количество'], ['SKU-10023', 'A-01-01', '20']],
  },
}

const CH: Record<string, Channel> = { wb: 'wb', wildberries: 'wb', вб: 'wb', ozon: 'ozon', озон: 'ozon', ym: 'ym', яндекс: 'ym', 'яндекс маркет': 'ym', маркет: 'ym', site: 'site', сайт: 'site' }

export function CsvImporter({ kind, onDone }: { kind: ImportKind; onDone?: (r: S.ImportResult) => void }) {
  const { ctx, s } = useApp()
  const spec = SPEC[kind]
  const input = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<string[][] | null>(null)
  const [fileName, setFileName] = useState('')
  const [result, setResult] = useState<S.ImportResult | null>(null)

  const header = rows?.[0] ?? []
  const map = rows ? mapHeader(header, spec.aliases) : {}
  const missing = spec.required.filter((k) => map[k] === undefined)
  const body = rows?.slice(1) ?? []
  const get = (r: string[], k: string) => (map[k] !== undefined ? (r[map[k]] ?? '').trim() : '')

  const load = async (f: File) => {
    setFileName(f.name)
    setResult(null)
    setRows(parseCsv(await f.text()))
  }

  const run = () => {
    let res: S.ImportResult
    if (kind === 'products') {
      res = S.importProducts(ctx, body.map((r, i) => ({
        row: i + 2, name: get(r, 'name'), article: get(r, 'article'), sku: get(r, 'sku'), brand: get(r, 'brand'), category: get(r, 'category'),
        unit: get(r, 'unit') || 'шт', size: get(r, 'size'), color: get(r, 'color'), weight: Number(get(r, 'weight')) || undefined,
        barcodes: get(r, 'barcodes').split(/[,|\s]+/).filter(Boolean),
        marketplace: { wb: get(r, 'wb') || undefined, ozon: get(r, 'ozon') || undefined },
      })))
    } else if (kind === 'stock') {
      res = S.importStock(ctx, body.map((r, i) => ({ row: i + 2, code: get(r, 'code'), cell: get(r, 'cell'), qty: Number(get(r, 'qty')) })))
    } else {
      const groups = new Map<string, S.OrderInput & { row: number }>()
      const errors: S.ImportResult['errors'] = []
      body.forEach((r, i) => {
        const number = get(r, 'number')
        const p = S.resolveCode(s, get(r, 'code'))
        if (p.kind !== 'product') { errors.push({ row: i + 2, message: `Товар «${get(r, 'code')}» не найден` }); return }
        const g = groups.get(number) ?? { row: i + 2, number, channel: CH[get(r, 'channel').toLowerCase()] ?? 'manual', customer: get(r, 'customer'), items: [] }
        g.items.push({ productId: p.product.id, qty: Number(get(r, 'qty')) })
        groups.set(number, g)
      })
      res = S.importOrders(ctx, [...groups.values()])
      res.errors.unshift(...errors)
    }
    setResult(res)
    toast(`Импорт: создано ${res.created}${res.updated ? `, обновлено ${res.updated}` : ''}${res.errors.length ? `, ошибок ${res.errors.length}` : ''}`, res.errors.length ? 'warn' : 'ok')
    onDone?.(res)
  }

  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap">
        <input ref={input} type="file" accept=".csv,text/csv" hidden onChange={(e) => e.target.files?.[0] && load(e.target.files[0])} data-testid={`csv-${kind}`} />
        <Button variant="primary" onClick={() => input.current?.click()}><FileUp size={16} />Выбрать CSV</Button>
        <Button variant="ghost" onClick={() => download(`template-${kind}.csv`, toCsv(spec.template))}><Download size={16} />Шаблон</Button>
        {fileName && <span className="text-[13px] text-ink-2 font-mono">{fileName}</span>}
      </div>

      {rows && (
        <div className="mt-4 border border-line rounded-lg overflow-hidden bg-surface">
          <div className="px-3 py-2 border-b border-line flex items-center gap-2 text-[13px] flex-wrap">
            <span className="text-ink-2">Строк: <b className="text-ink">{body.length}</b></span>
            <span className="text-ink-3">·</span>
            {Object.keys(spec.aliases).filter((k) => map[k] !== undefined).map((k) => <Pill key={k} tone="ok">{header[map[k]]}</Pill>)}
            {missing.map((k) => <Pill key={k} tone="err">нет колонки «{spec.aliases[k][0]}»</Pill>)}
          </div>
          <div className="max-h-[260px] overflow-auto">
            <table className="dtable">
              <thead><tr><th>#</th>{header.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
              <tbody>{body.slice(0, 50).map((r, i) => <tr key={i}><td className="text-ink-3 tnum">{i + 2}</td>{header.map((_, j) => <td key={j} className="whitespace-nowrap">{r[j]}</td>)}</tr>)}</tbody>
            </table>
          </div>
          <div className="px-3 py-2.5 border-t border-line flex justify-end">
            <Button variant="primary" disabled={missing.length > 0 || !body.length} onClick={run} data-testid="csv-run"><Upload size={16} />Импортировать {body.length} строк</Button>
          </div>
        </div>
      )}

      {result && (
        <div className={cx('mt-4 rounded-lg border px-4 py-3', result.errors.length ? 'border-warn/40 bg-warn-bg' : 'border-ok/30 bg-ok-bg')}>
          <div className="flex items-center gap-2 font-medium text-sm"><CheckCircle2 size={16} className="text-ok" />Создано: {result.created}{result.updated > 0 && ` · обновлено: ${result.updated}`} · ошибок: {result.errors.length}</div>
          {result.errors.length > 0 && (
            <ul className="mt-2 text-[13px] grid gap-0.5">{result.errors.slice(0, 12).map((e, i) => <li key={i}><span className="font-mono text-ink-3">стр. {e.row}</span> — {e.message}</li>)}</ul>
          )}
        </div>
      )}
    </div>
  )
}

export function ImportPage() {
  const [kind, setKind] = useState<ImportKind>('products')
  return (
    <div className="max-w-[1100px]">
      <PageHead title="Импорт" sub="CSV из Excel, Google Таблиц или выгрузки маркетплейса. Разделитель ; или , — определим сами." />
      <div className="grid grid-cols-[240px_1fr] gap-6">
        <div className="grid gap-1 content-start">
          {(Object.keys(SPEC) as ImportKind[]).map((k) => (
            <button key={k} onClick={() => setKind(k)} className={cx('text-left rounded-md px-3 py-2 text-sm', kind === k ? 'bg-surface border border-line font-medium' : 'text-ink-2 hover:bg-sunken')}>{SPEC[k].title}</button>
          ))}
        </div>
        <div className="bg-surface border border-line rounded-xl p-5">
          <h2 className="font-semibold">{SPEC[kind].title}</h2>
          <p className="text-[13px] text-ink-2 mt-1 mb-4">{SPEC[kind].desc}</p>
          <CsvImporter key={kind} kind={kind} />
        </div>
      </div>
    </div>
  )
}
