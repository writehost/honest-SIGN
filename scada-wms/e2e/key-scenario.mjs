// End-to-end check of the key scenario (section 28 of the brief) in real Chromium.
//   npm run build && npx vite preview --port 4173 &  then  npm run e2e
// The owner works in a 1920×1080 tab, the storekeeper in a 390×844 phone tab
// of the same browser; both see one store (as they would see one server).

import { chromium, devices } from 'playwright-core'
import { mkdirSync, statSync } from 'node:fs'
import assert from 'node:assert/strict'

const BASE = process.env.BASE_URL ?? 'http://localhost:4173'
const OUT = new URL('./out/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const ctx = await browser.newContext({ acceptDownloads: true, locale: 'ru-RU' })
await ctx.addInitScript(() => { try { localStorage.setItem('scada-wms/camera', '0') } catch {} })

const step = (n, t) => console.log(`✓ ${String(n).padStart(2)}. ${t}`)
const shot = (page, name) => page.screenshot({ path: `${OUT}${name}.png` })

/** A Bluetooth/USB scanner in HID mode: fast keystrokes + Enter, nothing focused. */
async function hidScan(page, code) {
  await page.evaluate(() => (document.activeElement instanceof HTMLElement) && document.activeElement.blur())
  await page.keyboard.type(code, { delay: 4 })
  await page.keyboard.press('Enter')
}

// ── owner, desktop ───────────────────────────────────────────────────────────
const owner = await ctx.newPage()
await owner.setViewportSize({ width: 1920, height: 1080 })
await owner.goto(`${BASE}/signup`)
await owner.fill('input[name=org]', 'ИП Смирнов')
await owner.fill('input[name=name]', 'Алексей Смирнов')
await owner.fill('input[name=email]', 'alex@smirnov.shop')
await owner.fill('input[name=password]', 'secret123')
await owner.getByRole('button', { name: /Продолжить/ }).click()
await owner.waitForURL('**/setup')
await owner.getByTestId('wh-save').click()

// 1. product (+ a look-alike to scan by mistake)
for (const [name, sku, bc] of [['Футболка Nike чёрная XL', 'SKU-10023', '4607001230011'], ['Футболка Nike чёрная L', 'SKU-10025', '4607001230028']]) {
  await owner.getByTestId('p-name').fill(name)
  await owner.getByTestId('p-sku').fill(sku)
  await owner.getByTestId('p-barcode').fill(bc)
  await owner.getByTestId('p-add').click()
}
await owner.getByText('4607001230028').waitFor()
step(1, 'Владелец создал товар')
await owner.getByTestId('products-next').click()

// 2. cells A-01-01, A-01-02 + PDF with QR
await owner.getByTestId('range-to').fill('2')
await owner.getByText('2 ячеек').waitFor()
await owner.getByTestId('range-create').click()
await owner.getByTestId('cells-next').click()
await owner.getByText('A-01-02').first().waitFor()
await shot(owner, '01-desktop-onboarding-labels')
const [dl] = await Promise.all([owner.waitForEvent('download'), owner.getByTestId('download-pdf').click()])
const pdf = `${OUT}labels.pdf`
await dl.saveAs(pdf)
assert.ok(statSync(pdf).size > 2000, 'PDF with QR labels is generated')
step(2, `Созданы A-01-01, A-01-02, скачан PDF (${dl.suggestedFilename()}, ${statSync(pdf).size} байт)`)
await owner.getByTestId('labels-next').click()
await owner.getByRole('button', { name: 'Открыть кабинет' }).click()
await owner.waitForURL('**/app')

// storekeeper account
await owner.goto(`${BASE}/app/users`)
await owner.getByRole('button', { name: /Сотрудник/ }).click()
await owner.locator('label:has-text("Имя") input').fill('Иван Петров')
await owner.locator('label:has-text("E-mail или телефон") input').fill('ivan@smirnov.shop')
await owner.getByRole('button', { name: 'Пригласить' }).click()

// ── storekeeper, phone ───────────────────────────────────────────────────────
const phone = await ctx.newPage()
await phone.setViewportSize({ width: 390, height: 844 })
await phone.goto(`${BASE}/login`)
await phone.fill('input[type=email]', 'ivan@smirnov.shop')
await phone.getByRole('button', { name: 'Войти', exact: true }).click()
await phone.waitForURL('**/m')
await shot(phone, '02-phone-home-empty')
step(3, 'Кладовщик открыл телефон')

// 4–5. receive 20 into A-01-01
await phone.getByRole('link', { name: /Приёмка/ }).click()
await phone.getByTestId('quick-receive').click()
await phone.getByRole('button', { name: /Ввести код/ }).click()
await phone.getByTestId('manual-input').fill('4607001230011')
await phone.getByRole('button', { name: 'Готово' }).click()
await phone.getByText('Укажите количество').waitFor()
await phone.getByRole('button', { name: '2', exact: true }).click()
await phone.getByRole('button', { name: '0', exact: true }).click()
assert.equal((await phone.getByTestId('qty').innerText()).replace(/\D/g, ''), '20')
await phone.getByTestId('qty-next').click()
await phone.getByText('Рекомендуем').waitFor()
await shot(phone, '03-phone-receive-cell')
await hidScan(phone, 'A-01-01')
await phone.getByTestId('confirm-receive').click()
await phone.getByText('Размещено: 20 шт. в A-01-01').waitFor()
step(4, 'Принято 20 шт. (ручной ввод штрихкода + numpad)')
step(5, 'Отсканирована A-01-01 (эмуляция Bluetooth HID-сканера)')

// 6. stock A-01-01 = 20
await phone.goto(`${BASE}/m/search?q=4607001230011`)
const card = phone.getByTestId('product-card')
await card.waitFor()
const cardText = await card.innerText()
assert.match(cardText, /A-01-01\s*20/)
await shot(phone, '04-phone-stock')
step(6, 'Остаток: A-01-01 = 20')

// 7. owner creates an order for 2
await owner.goto(`${BASE}/app/orders`)
await owner.getByTestId('order-new').click()
await owner.getByTestId('oi-product-0').selectOption({ label: 'Футболка Nike чёрная XL · SKU-10023' })
await owner.getByTestId('oi-qty-0').fill('2')
await owner.getByTestId('order-save').click()
await owner.getByText('Заказ создан и передан в сборку').waitFor()
const orderNo = (await owner.locator('table.wms-ag-grid tbody tr td:nth-child(2)').first().innerText()).trim()
await shot(owner, '05-desktop-orders')
step(7, `Создан заказ №${orderNo} на 2 шт., зарезервирован`)

// 8–9. picking
await phone.goto(`${BASE}/m`)
await phone.getByText('1 заказ к сборке').waitFor()
await phone.getByRole('link', { name: /Сборка/ }).click()
await phone.getByTestId('start-next').click()
await phone.getByTestId('no-box').click()
await phone.getByText('Идите').waitFor()
assert.match(await phone.locator('main, body').innerText(), /A-01-01/)
assert.equal((await phone.getByTestId('take-qty').innerText()).replace(/\D/g, ''), '2')
await shot(phone, '06-phone-pick-go')
step(8, 'Сотрудник нажал «Сборка»')
step(9, 'Приложение: A-01-01, возьмите 2')

await hidScan(phone, 'A-01-02')
await phone.getByText('Это не ячейка A-01-01').waitFor()
await shot(phone, '07-phone-pick-wrong-cell')
await phone.getByRole('button', { name: /Понятно/ }).click()
await hidScan(phone, 'A-01-01')
await phone.getByText('На месте').waitFor()

// 10. wrong product — blocked, no override
await hidScan(phone, '4607001230028')
const err = phone.getByRole('alertdialog')
await err.waitFor()
const errText = await err.innerText()
assert.match(errText, /НЕВЕРНЫЙ ТОВАР/i)
assert.match(errText, /SKU-10023/)
assert.match(errText, /SKU-10025/)
assert.equal(await err.getByRole('button').count(), 1, 'only "scan again" — no "add anyway"')
await shot(phone, '08-phone-pick-wrong-product')
await err.getByRole('button').click()
assert.equal((await phone.getByTestId('take-qty').innerText()).replace(/\D/g, ''), '2', 'nothing was taken')
step(10, 'Неверный товар: красный экран, продолжить нельзя, взято 0')

// 11. right product ×2
await hidScan(phone, '4607001230011')
await phone.getByText('Взято 1 из 2').waitFor()
await shot(phone, '09-phone-pick-one')
await hidScan(phone, '4607001230011')
await phone.getByText(`Заказ №${orderNo} собран`).waitFor()
await shot(phone, '10-phone-picked')
step(11, 'Правильный товар отсканирован 2 раза — заказ собран')

// 12. packing — second barrier
await phone.goto(`${BASE}/m/pack`)
await hidScan(phone, `ORD-${orderNo}`)
await phone.getByText('Ожидается в заказе').waitFor()
await hidScan(phone, '4607001230011')
await hidScan(phone, '4607001230028')
await phone.getByRole('alertdialog').waitFor()
await phone.getByRole('button', { name: /Понятно/ }).click()
await phone.getByText('Не из этого заказа').waitFor()
assert.ok(await phone.getByTestId('complete-pack').isDisabled(), 'cannot finish with a missing unit and a foreign item')
await shot(phone, '11-phone-pack-blocked')
await phone.getByTestId('remove-extra').click()
assert.ok(await phone.getByTestId('complete-pack').isDisabled(), 'still one unit missing')
await hidScan(phone, '4607001230011')
await phone.waitForFunction(() => !document.querySelector('[data-testid=complete-pack]')?.hasAttribute('disabled'))
await shot(phone, '12-phone-pack-ready')
await phone.getByTestId('complete-pack').click()
await phone.getByText(`Заказ №${orderNo} упакован`).waitFor()
step(12, 'Упаковщик повторно проверил: лишний товар и недостача блокировали завершение')

// 13. status «Упакован» in the cabinet + journal
await owner.goto(`${BASE}/app/orders`)
const row = owner.locator('table.wms-ag-grid tbody tr', { hasText: orderNo })
assert.match(await row.innerText(), /Упакован/)
await owner.goto(`${BASE}/app/journal`)
const journal = await owner.locator('table.wms-ag-grid').innerText()
for (const t of ['Приёмка', 'Сборка', 'Упаковка', 'Иван Петров']) assert.ok(journal.includes(t), `journal has ${t}`)
await shot(owner, '13-desktop-journal')
step(13, `Заказ №${orderNo} — «Упакован»; журнал: кто/что/откуда/куда`)

await browser.close()
console.log('\nKey scenario passed. Screenshots:', OUT)
