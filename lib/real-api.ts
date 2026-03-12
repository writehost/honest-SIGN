import type { CisInfoItem, CisHistoryItem } from "./crpt-types"

const TIMEOUT_MS = 45000

/** Базовый путь приложения (например /gsmt при basePath) — определяется по текущему URL */
function getApiBase(): string {
  if (typeof window === "undefined") return ""
  const p = window.location.pathname
  if (p.startsWith("/gsmt")) return "/gsmt"
  return ""
}

async function fetchApi(
  path: string,
  options: RequestInit & { body?: unknown } = {}
): Promise<Response> {
  const url = getApiBase() + path
  const { body, ...rest } = options
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const res = await fetch(url, {
    ...rest,
    signal: controller.signal,
    ...(body !== undefined && { body: typeof body === "string" ? body : JSON.stringify(body) }),
  }).finally(() => clearTimeout(id))
  return res
}

export async function fetchCisInfo(codes: string[], token: string): Promise<CisInfoItem[]> {
  const res = await fetchApi("/api/crpt/info", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: { codes, token },
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { error?: string; error_message?: string; statusCode?: number }
    const msg = data?.error ?? data?.error_message ?? res.statusText
    const ex = new Error(msg) as Error & { statusCode?: number }
    ex.statusCode = data?.statusCode ?? res.status
    throw ex
  }
  return res.json()
}

export async function fetchCisHistory(cis: string, token: string): Promise<CisHistoryItem[]> {
  const res = await fetchApi("/api/crpt/history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: { cis, token },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string; error_message?: string }
    throw new Error(err?.error ?? err?.error_message ?? res.statusText)
  }
  return res.json()
}

export async function getTopParentCis(cis: string, token: string): Promise<string> {
  const res = await fetchApi("/api/crpt/top-parent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: { cis, token },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string })?.error || res.statusText)
  }
  const data = (await res.json()) as { topParent?: string }
  return data.topParent ?? cis
}

export interface CisesSearchItem {
  sgtin?: string
  cis?: string
  gtin?: string
  producerInn?: string
  status?: string
  emissionDate?: string
  generalPackageType?: string
  ownerInn?: string
  productGroup?: string
  haveChildren?: boolean
}

export interface CisesSearchResponse {
  result?: CisesSearchItem[]
}

export async function fetchCisesSearch(
  token: string,
  filter: { gtins: string[]; productGroups: string[] },
  pagination: { perPage: number; direction?: number }
): Promise<CisesSearchResponse> {
  const res = await fetchApi("/api/crpt/cises-search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: { token, filter, pagination },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(err?.error ?? res.statusText)
  }
  return res.json()
}

export async function fetchDocument(
  docId: string,
  token: string,
  productGroup?: number
): Promise<unknown> {
  const pg = productGroup ?? 13
  const res = await fetch(
    `/api/water/document?docId=${encodeURIComponent(docId)}&productGroup=${pg}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string })?.error || res.statusText)
  }
  return res.json()
}

export async function vekasLogin(
  url: string,
  username: string,
  password: string
): Promise<string> {
  const res = await fetchApi("/api/vekas/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: { url, username, password },
  })
  const data = (await res.json()) as { token?: string; error?: string }
  if (!res.ok || !data.token) {
    throw new Error(data.error || "Не удалось войти в Векас")
  }
  return data.token
}

export async function vekasGetInfo(
  apiUrl: string,
  identificationCode: string,
  token: string
): Promise<{ Value?: unknown; IsSuccess?: boolean }> {
  const res = await fetchApi("/api/vekas/get-info", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: { apiUrl, token, identificationCode },
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error((data as { error?: string })?.error || res.statusText)
  }
  return data as { Value?: unknown; IsSuccess?: boolean }
}
