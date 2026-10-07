import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useApp } from '@/app/state'
import * as S from '@/domain/services'
import { PLANS } from '@/domain/plans'
import { Button, Field, Input, Modal, Pill, Select, toast } from '@/ui/kit'
import { PageHead } from './shared'
import type { Role } from '@/domain/types'
import { fmtDate } from '@/lib/format'

export function Users() {
  const { s, ctx, org } = useApp()
  const [adding, setAdding] = useState(false)
  const plan = PLANS[org.plan]
  const active = s.users.filter((u) => u.active).length
  const today = new Date().toDateString()
  return (
    <div className="max-w-[1100px]">
      <PageHead title="Пользователи" sub={`${active} из ${plan.users} на тарифе ${plan.name}`} actions={<Button variant="primary" onClick={() => setAdding(true)} disabled={active >= plan.users}><Plus size={16} />Сотрудник</Button>} />
      <div className="bg-surface border border-line rounded-xl overflow-hidden">
        <table className="dtable">
          <thead><tr><th>Имя</th><th>E-mail</th><th>Роль</th><th className="text-right">Операций сегодня</th><th>Добавлен</th><th /></tr></thead>
          <tbody>
            {s.users.map((u) => (
              <tr key={u.id} className={u.active ? '' : 'opacity-50'}>
                <td className="font-medium"><span className="inline-grid place-items-center h-6 w-6 rounded-full bg-sunken text-[11px] mr-2">{u.name.slice(0, 1)}</span>{u.name}</td>
                <td className="text-ink-2">{u.email}</td>
                <td>{u.role === 'owner' ? <Pill tone="info">Владелец</Pill> : <Pill>Кладовщик</Pill>}</td>
                <td className="text-right tnum">{s.movements.filter((m) => m.userId === u.id && new Date(m.ts).toDateString() === today).length}</td>
                <td className="text-ink-3">{fmtDate(u.createdAt)}</td>
                <td className="text-right">
                  {u.id !== ctx.userId && (
                    <button className="text-[12px] text-ink-2 hover:text-ink" onClick={() => { try { S.setUserActive(ctx, u.id, !u.active); toast(u.active ? 'Доступ отключён' : 'Доступ включён') } catch (e) { toast(e instanceof Error ? e.message : String(e), 'err') } }}>
                      {u.active ? 'Отключить' : 'Включить'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 text-[13px] text-ink-2 max-w-[640px]">
        <b className="text-ink">Владелец</b> — всё: товары, заказы, настройки, кабинет на компьютере. <b className="text-ink">Кладовщик</b> — только терминал: приёмка, сборка, упаковка, перемещение, инвентаризация. Расширенные права — на тарифе Pro.
      </div>
      {adding && <AddUser onClose={() => setAdding(false)} />}
    </div>
  )
}

function AddUser({ onClose }: { onClose: () => void }) {
  const { ctx } = useApp()
  const [f, setF] = useState<{ name: string; email: string; role: Role }>({ name: '', email: '', role: 'storekeeper' })
  const [err, setErr] = useState('')
  const save = () => {
    try { S.addUser(ctx, f); toast(`Приглашение отправлено: ${f.email || f.name}`); onClose() } catch (e) { setErr(e instanceof Error ? e.message : String(e)) }
  }
  return (
    <Modal open onClose={onClose} title="Новый сотрудник" footer={<><Button onClick={onClose}>Отмена</Button><Button variant="primary" onClick={save}>Пригласить</Button></>}>
      <div className="grid gap-3">
        <Field label="Имя"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus /></Field>
        <Field label="E-mail или телефон" hint="Придёт ссылка для входа"><Input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Роль"><Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}><option value="storekeeper">Кладовщик</option><option value="owner">Владелец</option></Select></Field>
        {err && <div className="rounded-md bg-err-bg text-err text-[13px] px-3 py-2">{err}</div>}
      </div>
    </Modal>
  )
}
