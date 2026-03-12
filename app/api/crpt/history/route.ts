import { NextRequest, NextResponse } from "next/server"

const MARKIROVKA_BASE = "https://markirovka.crpt.ru/api/v3/true-api"
const TIMEOUT_MS = 45000

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
    const text = await res.text()
    if (!res.ok) {
      return NextResponse.json(
        { error: text || `HTTP ${res.status}` },
        { status: res.status }
      )
    }
    const data = JSON.parse(text)
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
