import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, CloudOff, LogOut, Monitor, RefreshCw } from 'lucide-react'
import type { ReactNode } from 'react'
import { useApp, useSession } from '@/app/state'
import { describe, MOVEMENT_LABEL } from '@/app/movement'
import { setSimulatedOffline, useNet } from '@/lib/net'
import { updateOrg } from '@/domain/services'
import { CellTag } from '@/ui/kit'
import { BottomNav, Section } from './common'
import { cx, fmtTime } from '@/lib/format'

export function MobileJournal() {
  const { s } = useApp()
  const list = [...s.movements].sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 80)
  return (
    <div className="pb-24">
      <header className="px-5 pt-[max(18px,env(safe-area-inset-top))] pb-3">
        <h1 className="text-[26px] font-bold tracking-tight">Журнал</h1>
        <div className="text-[14px] text-ink-2">Кто, что, откуда и куда</div>
      </header>
      <div className="px-4">
        <div className="bg-surface border border-line rounded-xl divide-y divide-line">
          {list.map((m) => {
            const d = describe(s, m)
            return (
              <div key={m.id} className="px-4 py-3">
                <div className="flex items-center gap-2 text-[13px] text-ink-3">
                  <span className="font-mono">{fmtTime(m.ts)}</span>
                  <span>{d.user?.name}</span>
                  <span className="ml-auto">{MOVEMENT_LABEL[m.type]}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-mono text-[14px] font-semibold">{d.product?.sku}</span>
                  <span className="text-[15px] font-semibold tnum">{d.sign}{m.qty} шт.</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1.5 text-[13px] flex-wrap">
                  {d.from ? <LocChip code={d.from} box={d.fromType === 'container'} /> : <span className="text-ink-3">{m.type === 'receipt' ? 'поставка' : '—'}</span>}
                  <ArrowRight size={14} className="text-ink-3" />
                  {d.to ? <LocChip code={d.to} box={d.toType === 'container'} /> : <span className="text-ink-3">{m.type === 'ship' ? 'покупателю' : m.type === 'pack' ? 'упаковано' : 'списано'}</span>}
                  {d.doc && <span className="text-ink-3 ml-1">· {d.doc}</span>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <BottomNav />
    </div>
  )
}

function LocChip({ code, box }: { code: string; box?: boolean }) {
  return box ? <span className="font-mono font-semibold text-[12px] bg-night text-white px-1.5 rounded-sm">{code}</span> : <CellTag code={code} size="sm" />
}

export function MobileMore() {
  const { user, org, ctx } = useApp()
  const { setSession } = useSession()
  const net = useNet()
  const nav = useNavigate()
  const set = (k: keyof typeof org.settings) => updateOrg(ctx, { settings: { ...org.settings, [k]: !org.settings[k] } })
  return (
    <div className="pb-24">
      <header className="px-5 pt-[max(18px,env(safe-area-inset-top))] pb-3 flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-night text-white grid place-items-center text-lg font-semibold">{user.name.slice(0, 1)}</div>
        <div>
          <div className="text-[18px] font-semibold">{user.name}</div>
          <div className="text-[14px] text-ink-2">{user.role === 'owner' ? 'Владелец' : 'Кладовщик'} · {org.name}</div>
        </div>
      </header>
      <div className="px-4">
        <Section title="Сканирование">
          <div className="bg-surface border border-line rounded-xl divide-y divide-line">
            <Toggle label="Звук при скане" on={org.settings.sound} onClick={() => set('sound')} />
            <Toggle label="Вибрация" on={org.settings.vibration} onClick={() => set('vibration')} />
            <Toggle label="Быстрая приёмка" hint="Товар → количество → ячейка, без экрана подтверждения" on={org.settings.quickReceive} onClick={() => set('quickReceive')} />
            <Toggle label="Демо-скан" hint="Кнопка со списком кодов — попробовать без этикеток" on={org.settings.demoScanner} onClick={() => set('demoScanner')} />
          </div>
        </Section>
        <Section title="Связь">
          <div className="bg-surface border border-line rounded-xl divide-y divide-line">
            <div className="px-4 py-3.5 flex items-center gap-3">
              {net.online ? <RefreshCw size={18} className="text-ok" /> : <CloudOff size={18} className="text-warn" />}
              <span className="flex-1 text-[15px]">{net.online ? 'Онлайн, всё синхронизировано' : `Офлайн · в очереди ${net.queue.length}`}</span>
            </div>
            <Toggle label="Имитировать отсутствие связи" hint="Проверить работу при плохом Wi-Fi на складе" on={net.simulated} onClick={() => setSimulatedOffline(!net.simulated)} />
          </div>
        </Section>
        <Section title="Аккаунт">
          <div className="bg-surface border border-line rounded-xl divide-y divide-line">
            {user.role === 'owner' && <RowLink to="/app" icon={<Monitor size={18} />} label="Открыть кабинет (компьютер)" />}
            <button onClick={() => { setSession(null); nav('/login') }} className="w-full px-4 py-3.5 flex items-center gap-3 text-err text-[15px]"><LogOut size={18} />Выйти</button>
          </div>
        </Section>
      </div>
      <BottomNav />
    </div>
  )
}

function Toggle({ label, hint, on, onClick }: { label: string; hint?: string; on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full text-left px-4 py-3.5 flex items-center gap-3" role="switch" aria-checked={on}>
      <div className="flex-1"><div className="text-[15px]">{label}</div>{hint && <div className="text-[13px] text-ink-3">{hint}</div>}</div>
      <span className={cx('w-12 h-7 rounded-full relative transition-colors shrink-0', on ? 'bg-ok' : 'bg-line-2')}>
        <span className={cx('absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all', on ? 'left-[22px]' : 'left-0.5')} />
      </span>
    </button>
  )
}

function RowLink({ to, icon, label }: { to: string; icon: ReactNode; label: string }) {
  return <Link to={to} className="px-4 py-3.5 flex items-center gap-3 text-[15px]">{icon}<span className="flex-1">{label}</span></Link>
}
