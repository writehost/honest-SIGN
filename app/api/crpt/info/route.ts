import { NextRequest, NextResponse } from "next/server"

const MARKIROVKA_BASE = "https://markirovka.crpt.ru/api/v3/true-api"
const TIMEOUT_MS = 45000

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { codes, token } = body as { codes?: string[]; token?: string }
    if (!Array.isArray(codes) || !codes.length || !token) {
      return NextResponse.json(
        { error: "Требуются codes (массив) и token" },
        { status: 400 }
      )
    }
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), TIMEOUT_MS)
    const res = await fetch(`${MARKIROVKA_BASE}/cises/info`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(codes),
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
        { error: errMsg, statusCode: res.status },
        { status: res.status >= 500 ? 502 : res.status }
      )
    }
    const data = text ? JSON.parse(text) : []
    return NextResponse.json(data)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const isAbort = e instanceof Error && e.name === "AbortError"
    const hint =
      msg === "fetch failed"
        ? " Сервер не смог связаться с Честным ЗНАКом (сеть/SSL). Запустите с NODE_TLS_REJECT_UNAUTHORIZED=0 или используйте основное приложение: npm run dev (порт 5173)."
        : ""
    return NextResponse.json(
      { error: (isAbort ? "Превышено время ожидания (45 сек)" : msg) + hint },
      { status: 502 }
    )
  }
}
