"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import {
  AlertTriangle,
  Boxes,
  Camera,
  CheckCircle2,
  Cloud,
  Factory,
  Info,
  Layers,
  Printer,
  ScanLine,
  ScrollText,
  Settings,
  UserRound,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { DM_RE, LINE_LABEL, MesProvider, SSCC_RE, uid, useMes } from "./store"
import { FinishBatchModal, LaunchBatchModal, PalletScanModal } from "./modals"
import { StatusPill, TONE } from "./ui"
import { MesUiContext, type MesUi, type Toast } from "./ui-context"

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/mes", label: "Линия", icon: Factory },
  { href: "/mes/codes", label: "Коды", icon: ScanLine },
  { href: "/mes/batches", label: "Партии", icon: Layers },
  { href: "/mes/nomenclature", label: "Номенклатура", icon: Boxes },
  { href: "/mes/events", label: "Журнал", icon: ScrollText },
  { href: "/mes/settings", label: "Настройки", icon: Settings },
]

export function MesShell({ children }: { children: ReactNode }) {
  // Демо-данные генерируются случайно — рендерим только на клиенте, чтобы не было рассинхрона гидрации
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
  const { state, active, scanPallet } = useMes()
  const router = useRouter()
  const pathname = usePathname()
  const [launch, setLaunch] = useState<{ open: boolean; preselect?: string }>({ open: false })
  const [palletOpen, setPalletOpen] = useState(false)
  const [finishOpen, setFinishOpen] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [pendingScan, setPendingScan] = useState<string | null>(null)

  const toast = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = uid()
      setToasts((xs) => [{ ...t, id }, ...xs].slice(0, 4))
      window.setTimeout(() => setToasts((xs) => xs.filter((x) => x.id !== id)), state.settings.toastSeconds * 1000)
    },
    [state.settings.toastSeconds],
  )

  const ui = useMemo<MesUi>(
    () => ({
      openLaunch: (preselect) => setLaunch({ open: true, preselect }),
      openPalletScan: () => setPalletOpen(true),
      openFinish: () => setFinishOpen(true),
      toast,
      pendingScan,
      consumePendingScan: () => setPendingScan(null),
      inspectCode: (code) => {
        setPendingScan(code)
        router.push("/mes/codes")
      },
    }),
    [toast, pendingScan, router],
  )

  // Палета собрана → окно скана открывается само (настраивается)
  const palletState = state.pallet.state
  useEffect(() => {
    if (palletState === "awaiting_code" && state.settings.autoOpenPalletScan) setPalletOpen(true)
  }, [palletState, state.settings.autoOpenPalletScan])

  // Глобальный перехват ручного сканера (HID-клавиатура): быстрый ввод + Enter вне полей ввода
  const buf = useRef({ s: "", t: 0 })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return
      const now = performance.now()
      if (now - buf.current.t > 80) buf.current.s = ""
      buf.current.t = now
      if (e.key === "Enter") {
        const code = buf.current.s
        buf.current.s = ""
        if (code.length < 12) return
        if (SSCC_RE.test(code) && active) {
          scanPallet(code)
          setPalletOpen(true)
        } else if (DM_RE.test(code)) {
          setPendingScan(code)
          if (pathname !== "/mes/codes") router.push("/mes/codes")
        }
      } else if (e.key.length === 1) {
        buf.current.s += e.key
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [active, pathname, router, scanPallet])

  const closeLaunch = useCallback(() => setLaunch({ open: false }), [])
  const closePallet = useCallback(() => setPalletOpen(false), [])
  const closeFinish = useCallback(() => setFinishOpen(false), [])

  return (
    <MesUiContext.Provider value={ui}>
      <div className={cn("mes-root flex h-dvh flex-col bg-mes-bg text-mes-ink", state.settings.largeText && "mes-large")}>
        <Header />
        <AlarmBar onScan={() => setPalletOpen(true)} />
        <div className="flex min-h-0 flex-1">
          <Sidebar pathname={pathname} />
          <main className="min-w-0 flex-1 overflow-y-auto p-4 pb-28 sm:p-6 sm:pb-28 xl:pb-6">{children}</main>
        </div>
        <BottomNav pathname={pathname} />

        {/* Оверлеи внутри .mes-root — наследуют шрифт и токены темы */}
        <Toasts toasts={toasts} onClose={(id) => setToasts((xs) => xs.filter((x) => x.id !== id))} />
        <LaunchBatchModal open={launch.open} preselect={launch.preselect} onClose={closeLaunch} />
        <PalletScanModal open={palletOpen && !!active} onClose={closePallet} />
        <FinishBatchModal open={finishOpen} onClose={closeFinish} />
      </div>
    </MesUiContext.Provider>
  )
}

