"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Factory,
  FlaskConical,
  Info,
  Layers,
  ScanLine,
  ScrollText,
  Settings,
  WifiOff,
  X,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Search,
  UserRound,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { MesProvider, cameraSilenceMs, isCameraOnline, parseDataMatrix, uid, useMes, useNow } from "./store"
import { FinishBatchModal, LaunchBatchModal, MoreOperationsModal } from "./modals"
import { Btn, Drawer, Segmented, TONE, ToggleRow } from "./ui"
import { MesUiContext, useMesUi, type MesUi, type ScanHandler, type Toast } from "./ui-context"

const NAV_GROUPS: { title: string; items: { href: string; label: string; icon: LucideIcon }[] }[] = [
  { title: "Главное", items: [{ href: "/mes", label: "Пост маркировки", icon: Factory }] },
  {
    title: "Маркировка",
    items: [
      { href: "/mes/codes", label: "Работа с кодами", icon: ScanLine },
      { href: "/mes/batches", label: "Партии", icon: Layers },
    ],
  },
  { title: "Справочники", items: [{ href: "/mes/nomenclature", label: "Номенклатура", icon: Boxes }] },
  { title: "Контроль", items: [{ href: "/mes/events", label: "Журнал событий", icon: ScrollText }] },
]

export function MesShell({ children }: { children: ReactNode }) {
  // Демо-данные генерируются случайно — рендерим только на клиенте
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return <div className="mes-root min-h-dvh bg-mes-bg" />
  return (
    <MesProvider>
      <ShellInner>{children}</ShellInner>
    </MesProvider>
  )
}

function ShellInner({ children }: { children: ReactNode }) {
  const { state } = useMes()
  const router = useRouter()
  const pathname = usePathname()
  const [launch, setLaunch] = useState<{ open: boolean; preselect?: string }>({ open: false })
  const [finishOpen, setFinishOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [simOpen, setSimOpen] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [pendingScan, setPendingScan] = useState<string | null>(null)
  const handlers = useRef<ScanHandler[]>([])

  const toast = useCallback((t: Omit<Toast, "id">) => {
    const id = uid()
    setToasts((xs) => [{ ...t, id }, ...xs].slice(0, 3))
    window.setTimeout(() => setToasts((xs) => xs.filter((x) => x.id !== id)), 4000)
  }, [])

  const registerScanHandler = useCallback((h: ScanHandler) => {
    handlers.current = [...handlers.current, h]
    return () => {
      handlers.current = handlers.current.filter((x) => x !== h)
    }
  }, [])

  const emitScan = useCallback((raw: string) => {
    const h = handlers.current[handlers.current.length - 1]
    if (h) h(raw)
  }, [])

  const ui = useMemo<MesUi>(
    () => ({
      openLaunch: (preselect) => setLaunch({ open: true, preselect }),
      openFinish: () => setFinishOpen(true),
      openMore: () => setMoreOpen(true),
      openSim: () => setSimOpen(true),
      toast,
      registerScanHandler,
      emitScan,
      pendingScan,
      consumePendingScan: () => setPendingScan(null),
      inspectCode: (code) => {
        setPendingScan(code)
        router.push("/mes/codes")
      },
    }),
    [toast, registerScanHandler, emitScan, pendingScan, router],
  )

  // USB-сканер в режиме HID Keyboard: быстрый поток символов + Enter.
  // Если фокус в поле ввода — поле обрабатывает Enter само. Иначе собираем скан здесь.
  const buf = useRef({ s: "", t: 0 })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return
      const now = performance.now()
      if (now - buf.current.t > 100) buf.current.s = ""
      buf.current.t = now
      if (e.key === "Enter") {
        const code = buf.current.s
        buf.current.s = ""
        if (code.length >= 6) emitScan(code)
      } else if (e.key.length === 1) {
        buf.current.s += e.key
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [emitScan])

  return (
    <MesUiContext.Provider value={ui}>
      <div className={cn("mes-root flex h-dvh flex-col bg-mes-bg text-mes-ink", state.settings.largeText && "mes-large")}>
        <div className="flex min-h-0 flex-1">
          <Sidebar pathname={pathname} />
          <div className="flex min-w-0 flex-1 flex-col">
            <TopBar onSim={() => setSimOpen(true)} />
            <CameraOffline />
            <main className="min-h-0 flex-1 overflow-y-auto px-6 pb-5 pt-4">{children}</main>
          </div>
        </div>

        <Toasts toasts={toasts} onClose={(id) => setToasts((xs) => xs.filter((x) => x.id !== id))} />
        <LaunchBatchModal open={launch.open} preselect={launch.preselect} onClose={() => setLaunch({ open: false })} />
        <FinishBatchModal open={finishOpen} onClose={() => setFinishOpen(false)} />
        <MoreOperationsModal open={moreOpen} onClose={() => setMoreOpen(false)} />
        <SimDrawer open={simOpen} onClose={() => setSimOpen(false)} />
      </div>
    </MesUiContext.Provider>
  )
}

/* ─── Навигация в стиле SCADA System WMS: группы разделов, бежевая подсветка активного ─── */

const isActive = (pathname: string, href: string) => (href === "/mes" ? pathname === "/mes" : pathname.startsWith(href))

function Logo({ compact }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <svg viewBox="0 0 40 40" className="size-10 shrink-0" aria-hidden>
        <path d="M31 9.5C28.4 7 24.8 5.5 20.6 5.5 13.9 5.5 9 9.3 9 14.6c0 11.2 21.5 6.6 21.5 15.1 0 3.3-3.3 5.3-8 5.3-4.3 0-7.8-1.6-10.4-4.2" fill="none" stroke="#1f2124" strokeWidth="6" strokeLinecap="round" />
        <path d="M31 9.5C28.4 7 24.8 5.5 20.6 5.5" fill="none" stroke="#8cbf3f" strokeWidth="6" strokeLinecap="round" />
        <path d="M12.1 30.8c2.6 2.6 6.1 4.2 10.4 4.2" fill="none" stroke="#8cbf3f" strokeWidth="6" strokeLinecap="round" />
      </svg>
      {!compact && (
        <span className="leading-none">
          <span className="block whitespace-nowrap text-[18px] font-extrabold tracking-tight text-mes-ink">
            SCADA <span className="font-medium">System</span>
          </span>
          <span className="mt-1 flex items-center gap-1.5 text-[10px] font-bold tracking-[0.3em] text-mes-ink-2">
            <span className="h-px w-6 bg-mes-ink-3" />
            MES
            <span className="h-px w-6 bg-mes-ink-3" />
          </span>
        </span>
      )}
    </span>
  )
}

