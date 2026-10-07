import { useEffect, useRef } from 'react'

/**
 * Bluetooth / USB barcode scanners in HID mode "type" the code very fast and
 * press Enter. We listen on window, so nothing needs focus and the phone's
 * soft keyboard never pops up. Human typing (>60 ms between keys) is ignored
 * unless the target is a regular input.
 */
export function useHidScanner(onScan: (code: string) => void, enabled = true) {
  const cb = useRef(onScan)
  cb.current = onScan
  useEffect(() => {
    if (!enabled) return
    let buf = ''
    let last = 0
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      const nowTs = performance.now()
      if (nowTs - last > 60) buf = ''
      last = nowTs
      if (e.key === 'Enter') {
        if (buf.length >= 3) {
          e.preventDefault()
          cb.current(buf)
        }
        buf = ''
      } else if (e.key.length === 1) {
        buf += e.key
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled])
}
