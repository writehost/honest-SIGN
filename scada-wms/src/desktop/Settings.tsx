import { useState } from 'react'
import type { ReactNode } from 'react'
import { useApp } from '@/app/state'
import * as S from '@/domain/services'
import { PLANS } from '@/domain/plans'
import { CONNECTORS } from '@/domain/connectors'
import { setSimulatedOffline, useNet } from '@/lib/net'
import { Button, Field, Input, Pill, toast } from '@/ui/kit'
import { PageHead } from './shared'
import { cx, fmtNum } from '@/lib/format'
import type { OrgSettings, PlanCode } from '@/domain/types'

export function Settings() {
  const { s, ctx, org, warehouse } = useApp()
  const [name, setName] = useState(org.name)
  const net = useNet()
  const plan = PLANS[org.plan]
  const toggle = (k: keyof OrgSettings) => S.updateOrg(ctx, { settings: { ...org.settings, [k]: !org.settings[k] } })

  return (
    <div className="max-w-[980px] grid gap-6">
      <PageHead title="Настройки" />

      <Block title="Организация">
        <div className="flex items-end gap-3">
          <Field label="Название" className="flex-1"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Button onClick={() => { S.updateOrg(ctx, { name }); toast('Сохранено') }} disabled={name === org.name}>Сохранить</Button>
        </div>
        <div className="mt-3 text-[13px] text-muted-foreground">Склад: {warehouse?.name} {warehouse?.address && `· ${warehouse.address}`}</div>
      </Block>

      <Block title="Тариф" aside={<span className="text-[13px] text-muted-foreground">Оплата подключается на следующем этапе</span>}>
        <div className="grid grid-cols-3 gap-3">
          {Object.values(PLANS).map((p) => (
            <button key={p.code} onClick={() => { S.updateOrg(ctx, { plan: p.code as PlanCode }); toast(`Тариф: ${p.name}`) }} className={cx('text-left rounded-lg border p-4', org.plan === p.code ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-border')}>
              <div className="flex items-center justify-between"><span className="font-semibold">{p.name}</span>{org.plan === p.code && <Pill tone="ok">Текущий</Pill>}</div>
              <div className="mt-1 text-lg font-semibold tnum">{fmtNum(p.priceRub)} ₽<span className="text-[12px] text-muted-foreground/80 font-normal">/мес</span></div>
              <ul className="mt-2 text-[12px] text-muted-foreground grid gap-0.5">
                <li>{p.warehouses === 1 ? '1 склад' : `до ${p.warehouses} складов`}</li>
                <li>до {p.users} пользователей</li>
                <li>до {fmtNum(p.products)} товаров</li>
                <li>история {p.historyDays} дн.</li>
                {p.marketplaces && <li>интеграции с маркетплейсами</li>}
                {p.api && <li>API и расширенные права</li>}
              </ul>
            </button>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-4">
          <Usage label="Пользователи" used={s.users.filter((u) => u.active).length} max={plan.users} />
          <Usage label="Товары" used={s.products.filter((p) => !p.archived).length} max={plan.products} />
          <Usage label="Склады" used={s.warehouses.length} max={plan.warehouses} />
        </div>
      </Block>

      <Block title="Сканирование и терминал">
        <Toggle label="Звук при скане" on={org.settings.sound} onClick={() => toggle('sound')} />
        <Toggle label="Вибрация" on={org.settings.vibration} onClick={() => toggle('vibration')} />
        <Toggle label="Быстрая приёмка" hint="товар → количество → ячейка, без экрана подтверждения" on={org.settings.quickReceive} onClick={() => toggle('quickReceive')} />
        <Toggle label="Кнопка «Демо-скан»" hint="Список кодов на экране — чтобы попробовать без этикеток. Выключите, когда наклеите QR." on={org.settings.demoScanner} onClick={() => toggle('demoScanner')} />
        <div className="mt-3 text-[13px] text-muted-foreground">Сканеры: камера телефона (EAN-13, EAN-8, Code128, QR, DataMatrix), Bluetooth-сканер в режиме клавиатуры (HID), USB-сканер на компьютере. Настраивать ничего не нужно.</div>
      </Block>

      <Block title="Маркетплейсы" aside={<Pill>Следующий этап</Pill>}>
        <div className="grid grid-cols-3 gap-3">
          {CONNECTORS.map((c) => (
            <div key={c.channel} className="rounded-lg border border-border p-4">
              <div className="font-semibold">{c.title}</div>
              <div className="text-[12px] text-muted-foreground mt-1">{c.scheme}</div>
              <Button size="sm" className="mt-3" disabled>Подключить</Button>
            </div>
          ))}
        </div>
        <div className="mt-3 text-[13px] text-muted-foreground">Пока заказы маркетплейсов загружаются через CSV (Импорт). Связь товара с WB/Ozon/ЯМ уже можно указать в карточке товара — подключение подхватит её.</div>
      </Block>

      <Block title="Связь">
        <Toggle label="Имитировать отсутствие связи" hint="Операции на телефоне встают в очередь и отправляются после восстановления" on={net.simulated} onClick={() => setSimulatedOffline(!net.simulated)} />
      </Block>
    </div>
  )
}

function Block({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="wms-panel">
      <div className="wms-panel-header flex items-center justify-between"><h2 className="wms-panel-title">{title}</h2>{aside}</div>
      <div className="p-5">{children}</div>
    </section>
  )
}

function Usage({ label, used, max }: { label: string; used: number; max: number }) {
  const pct = Math.min(100, (used / max) * 100)
  return (
    <div>
      <div className="flex justify-between text-[12px]"><span className="text-muted-foreground">{label}</span><span className="tnum">{fmtNum(used)} / {fmtNum(max)}</span></div>
      <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden"><div className={cx('h-full', pct >= 90 ? 'bg-destructive' : 'bg-foreground')} style={{ width: `${pct}%` }} /></div>
    </div>
  )
}

function Toggle({ label, hint, on, onClick }: { label: string; hint?: string; on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full text-left flex items-center gap-3 py-2" role="switch" aria-checked={on}>
      <span className="flex-1"><span className="block text-[13px]">{label}</span>{hint && <span className="block text-[12px] text-muted-foreground/80">{hint}</span>}</span>
      <span className={cx('w-9 h-5 rounded-full relative transition-colors', on ? 'bg-primary' : 'bg-border')}><span className={cx('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all', on ? 'left-[18px]' : 'left-0.5')} /></span>
    </button>
  )
}
