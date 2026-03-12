import { NextRequest, NextResponse } from "next/server"

const MARKIROVKA_BASE = "https://markirovka.crpt.ru/api/v3/true-api"
const TIMEOUT_MS = 45000
const MAX_DEPTH = 25

async function fetchHistory(cis: string, token: string): Promise<unknown[]> {
  const url = `${MARKIROVKA_BASE}/cises/history?cis=${encodeURIComponent(cis)}`
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: "{}",
    signal: controller.signal,
  }).finally(() => clearTimeout(id))
  if (!res.ok) throw new Error(await res.text() || `HTTP ${res.status}`)
  return res.json()
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { cis, token } = body as { cis?: string; token?: string }
    if (!cis || !token) {
      return NextResponse.json(
        { error: "Требуются cis и token" },
        { status: 400 }
      )
    }
    let current = cis
    for (let i = 0; i < MAX_DEPTH; i++) {
      const history = (await fetchHistory(current, token)) as Array<{ parent?: string; status?: string; timestamp?: string }>
      const withParent = history.filter((h) => h.parent != null && String(h.parent).trim() !== "")
      if (withParent.length === 0) break
      const byIntroduced = withParent.find((h) => h.status === "INTRODUCED")
      const entry = byIntroduced ?? withParent.sort((a, b) => (a.timestamp || "").localeCompare(b.timestamp || ""))[0]
      const nextParent = entry!.parent!
      if (nextParent === current) break
      current = nextParent
      if (current.startsWith("00")) break
    }
    return NextResponse.json({ topParent: current })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
