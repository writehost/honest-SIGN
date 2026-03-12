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
    const { apiUrl, token, identificationCode } = body as {
      apiUrl?: string
      token?: string
      identificationCode?: string
    }
    if (!apiUrl?.trim() || !identificationCode) {
      return NextResponse.json(
        { error: "Требуются apiUrl и identificationCode" },
        { status: 400 }
      )
    }
    const base = apiUrl.trim().replace(/\/$/, "")
    if (!isAllowedHost(base)) {
      return NextResponse.json(
        { error: "Разрешены только localhost и частные сети" },
        { status: 400 }
      )
    }
    const infoUrl = `${base}/api/Storage/getInfo`
    const res = await fetch(infoUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ IdentificationCode: identificationCode }),
    })
    const data = await res.json()
    if (!res.ok) {
      return NextResponse.json(
        { error: (data as { message?: string })?.message || `HTTP ${res.status}` },
        { status: res.status }
      )
    }
    return NextResponse.json(data)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
