"use client"

import { useState, useCallback, useEffect } from "react"
import { SearchInput } from "@/components/search-input"
import { ResultView } from "@/components/result-view"
import { ThemeToggle } from "@/components/theme-toggle"
import { LoadingView } from "@/components/loading-skeleton"
import {
  fetchCisInfo,
  fetchCisHistory,
  getTopParentCis,
  vekasLogin,
  vekasGetInfo,
} from "@/lib/real-api"
import { cisInfoToCodeEntry, historyToChestnyZnakData, vekasToIntegratorData } from "@/lib/mappers"
import type { CodeEntry, ChestnyZnakData, IntegratorData, CodeStatus } from "@/lib/mock-data"
import { StatusBadge } from "@/components/status-badge"
import { getStatusLabel } from "@/lib/status-labels"
import { AlertCircle, Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

const TOKEN_KEY = "crpt_bearer_token"
const RECENT_CODES_KEY = "crpt_recent_codes"
const MAX_RECENT = 6

export interface RecentItem {
  code: string
  owner?: string
  ownerInn?: string
  status?: string
  groupType?: string
}

function loadRecentFromStorage(): RecentItem[] {
  if (typeof window === "undefined") return []
  try {
    const s = localStorage.getItem(RECENT_CODES_KEY)
    if (!s) return []
    const raw = JSON.parse(s) as unknown
    if (!Array.isArray(raw)) return []
    return raw.map((x) =>
      typeof x === "string" ? { code: x } : { code: (x as RecentItem).code, owner: (x as RecentItem).owner, ownerInn: (x as RecentItem).ownerInn, status: (x as RecentItem).status, groupType: (x as RecentItem).groupType }
    )
  } catch {
    return []
  }
}

type AppState =
  | { view: "home" }
  | { view: "loading"; query: string }
  | { view: "result"; entry: CodeEntry; cz?: ChestnyZnakData; int?: IntegratorData }
  | { view: "not-found"; query: string; error?: string; errorStatus?: number }

export default function Home() {
  const [token, setToken] = useState(() => {
    if (typeof window === "undefined") return ""
    return localStorage.getItem(TOKEN_KEY) ?? ""
  })
  const [vekasEnabled, setVekasEnabled] = useState(true)
  const [vekasLoginUrl, setVekasLoginUrl] = useState("http://192.168.253.11:8480")
  const [vekasApiUrl, setVekasApiUrl] = useState("http://192.168.254.2:8180")
  const [vekasUsername, setVekasUsername] = useState("admin")
  const [vekasPassword, setVekasPassword] = useState("vekas")
  const [recentItems, setRecentItems] = useState<RecentItem[]>([])
  const [state, setState] = useState<AppState>({ view: "home" })
  const [hasMounted, setHasMounted] = useState(false)

  useEffect(() => {
    setHasMounted(true)
    setRecentItems(loadRecentFromStorage())
  }, [])

  const saveToken = useCallback((v: string) => {
    setToken(v)
    if (typeof window !== "undefined") localStorage.setItem(TOKEN_KEY, v)
  }, [])

  const addRecent = useCallback((item: RecentItem) => {
    setRecentItems((prev) => {
      const next = [item, ...prev.filter((r) => r.code !== item.code)].slice(0, MAX_RECENT)
      if (typeof window !== "undefined") localStorage.setItem(RECENT_CODES_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const handleSearch = useCallback(
    async (query: string) => {
      const q = query.trim()
      if (!q) return
      setState({ view: "loading", query: q })
      const crptToken = token.trim()
      if (!crptToken) {
        setState({ view: "not-found", query: q, error: "Введите токен авторизации Честного ЗНАКа в настройках." })
        return
      }
      try {
        const infoList = await fetchCisInfo([q], crptToken)
        const first = infoList?.[0]
        const entry = first ? cisInfoToCodeEntry(first, 0) : null
        if (!entry) {
          setState({ view: "not-found", query: q, error: "Код не найден в Честном ЗНАКе." })
          return
        }
        addRecent({
          code: entry.code,
          owner: entry.owner,
          ownerInn: entry.ownerInn,
          status: entry.status,
          groupType: entry.groupType,
        })
        let cz: ChestnyZnakData | undefined
        let int: IntegratorData | undefined
        try {
          const history = await fetchCisHistory(entry.code, crptToken)
          const list = Array.isArray(history) ? history : []
          const lastStatus = list[list.length - 1]?.status
          cz = historyToChestnyZnakData(list, lastStatus ? getStatusLabel(lastStatus) : undefined)
          // Родительский код берём из истории (в cisInfo его нет)
          const withParent = list.find((h) => h.parent)
          if (withParent?.parent) entry.parentCode = withParent.parent
        } catch {
          cz = historyToChestnyZnakData([])
        }
        if (vekasEnabled && vekasLoginUrl.trim() && vekasApiUrl.trim()) {
          try {
            const vekasToken = await vekasLogin(vekasLoginUrl.trim(), vekasUsername.trim(), vekasPassword)
            const info = first?.cisInfo
            const isBox = info?.generalPackageType === "BOX" || info?.packageType === "LEVEL2"
            const codeForVekas = isBox ? entry.code : await getTopParentCis(entry.code, crptToken)
            const vekasRes = await vekasGetInfo(vekasApiUrl.trim(), codeForVekas, vekasToken)
            if (vekasRes?.IsSuccess && vekasRes.Value) {
              int = vekasToIntegratorData(vekasRes as { Value?: Record<string, unknown> })
            }
          } catch {
            // Vekas optional
          }
        }
        setState({ view: "result", entry, cz, int })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        const statusCode = (e as Error & { statusCode?: number }).statusCode
        setState({ view: "not-found", query: q, error: msg, errorStatus: statusCode })
      }
    },
    [token, addRecent, vekasEnabled, vekasLoginUrl, vekasApiUrl, vekasUsername, vekasPassword]
  )

  const handleBack = useCallback(() => {
    setState({ view: "home" })
  }, [])

  if (state.view === "loading") {
    return <LoadingView />
  }

  if (state.view === "result") {
    return (
      <ResultView
        entry={state.entry}
        chestnyZnakData={state.cz}
        integratorData={state.int}
        onBack={handleBack}
        onSearch={handleSearch}
        crptToken={token}
      />
    )
  }

  return (
    <HomeView
      state={state}
      onSearch={handleSearch}
      token={token}
      saveToken={saveToken}
      recentItems={recentItems}
      hasMounted={hasMounted}
      vekasEnabled={vekasEnabled}
      setVekasEnabled={setVekasEnabled}
      vekasLoginUrl={vekasLoginUrl}
      setVekasLoginUrl={setVekasLoginUrl}
      vekasApiUrl={vekasApiUrl}
      setVekasApiUrl={setVekasApiUrl}
      vekasUsername={vekasUsername}
      setVekasUsername={setVekasUsername}
      vekasPassword={vekasPassword}
      setVekasPassword={setVekasPassword}
    />
  )
}

function HomeView({
  state,
  onSearch,
  token,
  saveToken,
  recentItems,
  hasMounted,
  vekasEnabled,
  setVekasEnabled,
  vekasLoginUrl,
  setVekasLoginUrl,
  vekasApiUrl,
  setVekasApiUrl,
  vekasUsername,
  setVekasUsername,
  vekasPassword,
  setVekasPassword,
}: {
  state: Extract<AppState, { view: "home" }> | Extract<AppState, { view: "not-found" }>
  onSearch: (query: string) => void
  token: string
  saveToken: (v: string) => void
  recentItems: RecentItem[]
  hasMounted: boolean
  vekasEnabled: boolean
  setVekasEnabled: (v: boolean) => void
  vekasLoginUrl: string
  setVekasLoginUrl: (v: string) => void
  vekasApiUrl: string
  setVekasApiUrl: (v: string) => void
  vekasUsername: string
  setVekasUsername: (v: string) => void
  vekasPassword: string
  setVekasPassword: (v: string) => void
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="shrink-0 px-4 sm:px-6 py-4 flex items-center justify-between gap-2 min-h-[3.5rem]">
        <div className="w-16 sm:w-24 shrink-0" />
        <h1 className="text-base sm:text-lg font-semibold text-foreground tracking-tight text-center flex-1 min-w-0 truncate">
          SCADA SYSTEM
        </h1>
        <div className="flex items-center gap-2 shrink-0">
          <ThemeToggle />
          <span className="text-[10px] font-mono text-muted-foreground/40 px-2 py-1 rounded bg-secondary border border-border hidden sm:inline">
            v1.0
          </span>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-6 sm:py-8">
        <div className="w-full max-w-3xl space-y-8">
          <div className="text-center space-y-3">
            <h2 className="text-2xl sm:text-4xl font-semibold text-foreground tracking-tight text-balance break-words">
              Анализ DataMatrix кодов
            </h2>
          </div>

          {/* Настройки: токен и Векас */}
          <Collapsible className="w-full max-w-3xl mx-auto">
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Settings2 className="size-4" />
                Настройки (токен, Векас)
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4 space-y-4">
              <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs">Токен авторизации (Bearer) Честный ЗНАК</Label>
                <Input
                  type="password"
                  placeholder="JWT из личного кабинета"
                  value={token}
                  onChange={(e) => saveToken(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={vekasEnabled}
                  onChange={(e) => setVekasEnabled(e.target.checked)}
                />
                Параллельный поиск в Векас (палета/коробка)
              </label>
              {vekasEnabled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="space-y-1">
                    <Label className="text-xs">URL входа Векас</Label>
                    <Input
                      value={vekasLoginUrl}
                      onChange={(e) => setVekasLoginUrl(e.target.value)}
                      placeholder="http://192.168.253.11:8480"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">URL API Векас</Label>
                    <Input
                      value={vekasApiUrl}
                      onChange={(e) => setVekasApiUrl(e.target.value)}
                      placeholder="http://192.168.254.2:8180"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Логин</Label>
                    <Input value={vekasUsername} onChange={(e) => setVekasUsername(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Пароль</Label>
                    <Input type="password" value={vekasPassword} onChange={(e) => setVekasPassword(e.target.value)} />
                  </div>
                </div>
              )}
              </form>
            </CollapsibleContent>
          </Collapsible>

          {hasMounted && !token.trim() && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-2 text-sm text-amber-800 dark:text-amber-200">
              Откройте «Настройки (токен, Векас)» и введите JWT-токен из личного кабинета Честного ЗНАКа — без токена проверка не выполнится.
            </div>
          )}
          <SearchInput onSearch={onSearch} />

          {state.view === "not-found" && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-destructive/5 border border-destructive/10 max-w-3xl mx-auto">
              <AlertCircle className="size-4 text-destructive shrink-0" />
              <div>
                <p className="text-sm text-foreground/90">
                  {state.errorStatus === 401
                    ? "Ошибка авторизации (токен)"
                    : state.errorStatus === 404
                      ? "Код не найден"
                      : "Код не найден или ошибка"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {state.error || `Запрос «${state.query}» не найден.`}
                </p>
                {state.errorStatus === 401 && (
                  <p className="text-[11px] text-muted-foreground/80 mt-2">
                    Убедитесь, что в настройках введён действующий JWT-токен из личного кабинета Честного ЗНАКа (раздел API). Если токен истёк — получите новый.
                  </p>
                )}
                {state.errorStatus === 404 && (
                  <p className="text-[11px] text-muted-foreground/80 mt-2">
                    Такого кода нет в системе маркировки Честный ЗНАК или у вашей организации нет прав на его просмотр.
                  </p>
                )}
              </div>
            </div>
          )}

          {recentItems.length > 0 && (
            <div className="pt-4">
              <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Недавние запросы
                </h3>
                <span className="text-[10px] text-muted-foreground/50">
                  {recentItems.length} записей
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {recentItems.map((item) => (
                  <button
                    key={item.code}
                    onClick={() => onSearch(item.code)}
                    className="group flex flex-col gap-2 p-3.5 rounded-xl bg-card border border-border hover:border-accent/20 hover:bg-secondary/50 transition-all text-left min-w-0 overflow-hidden"
                  >
                    {item.status && (
                      <span className="shrink-0">
                        <StatusBadge status={item.status as CodeStatus} />
                      </span>
                    )}
                    <p className="font-mono text-[11px] text-foreground/70 truncate w-full min-w-0">
                      {item.code}
                    </p>
                    {item.owner && (
                      <p className="text-xs text-muted-foreground truncate w-full min-w-0">
                        {item.owner}
                      </p>
                    )}
                    {item.ownerInn && item.ownerInn !== "—" && (
                      <p className="text-[10px] text-muted-foreground/70 font-mono truncate w-full min-w-0">
                        ИНН {item.ownerInn}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="shrink-0 px-4 sm:px-6 py-4 flex items-center justify-center">
        <p className="text-[10px] text-muted-foreground/30">
          DataMatrix Inspector / Честный ЗНАК + Векас
        </p>
      </footer>
    </div>
  )
}
