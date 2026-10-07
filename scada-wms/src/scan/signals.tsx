import { useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { AlertTriangle, XOctagon } from 'lucide-react'
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
      {f && <div key={k} className="flash-ok pointer-events-none fixed inset-0 z-[70] bg-ok" />}
      {e && <ErrorScreen e={e} />}
    </>
  )
}

function ErrorScreen({ e }: { e: ScanError }) {
  const red = e.tone === 'err'
  return (
    <div
      role="alertdialog"
      aria-label={e.title}
      className={`fixed inset-0 z-[80] flex flex-col text-white terminal ${red ? 'bg-err' : 'bg-[#8f5200]'}`}
    >
      <div className="flex-1 overflow-y-auto px-6 pt-[max(40px,env(safe-area-inset-top))] pb-4 shake">
        {red ? <XOctagon size={56} strokeWidth={1.8} /> : <AlertTriangle size={56} strokeWidth={1.8} />}
        <h1 className="mt-5 text-[34px] leading-[1.05] font-bold tracking-tight uppercase">{e.title}</h1>
        {e.reason && <p className="mt-3 text-lg leading-snug text-white/90">{e.reason}</p>}
        {(e.expected || e.scanned) && (
          <div className="mt-7 grid gap-3">
            {e.expected && <SideCard s={e.expected} />}
            {e.scanned && <SideCard s={e.scanned} strike />}
          </div>
        )}
      </div>
      <div className="px-5 pt-3 safe-b grid gap-2.5">
        <button
          autoFocus
          onClick={clearError}
          className={`h-16 rounded-xl text-lg font-semibold bg-white ${red ? 'text-err' : 'text-[#8f5200]'}`}
        >
          {e.dismissLabel ?? 'Понятно — сканировать снова'}
        </button>
        {e.confirm && (
          <button
            onClick={() => { const c = e.confirm!; clearError(); c.onConfirm() }}
            className="h-14 rounded-xl text-base font-medium border-2 border-white/60 text-white"
          >
            {e.confirm.label}
          </button>
        )}
      </div>
    </div>
  )
}

function SideCard({ s, strike }: { s: Side; strike?: boolean }) {
  return (
    <div className={`rounded-xl px-4 py-3 ${strike ? 'bg-black/25' : 'bg-white/15'}`}>
      <div className="text-[13px] uppercase tracking-wide text-white/75 font-medium">{s.caption}</div>
      <div className="mt-1 text-[22px] font-semibold font-mono leading-tight">{s.primary}</div>
      {s.secondary && <div className="text-base text-white/90 leading-snug">{s.secondary}</div>}
    </div>
  )
}
