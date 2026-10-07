import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { getDB, scope, subscribe } from '@/domain/db'
import type { Ctx } from '@/domain/types'
import { setFeedbackPrefs } from '@/lib/feedback'

const SESSION_KEY = 'scada-wms/session'

export function useDB() {
  return useSyncExternalStore(subscribe, getDB)
}

// Per-tab session (sessionStorage) so a cabinet tab and a terminal tab can be
// signed in as different people; localStorage remembers the last sign-in.
function readSession(): Ctx | null {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? localStorage.getItem(SESSION_KEY) ?? 'null')
  } catch {
    return null
  }
}

const SessionCtx = createContext<{ session: Ctx | null; setSession: (s: Ctx | null) => void }>({
  session: null,
  setSession: () => {},
})

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, set] = useState<Ctx | null>(readSession)
  const setSession = (s: Ctx | null) => {
    if (s) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(s))
      localStorage.setItem(SESSION_KEY, JSON.stringify(s))
    } else {
      sessionStorage.removeItem(SESSION_KEY)
      localStorage.removeItem(SESSION_KEY)
    }
    set(s)
  }
  return <SessionCtx.Provider value={{ session, setSession }}>{children}</SessionCtx.Provider>
}

export const useSession = () => useContext(SessionCtx)

/** Everything a signed-in screen needs: tenant-scoped data, the actor, the org settings. */
export function useApp() {
  const { session } = useSession()
  const db = useDB()
  const s = useMemo(() => scope(db, { orgId: session?.orgId ?? '' }), [db, session?.orgId])
  const user = s.users.find((u) => u.id === session?.userId)
  const org = s.org
  useEffect(() => {
    if (org) setFeedbackPrefs(org.settings)
  }, [org])
  return { ctx: session as Ctx, s, user: user!, org: org!, warehouse: s.warehouses[0] }
}
