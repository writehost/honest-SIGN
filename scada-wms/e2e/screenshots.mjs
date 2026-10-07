// Screenshots of every main screen on the demo tenant at real sizes:
// phones 390×844 and 430×932, desktop 1920×1080. Also fails on horizontal overflow.
//   npm run build && npx vite preview --port 4173 &  then  npm run shots

import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE_URL ?? 'http://localhost:4173'
const OUT = new URL('./out/screens/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const problems = []

async function hid(page, code) {
  await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur())
  await page.keyboard.type(code, { delay: 4 })
  await page.keyboard.press('Enter')
  await page.waitForTimeout(500)
}

async function shot(page, tag, name) {
  await page.waitForTimeout(520) // let the scan flash fade
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  if (overflow > 1) problems.push(`${tag}/${name}: horizontal overflow ${overflow}px`)
  await page.screenshot({ path: `${OUT}${tag}-${name}.png` })
}

async function login(page, testId) {
  await page.goto(`${BASE}/login`)
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('scada-wms/camera', '0') })
  await page.reload()
  await page.getByTestId(testId).click()
  await page.waitForURL(/\/(m|app|setup)$/)
}

// ─── phones ───
for (const [w, h] of [[390, 844], [430, 932]]) {
  const tag = `m${w}`
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ru-RU' })
  const p = await ctx.newPage()
  await login(p, 'login-storekeeper')
  await shot(p, tag, '01-home')

  await p.goto(`${BASE}/m/receive`)
  await shot(p, tag, '02-receive-start')
  await p.getByTestId('quick-receive').click()
  await shot(p, tag, '03-receive-scan')
  await hid(p, 'SKU-10023')
  await p.getByRole('button', { name: '1', exact: true }).click()
  await p.getByRole('button', { name: '2', exact: true }).click()
  await shot(p, tag, '04-receive-qty')
  await p.getByTestId('qty-next').click()
  await shot(p, tag, '05-receive-cell')
  await hid(p, 'A-01-06')
  await shot(p, tag, '06-receive-wrong-cell-warning')
  await p.getByRole('button', { name: /Положу в/ }).click()
  await hid(p, 'A-01-03')
  await shot(p, tag, '07-receive-confirm')
  await p.getByTestId('confirm-receive').click()

  await p.goto(`${BASE}/m/pick`)
  await shot(p, tag, '08-pick-queue')
  await p.getByTestId('start-next').click()
  await shot(p, tag, '09-pick-box')
  await hid(p, 'BOX-0001')
  await shot(p, tag, '10-pick-go-to-cell')
  const cell = (await p.locator('[data-cell]').first().innerText()).trim()
  await hid(p, cell)
  await shot(p, tag, '11-pick-at-cell')
  await hid(p, 'SKU-50233')
  await shot(p, tag, '12-pick-wrong-product')
  await p.getByRole('button', { name: /Понятно/ }).click()
  const right = await p.getByTestId('expected-barcode').innerText()
  await hid(p, right)
  await shot(p, tag, '13-pick-progress')

  await p.goto(`${BASE}/m/pack`)
  await shot(p, tag, '14-pack-queue')
  await hid(p, 'BOX-0003')
  await shot(p, tag, '15-pack-check')

  await p.goto(`${BASE}/m/move`)
  await hid(p, 'A-02-02')
  await shot(p, tag, '16-move-cell-content')

  await p.goto(`${BASE}/m/inventory`)
  await shot(p, tag, '17-inventory-scan-cell')
  await hid(p, 'A-01-04')
  await hid(p, 'SKU-10025')
  await hid(p, 'SKU-10023')
  await shot(p, tag, '18-inventory-foreign-alert')
  await p.getByRole('button', { name: /учитываю/ }).click()
  await shot(p, tag, '19-inventory-count')
  await p.getByTestId('inv-review').click()
  await shot(p, tag, '20-inventory-review')

  await p.goto(`${BASE}/m/search?q=SKU-10023`)
  await shot(p, tag, '21-search-product')
  await p.goto(`${BASE}/m/journal`)
  await shot(p, tag, '22-journal')
  await p.goto(`${BASE}/m/more`)
  await p.getByRole('switch', { name: /Имитировать/ }).click()
  await p.goto(`${BASE}/m`)
  await shot(p, tag, '23-offline-home')
  await p.evaluate(() => localStorage.setItem('scada-wms/simulate-offline', 'false'))
  await ctx.close()
}

// ─── desktop ───
{
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: 'ru-RU' })
  const p = await ctx.newPage()
  await p.goto(`${BASE}/`)
  await shot(p, 'd1920', '00-landing')
  await login(p, 'login-owner')
  await shot(p, 'd1920', '01-overview')
  for (const [path, name] of [['products', '02-products'], ['stock', '04-stock'], ['orders', '05-orders'], ['warehouse', '07-warehouse'], ['receipts', '09-receipts'], ['journal', '10-journal'], ['import', '11-import'], ['users', '12-users'], ['settings', '13-settings']]) {
    await p.goto(`${BASE}/app/${path}`)
    await p.waitForTimeout(150)
    await shot(p, 'd1920', name)
  }
  await p.goto(`${BASE}/app/products`)
  await p.locator('table.wms-ag-grid tbody tr').first().click()
  await shot(p, 'd1920', '03-product-drawer')
  await p.goto(`${BASE}/app/orders?status=to_pick`)
  await p.locator('table.wms-ag-grid tbody tr').first().click()
  await shot(p, 'd1920', '06-order-drawer')
  await p.goto(`${BASE}/app/warehouse`)
  await p.getByTestId('cells-new').click()
  await shot(p, 'd1920', '08-cell-range')
  await p.keyboard.press('Escape')
  await p.getByTestId('global-search').click()
  await p.keyboard.type('4607001230')
  await shot(p, 'd1920', '14-global-search')
  await ctx.close()
}

await browser.close()
if (problems.length) { console.error(problems.join('\n')); process.exit(1) }
console.log('Screenshots:', OUT)
