import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Monitor, RotateCcw, Smartphone } from 'lucide-react'
import { useDB, useSession } from '@/app/state'
import { emptyDB, replaceDB } from '@/domain/db'
import { seedDemo } from '@/domain/seed'
import { registerOrganization } from '@/domain/services'
import { Button, Field, Input, Logo, toast } from '@/ui/kit'

function AuthFrame({ title, sub, children }: { title: string; sub?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <header className="px-5 md:px-8 h-16 flex items-center"><Link to="/"><Logo /></Link></header>
      <main className="flex-1 grid place-items-center px-5 pb-16">
        <div className="w-full max-w-[420px]">
          <h1 className="text-[28px] font-bold tracking-tight">{title}</h1>
          {sub && <p className="text-muted-foreground mt-1.5">{sub}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </main>
    </div>
  )
}

export function Login() {
  const db = useDB()
  const { setSession } = useSession()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [err, setErr] = useState('')
  const demoOrg = db.orgs.find((o) => o.onboardingDone && db.users.some((u) => u.orgId === o.id && u.email.endsWith('@kotova.store')))
  const demoUsers = db.users.filter((u) => u.orgId === demoOrg?.id && u.active).slice(0, 2)

  const enter = (orgId: string, userId: string) => {
    setSession({ orgId, userId })
    nav('/start')
  }
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const u = db.users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase() && x.active)
    if (!u) return setErr('Пользователь с таким e-mail не найден')
    enter(u.orgId, u.id)
  }

  return (
    <AuthFrame title="Вход" sub="Демо-склад уже заполнен товарами, ячейками и заказами.">
      <div className="grid gap-2">
        {demoUsers.map((u) => (
          <button key={u.id} onClick={() => enter(u.orgId, u.id)} className="text-left wms-panel px-4 py-3.5 flex items-center gap-3 hover:border-foreground/30" data-testid={`login-${u.role}`}>
            <span className="h-10 w-10 rounded-full bg-foreground text-background grid place-items-center font-semibold">{u.name.slice(0, 1)}</span>
            <span className="flex-1">
              <span className="block font-semibold">{u.name}</span>
              <span className="block text-[13px] text-muted-foreground">{u.role === 'owner' ? 'Владелец — кабинет на компьютере' : 'Кладовщик — терминал на телефоне'}</span>
            </span>
            {u.role === 'owner' ? <Monitor size={18} className="text-muted-foreground/80" /> : <Smartphone size={18} className="text-muted-foreground/80" />}
          </button>
        ))}
      </div>
      <div className="my-6 flex items-center gap-3 text-[12px] text-muted-foreground/80"><span className="h-px flex-1 bg-border" />или по e-mail<span className="h-px flex-1 bg-border" /></div>
      <form onSubmit={submit} className="grid gap-3">
        <Field label="E-mail" error={err}><Input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setErr('') }} placeholder="you@company.ru" /></Field>
        <Field label="Пароль"><Input type="password" placeholder="••••••••" /></Field>
        <Button variant="primary" size="lg">Войти</Button>
      </form>
      <div className="mt-6 flex items-center justify-between text-[14px]">
        <Link to="/signup" className="font-medium link">Создать свой склад</Link>
        <button onClick={() => { replaceDB(emptyDB()); seedDemo(); toast('Демо-данные восстановлены') }} className="inline-flex items-center gap-1.5 text-muted-foreground/80 hover:text-foreground"><RotateCcw size={14} />Сбросить демо</button>
      </div>
    </AuthFrame>
  )
}

export function Signup() {
  const { setSession } = useSession()
  const nav = useNavigate()
  const [f, setF] = useState({ orgName: '', userName: '', email: '', password: '' })
  const [err, setErr] = useState('')
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const { orgId, userId } = registerOrganization(f)
      setSession({ orgId, userId })
      nav('/setup')
    } catch (x) {
      setErr(x instanceof Error ? x.message : String(x))
    }
  }
  return (
    <AuthFrame title="Создать склад" sub="14 дней бесплатно. Карта не нужна.">
      <form onSubmit={submit} className="grid gap-3">
        <Field label="Компания или магазин"><Input name="org" value={f.orgName} onChange={(e) => setF({ ...f, orgName: e.target.value })} placeholder="ИП Смирнов / Smirnov Shop" autoFocus /></Field>
        <Field label="Ваше имя"><Input name="name" value={f.userName} onChange={(e) => setF({ ...f, userName: e.target.value })} placeholder="Алексей" /></Field>
        <Field label="E-mail"><Input name="email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="you@company.ru" /></Field>
        <Field label="Пароль"><Input name="password" type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder="Не менее 8 символов" /></Field>
        {err && <div className="text-[13px] text-destructive">{err}</div>}
        <Button variant="primary" size="lg" className="mt-1">Продолжить <ArrowRight size={18} /></Button>
      </form>
      <div className="mt-6 text-[14px] text-muted-foreground">Уже есть аккаунт? <Link to="/login" className="font-medium link">Войти</Link></div>
    </AuthFrame>
  )
}
