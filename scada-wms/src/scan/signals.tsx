import { useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { AlertTriangle, Check, XOctagon } from 'lucide-react'
import { feedback } from '@/lib/feedback'

// Full-screen scan results. Errors block the screen until acknowledged —
// there is deliberately no "add anyway" button.

export interface Side {
  caption: string
  primary: ReactNode
  secondary?: ReactNode
}

export interface ScanError {
  tone: 'err' | 'warn'
  title: string
  reason?: ReactNode
  expected?: Side
  scanned?: Side
  /** Warnings may offer a conscious override; errors never do. */
  confirm?: { label: string; onConfirm: () => void }
  dismissLabel?: string
}

let flashKey = 0
let error: ScanError | null = null
let snap: { flashKey: number; flashing: boolean; error: ScanError | null } = { flashKey, flashing: false, error }
const ls = new Set<() => void>()
const emit = () => { snap = { flashKey, flashing, error }; ls.forEach((l) => l()) }

let flashTimer: ReturnType<typeof setTimeout> | undefined
let flashing = false

export function flashOk(final = false) {
  flashKey++
  flashing = true
  if (final) feedback.done()
  else feedback.ok()
  emit()
  clearTimeout(flashTimer)
  flashTimer = setTimeout(() => { flashing = false; emit() }, 450)
}

export function showError(e: ScanError) {
  error = e
  if (e.tone === 'err') feedback.error()
  else feedback.warn()
  emit()
}

export function clearError() {
  error = null
  emit()
}

export const isBlocked = () => error !== null

export function useSignals() {
  return useSyncExternalStore((l) => { ls.add(l); return () => ls.delete(l) }, () => snap)
}

export function SignalLayer() {
  const { flashKey: k, flashing: f, error: e } = useSignals()
  return (
    <>
      {f && (
        <div key={k} className="pointer-events-none fixed inset-x-0 top-0 z-[70] mx-auto max-w-[520px]" role="status" aria-label="Скан принят">
          <div className="scan-ok-line h-1 bg-primary" />
          <div className="rise mx-auto mt-2 w-fit flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-[13px] font-medium text-foreground shadow-sm">
            <span className="grid h-4 w-4 place-items-center rounded-full bg-primary text-primary-foreground"><Check size={11} strokeWidth={3} /></span>
            Принято
          </div>
        </div>
      )}
      {e && <ErrorScreen e={e} />}
    </>
  )
}

/** Blocking result. Calm page, one strong red (or amber) accent, the reason in plain words. */
function ErrorScreen({ e }: { e: ScanError }) {
  const red = e.tone === 'err'
  return (
    <div role="alertdialog" aria-label={e.title} className="terminal fixed inset-0 z-[80] flex flex-col bg-background">
      <div className={red ? 'h-2 bg-destructive' : 'h-2 bg-amber-500'} />
      <div className="mx-auto w-full max-w-[520px] flex-1 overflow-y-auto px-4 pt-[max(20px,env(safe-area-inset-top))] pb-4">
        <div className={`shake overflow-hidden rounded-2xl border bg-card shadow-sm ${red ? 'border-destructive/30' : 'border-amber-500/40'}`}>
          <div className={`flex items-start gap-3 px-4 py-4 ${red ? 'bg-destructive/5' : 'bg-amber-500/10'}`}>
            <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${red ? 'bg-destructive text-destructive-foreground' : 'bg-amber-500 text-white'}`}>
              {red ? <XOctagon size={24} strokeWidth={2} /> : <AlertTriangle size={24} strokeWidth={2} />}
            </div>
            <div className="min-w-0">
              <h1 className={`text-[26px] leading-[1.1] font-bold tracking-tight uppercase ${red ? 'text-destructive' : 'text-amber-900'}`}>{e.title}</h1>
              {e.reason && <p className="mt-1.5 text-[15px] leading-snug text-foreground">{e.reason}</p>}
            </div>
          </div>
          {(e.expected || e.scanned) && (
            <div className="divide-y divide-border border-t border-border">
              {e.expected && <SideRow s={e.expected} />}
              {e.scanned && <SideRow s={e.scanned} wrong={red} />}
            </div>
          )}
        </div>
      </div>
      <div className="mx-auto w-full max-w-[520px] px-4 pt-3 safe-b grid gap-2 border-t border-border bg-card">
        <button
          autoFocus
          onClick={clearError}
          className="h-14 rounded-xl bg-primary text-primary-foreground text-base font-semibold active:scale-[0.99]"
        >
          {e.dismissLabel ?? 'Понятно — сканировать снова'}
        </button>
        {e.confirm && (
          <button
            onClick={() => { const c = e.confirm!; clearError(); c.onConfirm() }}
            className="h-12 rounded-xl border border-border bg-background text-[15px] font-medium text-foreground"
          >
            {e.confirm.label}
          </button>
        )}
      </div>
    </div>
  )
}

function SideRow({ s, wrong }: { s: Side; wrong?: boolean }) {
  return (
    <div className={`px-4 py-3 ${wrong ? 'shadow-[inset_4px_0_0_var(--destructive)]' : 'shadow-[inset_4px_0_0_var(--primary)]'}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{s.caption}</div>
      <div className={`mt-0.5 font-mono text-[20px] font-semibold leading-tight ${wrong ? 'text-destructive' : 'text-foreground'}`}>{s.primary}</div>
      {s.secondary && <div className="text-[15px] text-muted-foreground leading-snug">{s.secondary}</div>}
    </div>
  )
}