function Sidebar({ pathname }: { pathname: string }) {
  // На узких экранах меню по умолчанию свёрнуто до иконок
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 1400)
  const item = (href: string, label: string, Icon: LucideIcon) => {
    const on = isActive(pathname, href)
    return (
      <Link
        key={href}
        href={href}
        title={collapsed ? label : undefined}
        className={cn(
          "flex h-12 items-center gap-3 rounded-xl text-[16px]",
          collapsed ? "justify-center px-0" : "px-3.5",
          on ? "bg-mes-sand font-semibold text-mes-ink" : "text-mes-ink-2 hover:bg-mes-panel",
        )}
      >
        <Icon className={cn("size-5 shrink-0", on ? "text-mes-olive-strong" : "text-mes-ink-3")} />
        {!collapsed && <span className="flex-1 truncate">{label}</span>}
      </Link>
    )
  }
  return (
    <aside className={cn("hidden shrink-0 flex-col border-r border-mes-line bg-mes-card lg:flex", collapsed ? "w-[84px]" : "w-[264px]")}>
      <div className={cn("flex h-[72px] shrink-0 items-center", collapsed ? "justify-center" : "justify-between pl-5 pr-3")}>
        <Link href="/mes">
          <Logo compact={collapsed} />
        </Link>
        {!collapsed && (
          <button type="button" onClick={() => setCollapsed(true)} aria-label="Свернуть меню" className="flex size-10 items-center justify-center rounded-lg text-mes-ink-3 hover:bg-mes-panel">
            <ChevronLeft className="size-5" />
          </button>
        )}
      </div>
      {collapsed && (
        <button type="button" onClick={() => setCollapsed(false)} aria-label="Развернуть меню" className="mx-auto mb-2 flex size-10 items-center justify-center rounded-lg text-mes-ink-3 hover:bg-mes-panel">
          <ChevronRight className="size-5" />
        </button>
      )}
      <nav className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 pb-3">
        {NAV_GROUPS.map((g) => (
          <div key={g.title} className="flex flex-col gap-0.5">
            {!collapsed && <p className="px-3.5 pb-1 pt-2 text-[12px] font-semibold uppercase tracking-[0.1em] text-mes-ink-3">{g.title}</p>}
            {g.items.map((i) => item(i.href, i.label, i.icon))}
          </div>
        ))}
      </nav>
      <div className="border-t border-mes-line p-3">{item("/mes/settings", "Настройки", Settings)}</div>
    </aside>
  )
}

