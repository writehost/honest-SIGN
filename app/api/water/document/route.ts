import { NextRequest, NextResponse } from "next/server"

const WATER_BASE = "https://water.crpt.ru/bff-elk/v1"
const TIMEOUT_MS = 45000
const PRODUCT_GROUP_MAP: Record<string, number> = { water: 13, softdrinks: 12 }

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const docId = searchParams.get("docId")
    const productGroup = searchParams.get("productGroup") || "13"
    const auth = request.headers.get("authorization")
    if (!docId || !auth) {
      return NextResponse.json(
        { error: "Требуются query docId и заголовок Authorization" },
        { status: 400 }
      )
    }
    const pg =
      PRODUCT_GROUP_MAP[productGroup] != null
        ? PRODUCT_GROUP_MAP[productGroup]
        : (Number(productGroup) || 13)
    const url = `${WATER_BASE}/documents/${encodeURIComponent(docId)}?productGroup=${pg}`
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), TIMEOUT_MS)
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: auth },
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
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
