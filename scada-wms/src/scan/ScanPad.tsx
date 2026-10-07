import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Bluetooth, Camera, CameraOff, Keyboard, ScanLine, Sparkles, X } from 'lucide-react'
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
    <div className="flex flex-col gap-3">
      <div
        className={cx('relative overflow-hidden rounded-2xl bg-night text-white', compact ? 'h-[150px]' : 'h-[min(34vh,260px)]')}
        onClick={() => !cam && cameraSupported() && toggleCam()}
      >
        {cam && <video ref={videoRef} muted playsInline className="absolute inset-0 w-full h-full object-cover" />}
        {/* viewfinder */}
        <div className={cx('absolute pointer-events-none', compact ? 'inset-[10%_8%]' : 'inset-[8%_7%]')}>
          {['top-0 left-0 border-t-[3px] border-l-[3px] rounded-tl-lg', 'top-0 right-0 border-t-[3px] border-r-[3px] rounded-tr-lg', 'bottom-0 left-0 border-b-[3px] border-l-[3px] rounded-bl-lg', 'bottom-0 right-0 border-b-[3px] border-r-[3px] rounded-br-lg'].map((c) => (
            <span key={c} className={cx('absolute w-7 h-7 border-signal', c)} />
          ))}
          {cam && <span className="scanline absolute left-2 right-2 h-[2px] bg-signal/80 shadow-[0_0_12px_2px_rgba(255,210,63,.5)]" />}
        </div>
        {!cam && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-6">
            <ScanLine size={compact ? 24 : 30} className="text-signal" />
            <div className={cx('font-medium', compact ? 'text-[14px]' : 'text-[15px]')}>Сканер готов</div>
            <div className="text-[12px] text-white/60">Нажмите, чтобы включить камеру</div>
            {camErr && <div className="text-[13px] text-[#ffb4ad]">{camErr}</div>}
          </div>
        )}
        {cam && (
          <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 text-[11px] font-medium text-white/80 bg-black/40 rounded-full pl-2 pr-2.5 h-6">
            <Bluetooth size={12} /> Сканер готов
          </div>
        )}
        {cameraSupported() && (
          <button
            onClick={(e) => { e.stopPropagation(); toggleCam() }}
            className="absolute top-2 right-2 h-8 w-8 grid place-items-center rounded-full bg-black/40 text-white"
            aria-label={cam ? 'Выключить камеру' : 'Включить камеру'}
          >
            {cam ? <CameraOff size={16} /> : <Camera size={16} />}
          </button>
        )}
      </div>

      <div className="px-1">
        <div className="text-[13px] font-medium uppercase tracking-wide text-ink-3">{prompt}</div>
        {target && <div className="mt-1.5">{target}</div>}
      </div>

      <div className="flex gap-2">
        <button onClick={() => setManual(true)} className="flex-1 h-12 rounded-xl border border-line-2 bg-surface text-[15px] font-medium flex items-center justify-center gap-2 text-ink-2">
          <Keyboard size={18} /> Ввести код
        </button>
        {demoEnabled && demo && demo.length > 0 && (
          <button onClick={() => setDemoOpen(true)} className="flex-1 h-12 rounded-xl border border-dashed border-ink-3 text-[15px] font-medium flex items-center justify-center gap-2 text-ink-2" data-testid="demo-open">
            <Sparkles size={17} /> Демо-скан
          </button>
        )}
      </div>

      {manual && <ManualSheet onClose={() => setManual(false)} onSubmit={(c) => { setManual(false); fire(c) }} />}
      {demoOpen && demo && (
        <Sheet title="Демо-сканер" onClose={() => setDemoOpen(false)}>
          <p className="text-[13px] text-ink-2 mb-3">Нажмите на код — это то же самое, что навести камеру или сканер на этикетку.</p>
          <div className="grid gap-2">
            {demo.map((d) => (
              <button
                key={d.code + d.label}
                data-code={d.code}
                onClick={() => { setDemoOpen(false); setTimeout(() => fire(d.code), 60) }}
                className={cx('text-left rounded-xl border px-4 py-3 bg-surface', d.tone === 'bad' ? 'border-err/40' : d.tone === 'ok' ? 'border-ok/40' : 'border-line-2')}
              >
                <div className="font-mono text-[15px] font-semibold">{d.code}</div>
                <div className={cx('text-[13px]', d.tone === 'bad' ? 'text-err' : 'text-ink-2')}>{d.label}</div>
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
      <div className="absolute inset-0 bg-night/40" onClick={onClose} />
      <div className="relative bg-paper rounded-t-2xl max-h-[85vh] flex flex-col rise">
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <div className="text-lg font-semibold">{title}</div>
          <button onClick={onClose} className="h-10 w-10 grid place-items-center rounded-full bg-sunken" aria-label="Закрыть"><X size={20} /></button>
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
          className="h-14 px-4 rounded-xl border border-line-2 bg-surface text-lg font-mono focus:outline-none focus:border-ink"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          data-testid="manual-input"
        />
        <button className="h-14 rounded-xl bg-ink text-white text-lg font-semibold">Готово</button>
      </form>
    </Sheet>
  )
}