/* ─── Header ─── */

function Clock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])
  return (
    <div className="text-right leading-tight">
      <div className="text-[22px] font-bold tabular-nums text-mes-ink">{now.toLocaleTimeString("ru-RU")}</div>
      <div className="text-[13px] text-mes-ink-3">{now.toLocaleDateString("ru-RU", { weekday: "short", day: "2-digit", month: "long" })}</div>
    </div>
  )
}

function Header() {
  const { state, active } = useMes()
  const line = LINE_LABEL[state.line]
  const eq: { key: keyof typeof state.equipment; label: string; icon: LucideIcon }[] = [
    { key: "printer", label: "Принтер", icon: Printer },
    { key: "camera", label: "Камера", icon: Camera },
    { key: "scanner", label: "Сканер", icon: ScanLine },
    { key: "gis", label: "ГИС МТ", icon: Cloud },
  ]
  return (
    <header className="flex h-[76px] shrink-0 items-center gap-4 border-b border-mes-line bg-mes-card px-4 sm:px-6">
      <Link href="/mes" className="flex items-center gap-3">
        <span className="flex size-12 items-center justify-center rounded-xl bg-mes-olive-strong text-[15px] font-black tracking-tight text-white shadow-[inset_0_-3px_0_rgb(0_0_0/0.18)]">MES</span>
        <span className="hidden leading-tight md:block">
          <span className="block text-[18px] font-bold text-mes-ink">SCADA System MES</span>
          <span className="block text-[13px] text-mes-ink-3">{state.settings.lineName}</span>
        </span>
      </Link>

      <div className="mx-2 hidden h-10 w-px bg-mes-line lg:block" />

      <div className="flex min-w-0 items-center gap-3">
        <StatusPill tone={line.tone} size="lg" pulse={state.line === "running" || state.line === "stopped"}>
          {line.label}
        </StatusPill>
        {active && (
          <span className="hidden truncate text-[16px] text-mes-ink-2 2xl:inline">
            Партия <b className="text-mes-ink">№ {active.number}</b>
          </span>
        )}
      </div>

      <div className="ml-auto hidden items-center gap-1.5 xl:flex">
        {eq.map(({ key, label, icon: Icon }) => {
          const ok = state.equipment[key]
          return (
            <Link
              key={key}
              href="/mes/settings?section=equipment"
              className={cn("flex h-11 items-center gap-2 rounded-xl px-3 text-[14px] font-semibold ring-1", ok ? "bg-mes-panel text-mes-ink-2 ring-mes-line" : "bg-mes-red-soft text-mes-red-strong ring-mes-red/40")}
              title={ok ? `${label}: на связи` : `${label}: нет связи`}
            >
              <Icon className="size-5" />
              <span className="hidden 2xl:inline">{label}</span>
              <span className={cn("size-2.5 rounded-full", ok ? "bg-mes-olive" : "animate-pulse bg-mes-red")} />
            </Link>
          )
        })}
      </div>

      <div className="mx-2 hidden h-10 w-px bg-mes-line xl:block" />

      <div className="ml-auto flex items-center gap-4 xl:ml-0">
        <div className="hidden items-center gap-2.5 lg:flex">
          <span className="flex size-11 items-center justify-center rounded-full bg-mes-olive-soft text-mes-olive-deep">
            <UserRound className="size-6" />
          </span>
          <span className="leading-tight">
            <span className="block text-[15px] font-semibold text-mes-ink">{state.settings.operator}</span>
            <span className="block text-[13px] text-mes-ink-3">Оператор · смена 2</span>
          </span>
        </div>
        <Clock />
      </div>
    </header>
  )
}

/* ─── Полоса аварии: видна на любом экране, пока проблема не решена ─── */

function AlarmBar({ onScan }: { onScan: () => void }) {
  const { state, active } = useMes()
  const pathname = usePathname()
  const offline = (Object.entries(state.equipment) as [string, boolean][]).filter(([, ok]) => !ok)
  const names: Record<string, string> = { printer: "принтер", camera: "камера", scanner: "сканер", gis: "ГИС МТ" }

  let content: { tone: "critical" | "warning"; text: string; action?: ReactNode } | null = null
  if (state.line === "stopped") {
    const reason = offline.length ? `нет связи: ${offline.map(([k]) => names[k]).join(", ")}` : "накопитель заполнен, палета ждёт палетный код"
    content = {
      tone: "critical",
      text: `Аварийный стоп линии — ${reason}`,
      action: !offline.length && active ? <AlarmBtn onClick={onScan}>Сканировать палету</AlarmBtn> : <AlarmLink href="/mes/settings?section=equipment">Оборудование</AlarmLink>,
    }
  } else if (offline.length) {
    content = { tone: "warning", text: `Нет связи: ${offline.map(([k]) => names[k]).join(", ")}`, action: <AlarmLink href="/mes/settings?section=equipment">Оборудование</AlarmLink> }
  } else if (active && pathname !== "/mes" && ["awaiting_code", "scan_error", "code_used"].includes(state.pallet.state)) {
    content = { tone: "warning", text: "Палета собрана — отсканируйте палетный код", action: <AlarmBtn onClick={onScan}>Сканировать палету</AlarmBtn> }
  }
  if (!content) return null
  const t = TONE[content.tone]
  return (
    <div className={cn("flex min-h-14 shrink-0 items-center gap-3 px-4 sm:px-6", t.solid)}>
      <AlertTriangle className="size-6 shrink-0" />
      <p className="flex-1 text-[17px] font-semibold">{content.text}</p>
      {content.action}
    </div>
  )
}

