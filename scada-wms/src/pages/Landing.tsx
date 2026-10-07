import { Link } from 'react-router-dom'
import { ArrowRight, Check, PackageCheck, QrCode, ScanLine, Smartphone, XOctagon } from 'lucide-react'
import type { ReactNode } from 'react'
import { CellTag, Logo, ProductThumb } from '@/ui/kit'
import { PLANS } from '@/domain/plans'
import { fmtNum } from '@/lib/format'

export function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="max-w-[1200px] mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
        <Logo />
        <nav className="flex items-center gap-1 md:gap-2">
          <Link to="/login" className="h-9 px-3 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground inline-flex items-center">Войти</Link>
          <Link to="/signup" className="h-9 px-4 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center">Создать склад</Link>
        </nav>
      </header>

      <section className="max-w-[1200px] mx-auto px-5 md:px-8 pt-8 md:pt-16 pb-16 grid md:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
        <div>
          <div className="inline-flex items-center gap-2 text-[13px] font-medium text-muted-foreground border border-border rounded-full px-3 h-7 bg-card">
            <span className="h-1.5 w-1.5 rounded-full bg-success" /> Для селлеров Wildberries, Ozon и Яндекс Маркета
          </div>
          <h1 className="mt-6 text-[40px] md:text-[54px] leading-[1.04] font-bold tracking-[-0.03em]">
            Телефон уже является вашим ТСД.
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-[560px] leading-relaxed">
            Складской учёт и защита от пересорта без дорогого оборудования. Распечатайте QR на ячейки — и работайте со смартфона уже сегодня. Без 1С, интегратора и покупки терминалов.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/signup" className="h-11 px-6 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 font-semibold inline-flex items-center gap-2">Запустить склад за 15 минут <ArrowRight size={18} /></Link>
            <Link to="/login" className="h-11 px-6 rounded-md border border-border bg-background shadow-xs hover:bg-accent font-semibold inline-flex items-center">Открыть демо</Link>
          </div>
          <div className="mt-8 grid grid-cols-3 max-w-[520px] border-t border-border pt-5 gap-4">
            <Fact n="0 ₽" t="на оборудование — нужен только телефон" />
            <Fact n="15 мин" t="от регистрации до первой приёмки" />
            <Fact n="2 барьера" t="от пересорта: сборка и упаковка" />
          </div>
        </div>
        <PhoneMock />
      </section>

      <section className="border-t border-border bg-card">
        <div className="max-w-[1200px] mx-auto px-5 md:px-8 py-16">
          <h2 className="text-[28px] md:text-[36px] font-bold tracking-tight max-w-[640px] leading-tight">Ошибку нельзя «прожать» кнопкой. Её останавливает последовательность сканов.</h2>
          <div className="mt-10 grid md:grid-cols-3 gap-px bg-border border border-border rounded-xl overflow-hidden">
            <Step icon={<QrCode size={22} />} n="01" title="Ячейка" text="Сборщик идёт к ячейке и сканирует её QR. Не та ячейка — красный экран, дальше не пустит." />
            <Step icon={<ScanLine size={22} />} n="02" title="Товар" text="Потом сканирует товар. Чужой SKU — «Неверный товар», с тем, что ожидалось и что отсканировано." />
            <Step icon={<PackageCheck size={22} />} n="03" title="Упаковка" text="Упаковщик ещё раз сканирует всё в коробке. Не хватает или лишнее — заказ не закрыть." />
          </div>
        </div>
      </section>

      <section className="max-w-[1200px] mx-auto px-5 md:px-8 py-16 grid md:grid-cols-2 gap-12">
        <div>
          <h2 className="text-[28px] font-bold tracking-tight">Что внутри</h2>
          <ul className="mt-6 grid gap-3 text-[16px]">
            {['Товары, штрихкоды, импорт из CSV', 'Ячейки A-01-01 и PDF с QR-этикетками на термопринтер', 'Приёмка, перемещение, сборка, упаковка, инвентаризация', 'Остатки по ячейкам: где лежит и сколько', 'Журнал: кто, когда, что, откуда, куда', 'Работает при плохом Wi-Fi — операции ждут на телефоне'].map((x) => (
              <li key={x} className="flex gap-3"><Check size={20} className="text-success shrink-0 mt-0.5" />{x}</li>
            ))}
          </ul>
          <div className="mt-6 text-[14px] text-muted-foreground">Камера телефона, Bluetooth-сканер или USB-сканер на компьютере — работает всё сразу, без настройки.</div>
        </div>
        <div>
          <h2 className="text-[28px] font-bold tracking-tight">Тарифы</h2>
          <div className="mt-6 grid gap-3">
            {Object.values(PLANS).map((p) => (
              <div key={p.code} className="wms-panel px-5 py-4 flex items-center gap-4">
                <div className="flex-1">
                  <div className="font-semibold text-lg">{p.name}</div>
                  <div className="text-[14px] text-muted-foreground">
                    {p.warehouses === 1 ? '1 склад' : `до ${p.warehouses} складов`} · до {p.users} пользователей · {fmtNum(p.products)} товаров
                    {p.marketplaces && ' · маркетплейсы'}{p.api && ' · API'}
                  </div>
                </div>
                <div className="text-right"><span className="text-xl font-bold tnum">{fmtNum(p.priceRub)} ₽</span><span className="text-muted-foreground/80 text-sm">/мес</span></div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-[13px] text-muted-foreground/80">14 дней бесплатно на любом тарифе. Подключение маркетплейсов — в следующих версиях.</div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="max-w-[1200px] mx-auto px-5 md:px-8 py-8 flex flex-wrap items-center justify-between gap-4 text-[13px] text-muted-foreground/80">
          <Logo className="text-foreground" />
          <span>Облачная WMS для небольших складов · прототип MVP</span>
        </div>
      </footer>
    </div>
  )
}

function Fact({ n, t }: { n: string; t: string }) {
  return <div><div className="text-[22px] font-bold tracking-tight">{n}</div><div className="text-[13px] text-muted-foreground leading-snug mt-0.5">{t}</div></div>
}

function Step({ icon, n, title, text }: { icon: ReactNode; n: string; title: string; text: string }) {
  return (
    <div className="bg-card p-6">
      <div className="flex items-center justify-between text-muted-foreground/80"><span className="text-foreground">{icon}</span><span className="font-mono text-[13px]">{n}</span></div>
      <div className="mt-6 text-xl font-semibold">{title}</div>
      <p className="mt-2 text-[15px] text-muted-foreground leading-relaxed">{text}</p>
    </div>
  )
}

function PhoneMock() {
  return (
    <div className="relative mx-auto w-full max-w-[340px]">
      <div className="rounded-[44px] bg-foreground p-2.5 shadow-[0_30px_80px_-24px_rgba(0,0,0,.30)]">
        <div className="rounded-[34px] overflow-hidden bg-background">
          <div className="bg-card shadow-sm px-4 pt-6 pb-2.5 flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-background text-[13px]">←</span>
            <span className="flex-1 font-semibold text-[15px]">Заказ №1582</span><span className="font-mono text-[11px] text-muted-foreground">1/2</span>
          </div>
          <div className="bg-card px-4 pb-2.5 flex gap-1"><span className="h-1.5 flex-1 rounded-full bg-foreground/40" /><span className="h-1.5 flex-1 rounded-full bg-muted" /></div>
          <div className="p-3 grid gap-2">
            <div className="rounded-2xl bg-card border border-border/70 shadow-sm p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Идите</div>
              <CellTag code="A-03-02" size="lg" className="mt-1.5 !text-[30px] !leading-none !py-2" />
            </div>
            <div className="rounded-2xl bg-card border border-primary ring-[3px] ring-primary/20 p-3 flex items-start justify-between">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Возьмите</div>
                <div className="text-[32px] font-bold leading-none mt-1">2 <span className="text-base text-muted-foreground font-medium">шт</span></div>
                <div className="mt-2 text-[13px] font-semibold leading-tight">Футболка Nike<br />чёрная XL</div>
                <div className="font-mono text-[11px] text-muted-foreground mt-0.5">SKU-10023</div>
              </div>
              <ProductThumb product={{ category: 'Одежда' } as never} size={64} className="rounded-xl" />
            </div>
            <div className="overflow-hidden rounded-2xl border border-destructive/30 bg-card shadow-sm">
              <div className="flex items-center gap-2 bg-destructive/5 px-3 py-2.5">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-destructive text-white"><XOctagon size={16} /></span>
                <span className="font-bold uppercase tracking-tight text-destructive">Неверный товар</span>
              </div>
              <div className="px-3 py-2 text-[12px] text-muted-foreground border-t border-border shadow-[inset_3px_0_0_var(--primary)]">Ожидалось <b className="font-mono text-foreground">SKU-10023</b> · чёрная XL</div>
              <div className="px-3 py-2 text-[12px] text-muted-foreground border-t border-border shadow-[inset_3px_0_0_var(--destructive)]">Отсканировано <b className="font-mono text-destructive">SKU-10025</b> · чёрная L</div>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap hidden md:flex items-center gap-2 bg-card border border-border rounded-full pl-2 pr-3.5 h-10 shadow-lg text-[13px] font-medium">
        <span className="h-7 w-7 rounded-full bg-muted grid place-items-center"><Smartphone size={15} /></span> Обычный Android или iPhone
      </div>
    </div>
  )
}
