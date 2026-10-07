import { useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Archive, ArchiveRestore, Camera, Plus, Trash2, X } from 'lucide-react'
import { useApp } from '@/app/state'
import * as S from '@/domain/services'
import { DomainError } from '@/domain/db'
import { describe, MOVEMENT_LABEL } from '@/app/movement'
import { Button, CellTag, Drawer, Field, Input, Pill, ProductThumb, Select, toast } from '@/ui/kit'
import { PageHead } from './shared'
import { LocMini } from './Overview'
import { cx, fmtWhen } from '@/lib/format'
import type { Product } from '@/domain/types'

export function Products() {
  const { s } = useApp()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [archived, setArchived] = useState(false)
  const [editing, setEditing] = useState<Product | 'new' | null>(null)
  const openId = params.get('open')
  const cats = [...new Set(s.products.map((p) => p.category).filter(Boolean))].sort()

  const list = useMemo(() => {
    const t = q.trim().toLowerCase()
    return s.products
      .filter((p) => p.archived === archived)
      .filter((p) => !cat || p.category === cat)
      .filter((p) => !t || `${p.name} ${p.sku} ${p.article} ${p.brand} ${s.barcodes.filter((b) => b.productId === p.id).map((b) => b.code).join(' ')}`.toLowerCase().includes(t))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [s, q, cat, archived])

  return (
    <div className="max-w-[1500px]">
      <PageHead
        title="Товары"
        sub={`${s.products.filter((p) => !p.archived).length} активных · ${s.products.filter((p) => p.archived).length} в архиве`}
        actions={<Button variant="primary" onClick={() => setEditing('new')} data-testid="product-new"><Plus size={16} />Товар</Button>}
      />
      <div className="flex items-center gap-2 mb-3">
        <Input placeholder="Поиск по названию, SKU, артикулу, штрихкоду" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-[360px]" />
        <Select value={cat} onChange={(e) => setCat(e.target.value)} className="w-[180px]"><option value="">Все категории</option>{cats.map((c) => <option key={c}>{c}</option>)}</Select>
        <div className="inline-flex h-9 items-center rounded-lg bg-muted p-[3px]">
          {[false, true].map((a) => <button key={String(a)} onClick={() => setArchived(a)} className={cx('h-[calc(100%-1px)] px-3 rounded-md border border-transparent text-sm font-medium', archived === a ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground')}>{a ? 'Архив' : 'Активные'}</button>)}
        </div>
      </div>
      <div className="wms-panel">
        <table className="wms-ag-grid wms-ag-grid--fit">
          <thead><tr><th className="w-12" /><th>Название</th><th>SKU</th><th>Артикул</th><th>Штрихкоды</th><th>Бренд</th><th>Категория</th><th>Размер / цвет</th><th>Маркетплейсы</th><th className="text-right">Остаток</th><th className="text-right">Доступно</th></tr></thead>
          <tbody>
            {list.map((p) => {
              const st = S.productStock(s, p.id)
              const codes = s.barcodes.filter((b) => b.productId === p.id)
              return (
                <tr key={p.id} onClick={() => setParams({ open: p.id })} className={cx('wms-ag-row cursor-pointer', openId === p.id && 'sel')}>
                  <td><ProductThumb product={p} size={32} /></td>
                  <td className="font-medium">{p.name}</td>
                  <td className="font-mono text-[12px]">{p.sku}</td>
                  <td className="font-mono text-[12px] text-muted-foreground">{p.article}</td>
                  <td className="font-mono text-[12px] text-muted-foreground">{codes[0]?.code}{codes.length > 1 && <span className="text-muted-foreground/80"> +{codes.length - 1}</span>}</td>
                  <td>{p.brand}</td>
                  <td className="text-muted-foreground">{p.category}</td>
                  <td className="text-muted-foreground">{[p.size, p.color].filter(Boolean).join(' · ')}</td>
                  <td>{p.marketplace.wb && <Pill className="mr-1">WB</Pill>}{p.marketplace.ozon && <Pill>Ozon</Pill>}</td>
                  <td className="text-right tnum font-semibold">{st.total}</td>
                  <td className={cx('text-right tnum', st.available <= 3 ? 'text-amber-800 font-semibold' : 'text-muted-foreground')}>{st.available}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {list.length === 0 && <div className="py-12 text-center text-sm text-muted-foreground/80">Ничего не найдено</div>}
      </div>

      {openId && s.products.some((p) => p.id === openId) && (
        <ProductDrawer id={openId} onClose={() => setParams({})} onEdit={(p) => setEditing(p)} />
      )}
      {editing && <ProductForm product={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function ProductDrawer({ id, onClose, onEdit }: { id: string; onClose: () => void; onEdit: (p: Product) => void }) {
  const { s, ctx } = useApp()
  const p = s.products.find((x) => x.id === id)!
  const st = S.productStock(s, id)
  const codes = s.barcodes.filter((b) => b.productId === id)
  const history = s.movements.filter((m) => m.productId === id).sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 15)
  const act = (fn: () => void, ok: string) => { try { fn(); toast(ok) } catch (e) { toast(e instanceof DomainError ? e.message : String(e), 'err') } }
  return (
    <Drawer open onClose={onClose} title={p.name} width={560} footer={
      <>
        {!p.archived && <Button variant="ghost" onClick={() => act(() => S.deleteProduct(ctx, id), 'Товар удалён')}><Trash2 size={15} />Удалить</Button>}
        <span className="flex-1" />
        {p.archived
          ? <Button onClick={() => act(() => S.setProductArchived(ctx, id, false), 'Возвращён из архива')}><ArchiveRestore size={15} />Вернуть</Button>
          : <Button onClick={() => act(() => S.setProductArchived(ctx, id, true), 'Перенесён в архив')}><Archive size={15} />В архив</Button>}
        <Button variant="primary" onClick={() => onEdit(p)}>Редактировать</Button>
      </>
    }>
      <div className="flex gap-4">
        <ProductThumb product={p} size={96} className="rounded-lg" />
        <dl className="grid grid-cols-[96px_1fr] gap-y-1 text-[13px] content-start">
          <dt className="text-muted-foreground/80">SKU</dt><dd className="font-mono">{p.sku}</dd>
          <dt className="text-muted-foreground/80">Артикул</dt><dd className="font-mono">{p.article || '—'}</dd>
          <dt className="text-muted-foreground/80">Бренд</dt><dd>{p.brand || '—'}</dd>
          <dt className="text-muted-foreground/80">Категория</dt><dd>{p.category || '—'}</dd>
          {(p.size || p.color) && <><dt className="text-muted-foreground/80">Размер, цвет</dt><dd>{[p.size, p.color].filter(Boolean).join(', ')}</dd></>}
          <dt className="text-muted-foreground/80">Штрихкоды</dt><dd className="font-mono">{codes.map((c) => <div key={c.id}>{c.code}</div>)}{!codes.length && '—'}</dd>
          {(p.marketplace.wb || p.marketplace.ozon || p.marketplace.ym) && <><dt className="text-muted-foreground/80">Маркетплейсы</dt><dd className="font-mono">{p.marketplace.wb && <div>WB {p.marketplace.wb}</div>}{p.marketplace.ozon && <div>Ozon {p.marketplace.ozon}</div>}{p.marketplace.ym && <div>ЯМ {p.marketplace.ym}</div>}</dd></>}
        </dl>
      </div>

      <div className="mt-6 grid grid-cols-3 border border-border rounded-lg overflow-hidden text-center">
        {[['Остаток', st.total], ['Доступно', st.available], ['Резерв', st.reserved]].map(([l, v]) => (
          <div key={l} className="py-3 border-r border-border last:border-0"><div className="text-[24px] font-semibold tnum leading-none">{v}</div><div className="text-[12px] text-muted-foreground/80 mt-1">{l}</div></div>
        ))}
      </div>

      <h3 className="mt-6 mb-2 text-[13px] font-semibold">Где лежит</h3>
      <div className="border border-border rounded-lg divide-y divide-border">
        {st.cells.map((c) => (
          <div key={c.cell.id} className="flex items-center gap-3 px-3 py-2">
            <CellTag code={c.cell.code} />
            <span className="flex-1" />
            {c.reserved > 0 && <span className="text-[12px] text-amber-800">резерв {c.reserved}</span>}
            <span className="tnum font-semibold">{c.qty} шт.</span>
          </div>
        ))}
        {st.inBoxes > 0 && <div className="px-3 py-2 text-[13px] text-muted-foreground flex"><span className="flex-1">В сборочных коробах</span><span className="tnum font-semibold text-foreground">{st.inBoxes} шт.</span></div>}
        {st.total === 0 && <div className="px-3 py-3 text-[13px] text-muted-foreground/80">Нет на складе</div>}
      </div>

      <h3 className="mt-6 mb-2 text-[13px] font-semibold">История</h3>
      <div className="border border-border rounded-lg divide-y divide-border text-[13px]">
        {history.map((m) => {
          const d = describe(s, m)
          return (
            <div key={m.id} className="flex items-center gap-3 px-3 py-2">
              <span className="font-mono text-[12px] text-muted-foreground/80 w-20">{fmtWhen(m.ts)}</span>
              <span className="w-24 text-muted-foreground">{MOVEMENT_LABEL[m.type]}</span>
              <span className="tnum font-semibold w-10 text-right">{d.sign}{m.qty}</span>
              <span className="flex-1 flex items-center gap-1">{d.from && <LocMini code={d.from} box={d.fromType === 'container'} />}{d.from && d.to && '→'}{d.to && <LocMini code={d.to} box={d.toType === 'container'} />}</span>
              <span className="text-muted-foreground/80 text-[12px]">{d.user?.name.split(' ')[0]}</span>
            </div>
          )
        })}
        {!history.length && <div className="px-3 py-3 text-muted-foreground/80">Операций ещё не было</div>}
      </div>
    </Drawer>
  )
}

function ProductForm({ product, onClose }: { product?: Product; onClose: () => void }) {
  const { s, ctx } = useApp()
  const [f, setF] = useState({
    name: product?.name ?? '', sku: product?.sku ?? '', article: product?.article ?? '', brand: product?.brand ?? '', category: product?.category ?? '',
    unit: product?.unit ?? 'шт', size: product?.size ?? '', color: product?.color ?? '', weight: product?.weight ? String(product.weight) : '',
    photo: product?.photo, wb: product?.marketplace.wb ?? '', ozon: product?.marketplace.ozon ?? '', ym: product?.marketplace.ym ?? '',
  })
  const [codes, setCodes] = useState<string[]>(product ? s.barcodes.filter((b) => b.productId === product.id).map((b) => b.code) : [''])
  const [err, setErr] = useState('')
  const file = useRef<HTMLInputElement>(null)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })

  const photo = async (fl: File) => {
    // Downscale on the device: a 1 MB phone photo becomes ~30 KB
    const img = await createImageBitmap(fl)
    const k = 320 / Math.max(img.width, img.height)
    const c = document.createElement('canvas')
    c.width = Math.round(img.width * Math.min(1, k)); c.height = Math.round(img.height * Math.min(1, k))
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
    setF({ ...f, photo: c.toDataURL('image/jpeg', 0.82) })
  }

  const save = () => {
    const input: S.ProductInput = {
      name: f.name, sku: f.sku, article: f.article, brand: f.brand, category: f.category, unit: f.unit, size: f.size, color: f.color,
      weight: f.weight ? Number(f.weight) : undefined, photo: f.photo, swatch: product?.swatch,
      marketplace: { wb: f.wb || undefined, ozon: f.ozon || undefined, ym: f.ym || undefined }, barcodes: codes,
    }
    try {
      if (product) S.updateProduct(ctx, product.id, input)
      else S.createProduct(ctx, input)
      toast(product ? 'Сохранено' : 'Товар создан')
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }

  const cats = [...new Set(s.products.map((p) => p.category).filter(Boolean))]
  return (
    <Drawer open onClose={onClose} title={product ? 'Редактировать товар' : 'Новый товар'} width={560} footer={<><Button onClick={onClose}>Отмена</Button><Button variant="primary" onClick={save} data-testid="product-save">Сохранить</Button></>}>
      <div className="grid gap-4">
        <div className="flex gap-4 items-start">
          <button onClick={() => file.current?.click()} className="relative shrink-0 rounded-lg overflow-hidden group" aria-label="Фото">
            {f.photo ? <img src={f.photo} className="w-[88px] h-[88px] object-cover" alt="" /> : <div className="w-[88px] h-[88px] bg-muted grid place-items-center text-muted-foreground/80"><Camera size={22} /></div>}
            <span className="absolute inset-x-0 bottom-0 text-[11px] bg-black/50 text-white py-0.5 opacity-0 group-hover:opacity-100">Фото</span>
          </button>
          <input ref={file} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && photo(e.target.files[0])} />
          <Field label="Название" className="flex-1"><Input value={f.name} onChange={set('name')} autoFocus data-testid="pf-name" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="SKU"><Input value={f.sku} onChange={set('sku')} className="font-mono" data-testid="pf-sku" /></Field>
          <Field label="Артикул"><Input value={f.article} onChange={set('article')} className="font-mono" /></Field>
          <Field label="Бренд"><Input value={f.brand} onChange={set('brand')} /></Field>
          <Field label="Категория"><Input value={f.category} onChange={set('category')} list="cats" /><datalist id="cats">{cats.map((c) => <option key={c} value={c} />)}</datalist></Field>
          <Field label="Размер"><Input value={f.size} onChange={set('size')} /></Field>
          <Field label="Цвет"><Input value={f.color} onChange={set('color')} /></Field>
          <Field label="Единица"><Select value={f.unit} onChange={set('unit')}><option>шт</option><option>упак</option><option>компл</option><option>пара</option></Select></Field>
          <Field label="Вес, г" hint="Необязательно"><Input value={f.weight} onChange={set('weight')} inputMode="numeric" /></Field>
        </div>
        <Field label="Штрихкоды" hint="У одного товара может быть несколько: заводской, WB, Ozon">
          <div className="grid gap-1.5">
            {codes.map((c, i) => (
              <div key={i} className="flex gap-1.5">
                <Input value={c} onChange={(e) => setCodes(codes.map((x, j) => (j === i ? e.target.value : x)))} className="font-mono" placeholder="4607001230011" data-testid={`pf-barcode-${i}`} />
                <button onClick={() => setCodes(codes.filter((_, j) => j !== i))} className="px-2 rounded text-muted-foreground/80 hover:text-destructive hover:bg-muted" aria-label="Удалить штрихкод"><X size={16} /></button>
              </div>
            ))}
            <button onClick={() => setCodes([...codes, ''])} className="text-[13px] link font-medium text-left">+ Добавить штрихкод</button>
          </div>
        </Field>
        <div>
          <div className="text-[12px] font-medium text-muted-foreground mb-1">Связь с маркетплейсами <span className="text-muted-foreground/80 font-normal">— для будущей синхронизации</span></div>
          <div className="grid grid-cols-3 gap-2">
            <Input value={f.wb} onChange={set('wb')} placeholder="WB nmID" className="font-mono" />
            <Input value={f.ozon} onChange={set('ozon')} placeholder="Ozon offer_id" className="font-mono" />
            <Input value={f.ym} onChange={set('ym')} placeholder="ЯМ offerId" className="font-mono" />
          </div>
        </div>
        {err && <div className="rounded-md bg-destructive/5 text-destructive text-[13px] px-3 py-2">{err}</div>}
      </div>
    </Drawer>
  )
}
