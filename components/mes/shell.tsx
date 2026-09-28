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
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { MesProvider, cameraSilenceMs, isCameraOnline, uid, useMes, useNow } from "./store"
import { FinishBatchModal, LaunchBatchModal, MoreOperationsModal } from "./modals"
import { Btn, Drawer, Segmented, TONE, ToggleRow } from "./ui"
import { MesUiContext, useMesUi, type MesUi, type ScanHandler, type Toast } from "./ui-context"

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/mes", label: "Пост маркировки", icon: Factory },
  { href: "/mes/codes", label: "Коды", icon: ScanLine },
  { href: "/mes/batches", label: "Партии", icon: Layers },
  { href: "/mes/nomenclature", label: "Номенклатура", icon: Boxes },
  { href: "/mes/events", label: "Журнал", icon: ScrollText },
  { href: "/mes/settings", label: "Настройки", icon: Settings },
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
        <AppBar pathname={pathname} onSim={() => setSimOpen(true)} />
        <CameraOffline />
        <main className="min-h-0 flex-1 overflow-y-auto p-5">{children}</main>

        <Toasts toasts={toasts} onClose={(id) => setToasts((xs) => xs.filter((x) => x.id !== id))} />
        <LaunchBatchModal open={launch.open} preselect={launch.preselect} onClose={() => setLaunch({ open: false })} />
        <FinishBatchModal open={finishOpen} onClose={() => setFinishOpen(false)} />
        <MoreOperationsModal open={moreOpen} onClose={() => setMoreOpen(false)} />
        <SimDrawer open={simOpen} onClose={() => setSimOpen(false)} />
      </div>
    </MesUiContext.Provider>
  )
}

/* ─── Шапка: бренд, небольшая навигация, режим симуляции ─── */

const isActive = (pathname: string, href: string) => (href === "/mes" ? pathname === "/mes" : pathname.startsWith(href))

function AppBar({ pathname, onSim }: { pathname: string; onSim: () => void }) {
  const { state } = useMes()
  const alerts = state.alerts.length
  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-mes-line bg-mes-card px-5">
      <Link href="/mes" className="flex shrink-0 items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-lg bg-mes-olive-strong text-[13px] font-black text-white">MES</span>
        <span className="hidden whitespace-nowrap text-[17px] font-bold text-mes-ink 2xl:block">SCADA System MES</span>
      </Link>
      <nav className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
        {NAV.map(({ href, label, icon: Icon }) => {
          const on = isActive(pathname, href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex h-12 shrink-0 items-center gap-2 rounded-xl px-4 text-[16px] font-semibold",
                on ? "bg-mes-olive-soft text-mes-olive-deep" : "text-mes-ink-2 hover:bg-mes-panel",
              )}
            >
              <Icon className={cn("size-5", on ? "text-mes-olive-strong" : "text-mes-ink-3")} />
              {label}
              {href === "/mes" && alerts > 0 && !on && <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-mes-amber px-1.5 text-[13px] font-bold text-white">{alerts}</span>}
            </Link>
          )
        })}
      </nav>
      <button
        type="button"
        onClick={onSim}
        className="flex h-11 shrink-0 items-center gap-2 rounded-xl border-2 border-dashed border-mes-amber/60 bg-mes-amber-soft px-3.5 text-[14px] font-bold text-mes-amber-strong"
        title="Прототип работает на симуляции камеры и сканера"
      >
        <FlaskConical className="size-5" /> Симуляция
      </button>
      <span className="hidden shrink-0 text-right leading-tight xl:block">
        <span className="block text-[12px] text-mes-ink-3">Оператор</span>
        <span className="block text-[15px] font-semibold text-mes-ink">{state.settings.operator}</span>
      </span>
    </header>
  )
}

/* ─── Обрыв связи с камерой: видно на любом экране, пока не восстановится ─── */

function CameraOffline() {
  const { state, active } = useMes()
  const now = useNow()
  if (isCameraOnline(state, now)) return null
  return (
    <div className="flex shrink-0 items-center gap-4 bg-mes-red px-5 py-3 text-white">
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
