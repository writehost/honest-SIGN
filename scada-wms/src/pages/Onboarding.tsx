import { useState } from 'react'
import type { ReactNode } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ArrowRight, Check, Monitor, Smartphone } from 'lucide-react'
import { useApp, useSession } from '@/app/state'
import * as S from '@/domain/services'
import { DEMO_PRODUCTS } from '@/domain/seed'
import { Button, CellTag, Field, Input, Logo, ProductThumb, toast } from '@/ui/kit'
import { CellRangeForm, LabelPreview, LabelPrinter, QrImg } from '@/desktop/shared'
import { CsvImporter } from '@/desktop/Import'
import { cx } from '@/lib/format'

const STEPS = [
  { title: 'Склад', min: 1 },
  { title: 'Товары', min: 5 },
  { title: 'Ячейки', min: 2 },
  { title: 'QR-этикетки', min: 3 },
  { title: 'Первая приёмка', min: 3 },
]

export function Onboarding() {
  const { session } = useSession()
  const app = useApp()
  const nav = useNavigate()
  const { s, ctx, warehouse } = app
  const initial = !warehouse ? 0 : s.products.length === 0 ? 1 : s.cells.length === 0 ? 2 : 3
  const [step, setStep] = useState(initial)
  if (!session || !app.user) return <Navigate to="/login" replace />

  const finish = (to: string) => {
    S.updateOrg(ctx, { onboardingDone: true })
    nav(to)
  }
  const done = [!!warehouse, s.products.length > 0, s.cells.length > 0, step > 3, s.movements.length > 0]
  const left = STEPS.slice(step).reduce((a, x) => a + x.min, 0)

  return (
    <div className="min-h-[100dvh] bg-paper">
      <header className="h-16 px-5 md:px-8 flex items-center justify-between border-b border-line bg-surface">
        <Logo />
        <button onClick={() => finish('/app')} className="text-[13px] text-ink-2 hover:text-ink">Пропустить настройку</button>
      </header>
      <div className="max-w-[1080px] mx-auto px-5 md:px-8 py-8 md:py-12 grid md:grid-cols-[240px_1fr] gap-8 md:gap-12">
        <aside>
          <div className="text-[13px] text-ink-2">Осталось примерно {left} мин</div>
          <ol className="mt-4 grid gap-1">
            {STEPS.map((x, i) => (
              <li key={x.title}>
                <button onClick={() => i <= Math.max(initial, step) && setStep(i)} className={cx('w-full flex items-center gap-3 rounded-md px-2 py-2 text-left', i === step ? 'bg-surface border border-line' : '')}>
                  <span className={cx('h-6 w-6 rounded-full grid place-items-center text-[12px] font-semibold shrink-0', done[i] && i !== step ? 'bg-ok text-white' : i === step ? 'bg-ink text-white' : 'bg-sunken text-ink-3')}>
                    {done[i] && i !== step ? <Check size={13} strokeWidth={3} /> : i + 1}
                  </span>
                  <span className={cx('text-sm', i === step ? 'font-semibold' : 'text-ink-2')}>{x.title}</span>
                  <span className="ml-auto text-[12px] text-ink-3">{x.min} мин</span>
                </button>
              </li>
            ))}
          </ol>
        </aside>

        <main className="min-w-0">
          {step === 0 && <StepWarehouse onNext={() => setStep(1)} />}
          {step === 1 && <StepProducts onNext={() => setStep(2)} />}
          {step === 2 && <StepCells onNext={() => setStep(3)} />}
          {step === 3 && <StepLabels onNext={() => setStep(4)} />}
          {step === 4 && <StepReceive onFinish={finish} />}
        </main>
      </div>
    </div>
  )
}

function Head({ n, title, text }: { n: number; title: string; text: ReactNode }) {
  return (
    <div className="mb-6">
      <div className="text-[13px] font-mono text-ink-3">Шаг {n} из 5</div>
      <h1 className="text-[28px] font-bold tracking-tight mt-1">{title}</h1>
      <p className="text-ink-2 mt-1.5 max-w-[620px]">{text}</p>
    </div>
  )
}