/* ─── Верхняя строка: поиск кода/партии, симуляция, оператор ─── */

function TopBar({ onSim }: { onSim: () => void }) {
  const { state } = useMes()
  const { inspectCode } = useMesUi()
  const router = useRouter()
  const pathname = usePathname()
  const [q, setQ] = useState("")
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        ref.current?.focus()
      }
    }
    window.addEventListener("keydown", h)
    return () => window.removeEventListener("keydown", h)
  }, [])

  const submit = () => {
    const v = q.trim()
    if (!v) return
    setQ("")
    ref.current?.blur()
    // DataMatrix → проверка кода; всё остальное — поиск по партиям (номер, продукт)
    if (parseDataMatrix(v)) inspectCode(v)
    else router.push(`/mes/batches?q=${encodeURIComponent(v)}`)
  }

  return (
    <header className="flex h-[72px] shrink-0 items-center gap-4 border-b border-mes-line bg-mes-card px-6">
      <Link href="/mes" className="lg:hidden">
        <Logo compact />
      </Link>
      <form
        className="relative w-full max-w-[440px]"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-mes-ink-3" />
        <input
          ref={ref}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск кода или партии"
          className="h-12 w-full rounded-full border border-mes-line bg-mes-panel pl-12 pr-20 text-[16px] text-mes-ink outline-none placeholder:text-mes-ink-3 focus:border-mes-olive focus:bg-mes-card focus:ring-4 focus:ring-mes-olive/15"
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-mes-line bg-mes-card px-2 py-0.5 text-[12px] text-mes-ink-3">Ctrl K</kbd>
      </form>
      {pathname !== "/mes" && (
        <nav className="flex gap-1 lg:hidden">
          {[...NAV_GROUPS.flatMap((g) => g.items), { href: "/mes/settings", label: "Настройки", icon: Settings }].map(({ href, icon: Icon, label }) => (
            <Link key={href} href={href} aria-label={label} className="flex size-12 items-center justify-center rounded-full text-mes-ink-2 hover:bg-mes-panel">
              <Icon className="size-5" />
            </Link>
          ))}
        </nav>
      )}
      <div className="ml-auto flex items-center gap-4">
        <button
          type="button"
          onClick={onSim}
          className="flex h-12 items-center gap-2 rounded-full border border-dashed border-mes-amber/70 bg-mes-amber-soft px-4 text-[15px] font-semibold text-mes-amber-strong"
          title="Прототип работает на симуляции камеры и ручного сканера"
        >
          <FlaskConical className="size-5" /> Симуляция
        </button>
        <span className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-full bg-mes-forest text-white">
            <UserRound className="size-6" />
          </span>
          <span className="hidden whitespace-nowrap leading-tight xl:block">
            <span className="block text-[16px] font-semibold text-mes-ink">{state.settings.operator}</span>
            <span className="block text-[13px] text-mes-ink-3">Оператор · {state.settings.lineName}</span>
          </span>
        </span>
      </div>
    </header>
  )
}

/* ─── Обрыв связи с камерой: видно на любом экране, пока не восстановится ─── */

function CameraOffline() {
  const { state, active } = useMes()
  const now = useNow()
  if (isCameraOnline(state, now)) return null
  return (
    <div className="flex shrink-0 items-center gap-4 bg-mes-red px-6 py-3 text-white">
      <WifiOff className="size-7 shrink-0" />
      <p className="text-[19px] font-bold">Нет связи с камерой — {Math.floor(cameraSilenceMs(state, now) / 1000)} с</p>
      <p className="text-[16px] opacity-95">
        {active ? "Коды не регистрируются. " : ""}Проверьте питание и сеть камеры ({state.settings.cameraAddress}).
      </p>
    </div>
  )
}

/* ─── Уведомления: только подтверждение выполненных операций ─── */

const TOAST_ICON = { success: CheckCircle2, warning: AlertTriangle, critical: XCircle, info: Info, neutral: Info }

