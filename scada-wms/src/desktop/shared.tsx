import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Download, Printer } from 'lucide-react'
import { useApp } from '@/app/state'
import * as S from '@/domain/services'
import { LABEL_FORMATS } from '@/lib/labelFormats'
import type { LabelFormat } from '@/lib/labelFormats'
import { download } from '@/lib/csv'
import { Button, Field, Input, toast } from '@/ui/kit'
import { cx } from '@/lib/format'

export function QrImg({ text, size = 96, className }: { text: string; size?: number; className?: string }) {
  const [src, setSrc] = useState('')
  useEffect(() => { void QRCode.toDataURL(text, { margin: 0, scale: 8 }).then(setSrc) }, [text])
  return src ? <img src={src} alt={text} width={size} height={size} className={className} style={{ width: size, height: size, imageRendering: 'pixelated' }} /> : <div style={{ width: size, height: size }} className="bg-sunken" />
}

/** A-01-01 → A-01-50 generator. Returns the codes it created. */
export function CellRangeForm({ onCreated, compact }: { onCreated?: (codes: string[]) => void; compact?: boolean }) {
  const { ctx, warehouse, s } = useApp()
  const [f, setF] = useState({ zone: 'A', rackFrom: 1, rackTo: 1, placeFrom: 1, placeTo: 10 })
  const codes = S.cellRangeCodes(f)
  const existing = new Set(s.cells.map((c) => c.code))
  const fresh = codes.filter((c) => !existing.has(c))
  const num = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: Math.max(1, Math.min(99, Number(e.target.value) || 1)) })

  const create = () => {
    if (!warehouse) return toast('Сначала создайте склад', 'err')
    try {
      const r = S.createCellRange(ctx, { warehouseId: warehouse.id, ...f })
      toast(`Создано ячеек: ${r.created.length}${r.skipped ? `, уже были: ${r.skipped}` : ''}`)
      onCreated?.(r.created.map((c) => c.code))
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'err')
    }
  }

  return (
    <div>
      <div className={cx('grid gap-3', compact ? 'grid-cols-2' : 'grid-cols-[90px_1fr_1fr]')}>
        <Field label="Зона" className={compact ? 'col-span-2' : ''}><Input value={f.zone} maxLength={4} onChange={(e) => setF({ ...f, zone: e.target.value.toUpperCase() })} className="font-mono uppercase" data-testid="range-zone" /></Field>
        <Field label="Стеллажи, с — по">
          <div className="flex items-center gap-1.5"><Input type="number" min={1} max={99} value={f.rackFrom} onChange={num('rackFrom')} className="tnum" /><span className="text-ink-3">—</span><Input type="number" min={1} max={99} value={f.rackTo} onChange={num('rackTo')} className="tnum" /></div>
        </Field>
        <Field label="Места на стеллаже, с — по">
          <div className="flex items-center gap-1.5"><Input type="number" min={1} max={99} value={f.placeFrom} onChange={num('placeFrom')} className="tnum" data-testid="range-from" /><span className="text-ink-3">—</span><Input type="number" min={1} max={99} value={f.placeTo} onChange={num('placeTo')} className="tnum" data-testid="range-to" /></div>
        </Field>
      </div>
      <div className="mt-4 rounded-lg bg-sunken px-4 py-3 flex items-center gap-3 flex-wrap">
        <span className="font-mono text-[13px] font-semibold bg-signal px-1.5 rounded-sm">{codes[0]}</span>
        <span className="text-ink-3">→</span>
        <span className="font-mono text-[13px] font-semibold bg-signal px-1.5 rounded-sm">{codes[codes.length - 1]}</span>
        <span className="text-[13px] text-ink-2">
          {codes.length} {codes.length === 1 ? 'ячейка' : 'ячеек'}{fresh.length !== codes.length && `, новых — ${fresh.length}`}
        </span>
        <span className="flex-1" />
        <Button variant="primary" onClick={create} disabled={!fresh.length} data-testid="range-create">Создать ячейки</Button>
      </div>
    </div>
  )
}

export function LabelPrinter({ codes, title = 'Этикетки' }: { codes: string[]; title?: string }) {
  const [fmt, setFmt] = useState<LabelFormat>('thermal58x40')
  const [busy, setBusy] = useState(false)
  const run = async () => {
    if (!codes.length) return
    setBusy(true)
    try {
      const { labelsPdf } = await import('@/lib/labels')
      const blob = await labelsPdf(codes, fmt)
      download(`labels-${codes[0]}-${codes.length}.pdf`, blob, 'application/pdf')
      toast(`PDF готов: ${codes.length} этикеток`)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div>
      <div className="text-[13px] font-medium text-ink-2 mb-2">{title}: {codes.length}</div>
      <div className="grid gap-2">
        {(Object.keys(LABEL_FORMATS) as LabelFormat[]).map((k) => (
          <label key={k} className={cx('flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer', fmt === k ? 'border-ink bg-surface' : 'border-line bg-surface hover:border-line-2')}>
            <input type="radio" name="fmt" checked={fmt === k} onChange={() => setFmt(k)} className="mt-1 accent-[#15171a]" />
            <span><span className="block text-sm font-medium">{LABEL_FORMATS[k].name}</span><span className="block text-[12px] text-ink-3">{LABEL_FORMATS[k].hint}</span></span>
          </label>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <Button variant="primary" onClick={run} disabled={!codes.length || busy} data-testid="download-pdf"><Download size={16} />{busy ? 'Готовим PDF…' : 'Скачать PDF'}</Button>
        <Button onClick={run} disabled={!codes.length || busy}><Printer size={16} />Печать</Button>
      </div>
    </div>
  )
}

export function LabelPreview({ codes, max = 6 }: { codes: string[]; max?: number }) {
  return (
    <div className="flex flex-wrap gap-2">
      {codes.slice(0, max).map((c) => (
        <div key={c} className="bg-white border border-line-2 rounded-[3px] w-[174px] h-[120px] flex flex-col items-center justify-center gap-1.5 shadow-sm">
          <span className="font-mono font-bold text-[25px] leading-none tracking-tight whitespace-nowrap">{c}</span>
          <QrImg text={c} size={72} />
        </div>
      ))}
      {codes.length > max && <div className="w-[174px] h-[120px] grid place-items-center text-sm text-ink-3 border border-dashed border-line-2 rounded-[3px]">ещё {codes.length - max}</div>}
    </div>
  )
}

export function PageHead({ title, sub, actions }: { title: string; sub?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-5">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight">{title}</h1>
        {sub && <div className="text-[13px] text-ink-2 mt-0.5">{sub}</div>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