function StepWarehouse({ onNext }: { onNext: () => void }) {
  const { ctx, warehouse } = useApp()
  const [f, setF] = useState({ name: warehouse?.name ?? 'Основной склад', address: warehouse?.address ?? '' })
  const save = () => {
    if (warehouse) return onNext()
    try {
      S.createWarehouse(ctx, f)
      onNext()
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'err')
    }
  }
  return (
    <>
      <Head n={1} title="Ваш склад" text="Это может быть комната, гараж или бокс. Позже добавите зоны и ячейки." />
      <div className="bg-surface border border-line rounded-xl p-5 grid gap-4 max-w-[520px]">
        <Field label="Название"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} disabled={!!warehouse} data-testid="wh-name" /></Field>
        <Field label="Адрес" hint="Необязательно"><Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} disabled={!!warehouse} placeholder="Город, улица, бокс" /></Field>
        <div><Button variant="primary" size="lg" onClick={save} data-testid="wh-save">{warehouse ? 'Дальше' : 'Создать склад'} <ArrowRight size={18} /></Button></div>
      </div>
    </>
  )
}

function StepProducts({ onNext }: { onNext: () => void }) {
  const { ctx, s } = useApp()
  const [mode, setMode] = useState<'manual' | 'csv'>('manual')
  const [f, setF] = useState({ name: '', sku: '', barcode: '' })
  const add = (e: React.FormEvent) => {
    e.preventDefault()
    try {
      S.createProduct(ctx, { name: f.name, sku: f.sku, article: '', brand: '', category: '', unit: 'шт', barcodes: f.barcode ? [f.barcode] : [] })
      setF({ name: '', sku: '', barcode: '' })
      toast('Товар добавлен')
    } catch (x) {
      toast(x instanceof Error ? x.message : String(x), 'err')
    }
  }
  const sample = () => {
    const r = S.importProducts(ctx, DEMO_PRODUCTS.slice(0, 6).map((p, i) => ({ ...p, row: i + 1 })))
    toast(`Добавлено примеров: ${r.created}`)
  }
  return (
    <>
      <Head n={2} title="Товары" text="Название, SKU и штрихкод — этого достаточно, чтобы начать. Фото, бренд и размеры добавите потом." />
      <div className="flex gap-1 mb-4 p-1 bg-sunken rounded-lg w-fit">
        {(['manual', 'csv'] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)} className={cx('h-8 px-3 rounded-md text-sm', mode === m ? 'bg-surface shadow-sm font-medium' : 'text-ink-2')}>{m === 'manual' ? 'Вручную' : 'Из CSV / Excel'}</button>
        ))}
      </div>
      <div className="bg-surface border border-line rounded-xl p-5">
        {mode === 'manual' ? (
          <form onSubmit={add} className="grid md:grid-cols-[1.6fr_1fr_1fr_auto] gap-3 items-end">
            <Field label="Название"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Футболка Nike чёрная XL" data-testid="p-name" /></Field>
            <Field label="SKU"><Input value={f.sku} onChange={(e) => setF({ ...f, sku: e.target.value })} placeholder="SKU-10023" className="font-mono" data-testid="p-sku" /></Field>
            <Field label="Штрихкод"><Input value={f.barcode} onChange={(e) => setF({ ...f, barcode: e.target.value })} placeholder="EAN-13" className="font-mono" data-testid="p-barcode" /></Field>
            <Button variant="primary" data-testid="p-add">Добавить</Button>
          </form>
        ) : (
          <CsvImporter kind="products" />
        )}
        <div className="mt-4 text-[13px] text-ink-2">Нет данных под рукой? <button onClick={sample} className="text-info font-medium">Добавить 6 товаров-примеров</button></div>
      </div>
      {s.products.length > 0 && (
        <div className="mt-4 bg-surface border border-line rounded-xl divide-y divide-line">
          {s.products.slice(-8).map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <ProductThumb product={p} size={32} />
              <span className="flex-1">{p.name}</span>
              <span className="font-mono text-ink-2">{p.sku}</span>
              <span className="font-mono text-ink-3 w-36 text-right">{s.barcodes.find((b) => b.productId === p.id)?.code}</span>
            </div>
          ))}
        </div>
      )}
      <div className="mt-6"><Button variant="primary" size="lg" disabled={!s.products.length} onClick={onNext} data-testid="products-next">Дальше <ArrowRight size={18} /></Button></div>
    </>
  )
}

