import { useEffect, useState } from 'react'

/**
 * State of an operation in progress, kept on the device. A dropped
 * connection, a locked screen or a reload never loses the current step.
 */
export function usePersistentState<T>(key: string, initial: T) {
  const k = `scada-wms/draft/${key}`
  const [v, setV] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(k)
      return raw ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* ignore */ }
  }, [k, v])
  return [v, setV] as const
}
