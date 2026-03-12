import { NextRequest, NextResponse } from "next/server"

function isAllowedHost(url: string): boolean {
  try {
    const u = new URL(url)
    const host = u.hostname
    return (
      host === "localhost" ||
      /^192\.168\.\d+\.\d+$/.test(host) ||
      /^10\.\d+\.\d+\.\d+$/.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(host)
    )
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { url, username, password } = body as { url?: string; username?: string; password?: string }
    if (!url?.trim()) {
      return NextResponse.json({ error: "Требуется url Векас" }, { status: 400 })
    }
    const base = url.trim().replace(/\/$/, "")
    if (!isAllowedHost(base)) {
      return NextResponse.json(
        { error: "Разрешены только localhost и частные сети (192.168.x.x, 10.x.x.x)" },
        { status: 400 }
      )
    }
    const loginUrl = `${base}/api/login`
    const res = await fetch(loginUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: username?.trim() || "admin",
        password: password ?? "vekas",
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      return NextResponse.json(
        { error: (data as { message?: string })?.message || await res.text() || `HTTP ${res.status}` },
        { status: res.status }
      )
    }
    const token = (data as { Value?: { Token?: string }; IsSuccess?: boolean })?.Value?.Token
    if (!(data as { IsSuccess?: boolean }).IsSuccess || !token) {
      return NextResponse.json(
        { error: "Не удалось войти в Векас. Проверьте логин и пароль." },
        { status: 401 }
      )
    }
    return NextResponse.json({ token, IsSuccess: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