function StepCells({ onNext }: { onNext: () => void }) {
  const { s } = useApp()
  const codes = [...s.cells].sort((a, b) => a.code.localeCompare(b.code)).map((c) => c.code)
  return (
    <>
      <Head n={3} title="Ячейки" text={<>Адрес ячейки — <b>зона-стеллаж-место</b>. Например, A-01-03: зона A, первый стеллаж, третье место. Начните с одного стеллажа — добавить можно в любой момент.</>} />
      <div className="bg-surface border border-line rounded-xl p-5"><CellRangeForm /></div>
      {codes.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">{codes.slice(0, 60).map((c) => <CellTag key={c} code={c} />)}{codes.length > 60 && <span className="text-sm text-ink-3">ещё {codes.length - 60}</span>}</div>
      )}
      <div className="mt-6"><Button variant="primary" size="lg" disabled={!codes.length} onClick={onNext} data-testid="cells-next">Дальше <ArrowRight size={18} /></Button></div>
    </>
  )
}

function StepLabels({ onNext }: { onNext: () => void }) {
  const { s } = useApp()
  const codes = [...s.cells].sort((a, b) => a.code.localeCompare(b.code)).map((c) => c.code)
  return (
    <>
      <Head n={4} title="QR-этикетки на ячейки" text="Код ячейки и QR — больше ничего. Подойдёт термопринтер, на котором вы печатаете этикетки маркетплейсов, или обычный принтер." />
      <div className="grid lg:grid-cols-[1fr_300px] gap-6">
        <div className="bg-sunken rounded-xl p-5"><LabelPreview codes={codes} /></div>
        <div><LabelPrinter codes={codes} title="Ячеек" /></div>
      </div>
      <div className="mt-6 flex items-center gap-3">
        <Button variant="primary" size="lg" onClick={onNext} data-testid="labels-next">Наклеил — дальше <ArrowRight size={18} /></Button>
        <span className="text-[13px] text-ink-3">Можно распечатать позже в разделе «Склад»</span>
      </div>
    </>
  )
}

function StepReceive({ onFinish }: { onFinish: (to: string) => void }) {
  const { user } = useApp()
  const url = `${location.origin}/login`
  return (
    <>
      <Head n={5} title="Первая приёмка — с телефона" text="Телефон и есть терминал сбора данных. Откройте приложение, отсканируйте товар, укажите количество и отсканируйте ячейку." />
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-surface border border-line rounded-xl p-5 flex gap-5">
          <QrImg text={url} size={132} />
          <div>
            <div className="flex items-center gap-2 font-semibold"><Smartphone size={18} />На телефоне</div>
            <ol className="mt-2 text-[14px] text-ink-2 grid gap-1 list-decimal pl-4">
              <li>Наведите камеру на QR</li>
              <li>Войдите как <b className="text-ink">{user.email || user.name}</b></li>
              <li>«Добавить на главный экран» — и это ваш ТСД</li>
            </ol>
          </div>
        </div>
        <div className="bg-surface border border-line rounded-xl p-5 flex flex-col">
          <div className="flex items-center gap-2 font-semibold"><Monitor size={18} />На этом устройстве</div>
          <p className="mt-2 text-[14px] text-ink-2 flex-1">USB-сканер штрихкодов работает сразу, как клавиатура. Можно принять товар прямо отсюда.</p>
          <div className="mt-3 flex gap-2 flex-wrap">
            <Button variant="primary" onClick={() => onFinish('/m/receive')} data-testid="go-receive">Принять товар</Button>
            <Button onClick={() => onFinish('/app')}>Открыть кабинет</Button>
          </div>
        </div>
      </div>
    </>
  )
}