function Toasts({ toasts, onClose }: { toasts: Toast[]; onClose: (id: string) => void }) {
  return (
    <div className="pointer-events-none fixed bottom-[112px] right-5 z-[60] flex w-[min(440px,calc(100vw-2.5rem))] flex-col-reverse gap-2">
      {toasts.map((t) => {
        const Icon = TOAST_ICON[t.tone]
        return (
          <div key={t.id} className={cn("pointer-events-auto flex items-center gap-3 rounded-2xl border bg-mes-card px-4 py-3 shadow-lg", TONE[t.tone].border)}>
            <Icon className={cn("size-6 shrink-0", TONE[t.tone].text)} />
            <div className="min-w-0 flex-1">
              <p className="text-[16px] font-semibold text-mes-ink">{t.title}</p>
              {t.text && <p className="truncate text-[14px] text-mes-ink-2">{t.text}</p>}
            </div>
            <button type="button" onClick={() => onClose(t.id)} className="flex size-11 items-center justify-center rounded-xl text-mes-ink-3 hover:bg-mes-panel" aria-label="Закрыть">
              <X className="size-5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="border-t border-mes-line pt-5 first:border-0 first:pt-0">
      <h3 className="text-[15px] font-bold uppercase tracking-[0.04em] text-mes-ink-2">{title}</h3>
      {hint && <p className="mt-1 text-[14px] text-mes-ink-3">{hint}</p>}
      <div className="mt-3 flex flex-wrap gap-2">{children}</div>
    </section>
  )
}

/* ─── Симуляция: отделена от производственного интерфейса ─── */

function SimDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, active, sim } = useMes()
  const { emitScan } = useMesUi()
  const s = state.sim
  const b = (label: string, fn: () => void, disabled?: boolean) => (
    <Btn key={label} onClick={fn} disabled={disabled}>
      {label}
    </Btn>
  )
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Симуляция оборудования"
      subtitle="Не производственный режим. Интеграция с камерой ещё не подключена — события камеры и ручного сканера генерируются здесь по той же FIFO-модели."
      width="max-w-[640px]"
    >
      <div className="flex flex-col gap-5">
        <Group title="Камера" hint={active ? undefined : "Запустите партию — вне партии считывания не учитываются"}>
          <div className="w-full rounded-2xl ring-1 ring-mes-line">
            <ToggleRow checked={s.flow} onChange={(v) => sim.set({ flow: v })} label="Поток бутылей под камерой" description="Выключите, чтобы смоделировать простой линии" />
            <ToggleRow checked={s.cameraLink} onChange={(v) => sim.set({ cameraLink: v })} label="Связь с камерой" description={`Без связи через ${state.settings.cameraTimeoutSec} с появится предупреждение`} />
          </div>
          <Segmented
            className="w-full"
            value={s.intervalMs}
            onChange={(v) => sim.set({ intervalMs: v })}
            options={[
              { value: 800, label: "0,8 с", sub: "на бутыль" },
              { value: 2500, label: "2,5 с", sub: "на бутыль" },
              { value: 6000, label: "6 с", sub: "на бутыль" },
            ]}
          />
          {b("+1 бутыль", sim.bottle, !active || !s.cameraLink)}
          {b("Добрать палету", sim.fillPallet, !active || !s.cameraLink)}
          {b("NoRead", sim.noRead, !active || !s.cameraLink)}
          {b("Повторный код", sim.duplicate, !active || !s.cameraLink)}
          {b("Чужой GTIN", sim.foreign, !active || !s.cameraLink)}
        </Group>
        <Group title="Ручной сканер · DataMatrix" hint="Скан уходит на активный экран, как с USB-сканера">
          {b("Код из текущей палеты", () => emitScan(sim.code("queued")))}
          {b("Агрегированный код", () => emitScan(sim.code("aggregated")))}
          {b("Удалённый код", () => emitScan(sim.code("removed")))}
          {b("Незарегистрированный код", () => emitScan(sim.code("unknown")))}
          {b("Другая номенклатура", () => emitScan(sim.code("foreign")))}
          {b("Другая партия", () => emitScan(sim.code("other_batch")))}
          {b("Нечитаемый", () => emitScan(sim.code("garbage")))}
        </Group>
        <Group title="Ручной сканер · SSCC палеты">
          {b("Новая этикетка", () => emitScan(sim.sscc("new")))}
          {b("Повтор последней", () => emitScan(sim.sscc("last")))}
          {b("Этикетка другой палеты", () => emitScan(sim.sscc("used")))}
          {b("Ошибка контрольной цифры", () => emitScan(sim.sscc("bad_check")))}
          {b("Мусор", () => emitScan(sim.sscc("garbage")))}
        </Group>
      </div>
    </Drawer>
  )
}