function AlarmBtn({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="h-11 rounded-xl bg-white/95 px-4 text-[15px] font-bold text-mes-ink hover:bg-white">
      {children}
    </button>
  )
}
function AlarmLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="flex h-11 items-center rounded-xl bg-white/95 px-4 text-[15px] font-bold text-mes-ink hover:bg-white">
      {children}
    </Link>
  )
}

/* ─── Навигация: левый рейл на широком экране, нижняя панель на узком ─── */

function isActive(pathname: string, href: string) {
  return href === "/mes" ? pathname === "/mes" : pathname.startsWith(href)
}

function useNavBadges() {
  const { state } = useMes()
  const hourAgo = Date.now() - 3600_000
  return {
    "/mes/events": state.events.filter((e) => e.severity === "critical" && e.at > hourAgo).length,
  } as Record<string, number>
}

function Sidebar({ pathname }: { pathname: string }) {
  const badges = useNavBadges()
  return (
    <nav className="hidden w-[116px] shrink-0 flex-col gap-1.5 border-r border-mes-line bg-mes-card p-2.5 xl:flex">
      {NAV.map(({ href, label, icon: Icon }) => {
        const on = isActive(pathname, href)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "relative flex min-h-[88px] flex-col items-center justify-center gap-1.5 rounded-2xl px-1 text-center text-[13px] font-semibold transition-colors",
              on ? "bg-mes-olive-soft text-mes-olive-deep" : "text-mes-ink-2 hover:bg-mes-panel",
            )}
          >
            {on && <span className="absolute inset-y-4 left-0 w-1 rounded-r-full bg-mes-olive-strong" />}
            <Icon className={cn("size-7", on ? "text-mes-olive-strong" : "text-mes-ink-3")} strokeWidth={2.1} />
            {label}
            {!!badges[href] && <span className="absolute right-3 top-3 flex h-6 min-w-6 items-center justify-center rounded-full bg-mes-red px-1.5 text-[12px] font-bold text-white">{badges[href]}</span>}
          </Link>
        )
      })}
      <div className="mt-auto rounded-xl bg-mes-panel p-2 text-center text-[11px] leading-tight text-mes-ink-3">
        v1.0
        <br />
        прототип
      </div>
    </nav>
  )
}

function BottomNav({ pathname }: { pathname: string }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 grid h-20 grid-cols-6 border-t border-mes-line bg-mes-card xl:hidden">
      {NAV.map(({ href, label, icon: Icon }) => {
        const on = isActive(pathname, href)
        return (
          <Link key={href} href={href} className={cn("flex flex-col items-center justify-center gap-1 text-[12px] font-semibold", on ? "text-mes-olive-deep" : "text-mes-ink-3")}>
            <Icon className={cn("size-6", on && "text-mes-olive-strong")} />
            <span className="truncate">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

/* ─── Уведомления ─── */

const TOAST_ICON = { success: CheckCircle2, warning: AlertTriangle, critical: XCircle, info: Info, neutral: Info }

function Toasts({ toasts, onClose }: { toasts: Toast[]; onClose: (id: string) => void }) {
  return (
    <div className="pointer-events-none fixed right-4 top-[92px] z-[60] flex w-[min(440px,calc(100vw-2rem))] flex-col gap-3">
      {toasts.map((t) => {
        const Icon = TOAST_ICON[t.tone]
        const tone = TONE[t.tone]
        return (
          <div key={t.id} className={cn("mes-slide-in pointer-events-auto flex items-start gap-3 rounded-2xl border bg-mes-card p-4 shadow-xl", tone.border)}>
            <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", tone.soft)}>
              <Icon className={cn("size-6", tone.text)} />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-[16px] font-semibold text-mes-ink">{t.title}</p>
              {t.text && <p className="mt-0.5 text-[14px] text-mes-ink-2">{t.text}</p>}
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
