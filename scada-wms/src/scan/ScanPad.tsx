import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Camera, CameraOff, Keyboard, Sparkles, X } from 'lucide-react'
import { cameraSupported, startCamera } from './camera'
import { useHidScanner } from './useHidScanner'
import { isBlocked, useSignals } from './signals'
import { cx } from '@/lib/format'

export interface DemoCode {
  code: string
  label: string
  tone?: 'ok' | 'bad' | 'neutral'
}

const CAM_KEY = 'scada-wms/camera'
const camPref = () => { try { return localStorage.getItem(CAM_KEY) === '1' } catch { return false } }

/**
 * The scan area used by every mobile operation. Accepts the camera, a HID
 * scanner (nothing to focus) and manual entry. Scans are ignored while a
 * full-screen error is waiting for acknowledgement.
 */
export function ScanPad({
  onScan, prompt, target, demo, compact, demoEnabled = true,
}: {
  onScan: (code: string) => void
  prompt: ReactNode
  target?: ReactNode
  demo?: DemoCode[]
  compact?: boolean
  demoEnabled?: boolean
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [cam, setCam] = useState(camPref)
  const [camErr, setCamErr] = useState<string | null>(null)
  const [manual, setManual] = useState(false)
  const [demoOpen, setDemoOpen] = useState(false)
  const { error } = useSignals()
  const handler = useRef(onScan)
  handler.current = onScan

  const fire = (code: string) => {
    if (isBlocked()) return
    handler.current(code.trim())
  }

  useHidScanner(fire, !manual && !error)

  useEffect(() => {
    if (!cam || !videoRef.current) return
    let stop: (() => void) | null = null
    let cancelled = false
    setCamErr(null)
    startCamera(videoRef.current, fire)
      .then((s) => { if (cancelled) s(); else stop = s })
      .catch((e: Error) => {
        setCamErr(e.name === 'NotAllowedError' ? 'Нет доступа к камере. Разрешите его в настройках браузера.' : 'Камера недоступна на этом устройстве')
        setCam(false)
      })
    return () => { cancelled = true; stop?.() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cam])

  const toggleCam = () => {
    const v = !cam
    setCam(v)
    try { localStorage.setItem(CAM_KEY, v ? '1' : '0') } catch { /* ignore */ }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
      <div className="px-4 pt-3 pb-3">
        <div className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">{prompt}</div>
        {target && <div className="mt-2">{target}</div>}
      </div>

      {cam && (
        <div className={cx('relative overflow-hidden bg-foreground', compact ? 'h-[170px]' : 'h-[min(32vh,240px)]')}>
          <video ref={videoRef} muted playsInline className="absolute inset-0 h-full w-full object-cover" />
          <div className="pointer-events-none absolute inset-[12%_14%]">
            {['top-0 left-0 border-t-4 border-l-4 rounded-tl-lg', 'top-0 right-0 border-t-4 border-r-4 rounded-tr-lg', 'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-lg', 'bottom-0 right-0 border-b-4 border-r-4 rounded-br-lg'].map((c) => (
              <span key={c} className={cx('absolute h-8 w-8 border-primary', c)} />
            ))}
            <span className="animate-scan-line absolute left-2 right-2 h-0.5 bg-primary" />
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 border-t border-border/70 bg-background/60 px-3 py-2.5">
        <span className="flex min-w-0 flex-1 items-center gap-2 text-[13px] font-medium text-foreground">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
          </span>
          <span className="truncate">{camErr ?? 'Сканер готов'}</span>
        </span>
        {cameraSupported() && (
          <button onClick={toggleCam} className={cx('grid h-11 w-11 place-items-center rounded-xl border', cam ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground')} aria-label={cam ? 'Выключить камеру' : 'Включить камеру'}>
            {cam ? <CameraOff size={18} /> : <Camera size={18} />}
          </button>
        )}
        <button onClick={() => setManual(true)} className="grid h-11 w-11 place-items-center rounded-xl border border-border bg-card text-foreground" aria-label="Ввести код">
          <Keyboard size={18} />
        </button>
        {demoEnabled && demo && demo.length > 0 && (
          <button onClick={() => setDemoOpen(true)} className="flex h-11 items-center gap-1.5 rounded-xl border border-dashed border-foreground/30 bg-card px-3 text-[13px] font-medium text-foreground" data-testid="demo-open">
            <Sparkles size={15} /> Демо
          </button>
        )}
      </div>

      {manual && <ManualSheet onClose={() => setManual(false)} onSubmit={(c) => { setManual(false); fire(c) }} />}
      {demoOpen && demo && (
        <Sheet title="Демо-сканер" onClose={() => setDemoOpen(false)}>
          <p className="text-[13px] text-muted-foreground mb-3">Нажмите на код — это то же самое, что навести камеру или сканер на этикетку.</p>
          <div className="grid gap-2">
            {demo.map((d) => (
              <button
                key={d.code + d.label}
                data-code={d.code}
                onClick={() => { setDemoOpen(false); setTimeout(() => fire(d.code), 60) }}
                className={cx('text-left rounded-xl border border-border px-4 py-3 bg-card', d.tone === 'bad' ? 'shadow-[inset_4px_0_0_var(--destructive)]' : d.tone === 'ok' ? 'shadow-[inset_4px_0_0_var(--primary)]' : '')}
              >
                <div className="font-mono text-[15px] font-semibold">{d.code}</div>
                <div className={cx('text-[13px]', d.tone === 'bad' ? 'text-destructive' : 'text-muted-foreground')}>{d.label}</div>
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </div>
  )
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-foreground/40" onClick={onClose} />
      <div className="relative mx-auto w-full max-w-[520px] bg-background border-t border-border rounded-t-2xl max-h-[85vh] flex flex-col shadow-lg rise">
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <div className="text-base font-semibold tracking-tight">{title}</div>
          <button onClick={onClose} className="h-10 w-10 grid place-items-center rounded-xl border border-border bg-card text-muted-foreground" aria-label="Закрыть"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto px-5 pb-6 safe-b">{children}</div>
      </div>
    </div>
  )
}

function ManualSheet({ onClose, onSubmit }: { onClose: () => void; onSubmit: (c: string) => void }) {
  const [v, setV] = useState('')
  return (
    <Sheet title="Ввести код вручную" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); if (v.trim()) onSubmit(v) }} className="grid gap-3">
        <input
          autoFocus
          value={v}
          onChange={(e) => setV(e.target.value)}
          placeholder="Штрихкод, SKU, ячейка или № заказа"
          className="h-14 px-4 rounded-xl border border-input bg-card text-lg font-mono shadow-xs outline-none placeholder:text-muted-foreground placeholder:font-sans placeholder:text-base focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          data-testid="manual-input"
        />
        <button className="h-14 rounded-xl bg-primary text-primary-foreground text-base font-semibold">Готово</button>
      </form>
    </Sheet>
  )
}
