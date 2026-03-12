import { NextRequest, NextResponse } from "next/server"

const MARKIROVKA_BASE = "https://markirovka.crpt.ru/api/v4/true-api"
const TIMEOUT_MS = 45000

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      token?: string
      filter?: { gtins?: string[]; productGroups?: string[] }
      pagination?: { perPage?: number; direction?: number }
    }
    const { token, filter, pagination } = body
    if (!token || !filter?.gtins?.length || !filter?.productGroups?.length) {
      return NextResponse.json(
        { error: "Требуются token, filter.gtins (массив), filter.productGroups (массив)" },
        { status: 400 }
      )
    }
    const payload = {
      filter: {
        gtins: filter.gtins,
        productGroups: filter.productGroups.map((g: string) => String(g).toLowerCase()),
      },
      pagination: {
        perPage: Math.min(Number(pagination?.perPage) || 100, 500),
        direction: Number(pagination?.direction) || 0,
      },
    }
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), TIMEOUT_MS)
    const res = await fetch(`${MARKIROVKA_BASE}/cises/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    }).finally(() => clearTimeout(id))
    const text = await res.text()
    if (!res.ok) {
      let errMsg = text || `HTTP ${res.status}`
      try {
        const parsed = JSON.parse(text) as { error_message?: string; error?: string; message?: string }
        errMsg = parsed.error_message ?? parsed.error ?? parsed.message ?? errMsg
      } catch {
        // use raw text
      }
      return NextResponse.json(
        { error: errMsg },
        { status: res.status >= 500 ? 502 : res.status }
      )
    }
    const data = text ? JSON.parse(text) : {}
    return NextResponse.json(data)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const isAbort = e instanceof Error && e.name === "AbortError"
    return NextResponse.json(
      { error: isAbort ? "Превышено время ожидания (45 сек)" : msg },
      { status: 502 }
    )
  }
}
