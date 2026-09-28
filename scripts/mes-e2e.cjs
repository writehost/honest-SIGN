// Сквозные сценарии главного экрана MES в браузере.
// Запуск: npm run build && npm start (порт 3000), затем npm run test:mes:e2e
// Переменные: MES_URL (по умолчанию http://localhost:3000), OUT — куда сохранить скриншоты, PW — путь к playwright.
const { chromium } = require(process.env.PW || "playwright")
const assert = require("node:assert/strict")
const OUT = process.env.OUT || "docs/mes"
const URL = process.env.MES_URL || "http://localhost:3000"

function sscc() {
  const body = "1460712" + String(Math.floor(Math.random() * 1e10)).padStart(10, "0")
  let sum = 0
  for (let i = 0; i < body.length; i++) { const d = +body[body.length - 1 - i]; sum += i % 2 === 0 ? d * 3 : d }
  return "00" + body + ((10 - (sum % 10)) % 10)
}
const SER = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789"
const dm = (gtin) => `01${gtin}21${Array.from({ length: 13 }, () => SER[Math.floor(Math.random() * SER.length)]).join("")}93${"AbC1"}`

;(async () => {
  const b = await chromium.launch()
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } })
  const errors = []
  p.on("pageerror", (e) => errors.push(e.message))
  const counter = (label) => p.evaluate((l) => {
    const el = [...document.querySelectorAll("p")].find((x) => x.textContent.trim() === l)
    if (!el) return null
    const v = el.nextElementSibling
    return (v.firstElementChild ?? v).textContent.trim().replace(/\s/g, "")
  }, label)
  const pallet = () => p.evaluate(() => document.querySelector('[data-testid="pallet-count"]')?.textContent.replace(/\s+/g, " ").trim() ?? null)
  const text = () => p.evaluate(() => document.body.textContent)
  const sim = async (fn) => {
    await p.getByRole("button", { name: "Симуляция" }).click()
    await fn()
    await p.keyboard.press("Escape")
    await p.waitForTimeout(150)
  }
  const simBtn = (name) => p.getByRole("button", { name, exact: true }).click()
  let n = 0
  const ok = (m) => console.log(`  ✓ ${m}`, ++n && "")
  const shot = (name) => p.screenshot({ path: `${OUT}/${name}.png` })

  await p.goto(URL + "/mes"); await p.waitForTimeout(1200)
  const scroll = await p.evaluate(() => { const m = document.querySelector("main"); return { sh: m.scrollHeight, ch: m.clientHeight, doc: document.documentElement.scrollHeight } })
  assert.ok(scroll.sh <= scroll.ch + 1 && scroll.doc <= 1080, JSON.stringify(scroll)); ok(`главный экран 1920×1080 без вертикальной прокрутки (${scroll.sh}/${scroll.ch})`)
  await shot("v4-01-line")
  const t0 = await text()
  for (const banned of ["Линия работает", "Принтер", "ГИС МТ", "Ярус", "накопитель", "бут/мин", "≈", "События партии"]) assert.ok(!t0.includes(banned), `на экране не должно быть «${banned}»`)
  ok("нет декоративных статусов, ярусов, накопителя, прогнозов и ленты событий на главном экране")

  await sim(async () => { await p.getByRole("button", { name: /Поток бутылей под камерой/ }).click() })
  await p.waitForTimeout(12000)
  assert.ok(!(await text()).includes("Нет связи с камерой")); ok("12 с без считываний при живой камере — простой, предупреждения нет")

  console.log("Сценарий 1 · запуск партии, рост счётчиков")
  await p.getByRole("button", { name: "Завершить партию" }).click()
  await p.getByRole("dialog").getByRole("button", { name: /Завершить партию/ }).click()
  await p.waitForTimeout(300)
  assert.ok((await text()).includes("Партия не запущена")); ok("предыдущая партия завершена, линия без партии")
  await shot("v4-02-idle")
  await p.getByRole("button", { name: "Начать партию" }).first().click()
  await p.waitForTimeout(200)
  await shot("v4-03-launch")
  await p.getByRole("dialog").getByRole("button", { name: "Начать партию" }).click()
  await p.waitForTimeout(300)
  assert.equal(await counter("Нанесено камерой"), "0"); assert.equal(await counter("Последний код"), "—"); assert.equal(await pallet(), "0 / 48")
  ok("новая партия: зарегистрировано 0, последний код —, палета 0 / 48")
  await sim(async () => { for (let i = 0; i < 5; i++) await simBtn("+1 бутыль") })
  assert.equal(await counter("Нанесено камерой"), "5"); assert.equal(await counter("Годных в партии"), "5"); assert.equal(await pallet(), "5 / 48")
  assert.notEqual(await counter("Последний код"), "—"); ok("5 считываний камеры: зарегистрировано 5, годных 5, палета 5 / 48, время последнего кода")
  await sim(async () => { await simBtn("Повторный код"); await simBtn("NoRead") })
  assert.equal(await counter("Нанесено камерой"), "5"); assert.ok((await text()).includes("Требует проверки")); assert.ok((await text()).includes("1 из 2")); assert.ok((await text()).includes("Камера не прочитала код"))
  ok("повторный код и NoRead не увеличивают счётчики и требуют проверки бутыли")
  await sim(async () => { await simBtn("NoRead"); await simBtn("NoRead") })
  const sc = await p.evaluate(() => { const m = document.querySelector("main"); return [m.scrollHeight, m.clientHeight] })
  assert.ok(sc[0] <= sc[1] + 1, JSON.stringify(sc)); ok("4 события камеры в колонке действий — экран по-прежнему без прокрутки")
  await shot("v4-04-camera-alerts")
  while (await p.getByRole("button", { name: "Принято" }).count()) { await p.getByRole("button", { name: "Принято" }).first().click(); await p.waitForTimeout(50) }
  assert.ok(!(await text()).includes("Камера не прочитала код")); ok("оператор подтвердил события камеры")

  console.log("Сценарий 2 · палета собрана, SSCC")
  await sim(async () => { await simBtn("Добрать палету"); await simBtn("+1 бутыль"); await simBtn("+1 бутыль") })
  assert.ok((await text()).includes("Отсканируйте палетный код")); assert.ok((await text()).includes("Палета собрана")); assert.ok((await text()).includes("Палета № 1 · 48 из 48")); assert.equal(await pallet(), "48 / 48")
  assert.ok((await text()).includes("ещё 2 бут. ждут палету № 2"))
  await p.waitForTimeout(700)
  const focused = await p.evaluate(() => document.activeElement?.getAttribute("placeholder"))
  assert.match(focused ?? "", /SSCC/); ok("48 / 48: режим «Отсканируйте палетный код», поле SSCC в фокусе, 2 кода ждут следующую палету")
  await shot("v4-05-await-sscc")
  await p.keyboard.type("123456"); await p.keyboard.press("Enter"); await p.waitForTimeout(150)
  assert.ok((await text()).includes("Ошибка сканирования")); assert.equal(await counter("Палет закрыто"), "0"); ok("мусор вместо SSCC — крупно «Ошибка сканирования», палета не закрыта")
  const code = sscc()
  await p.keyboard.type(code); await p.keyboard.press("Enter"); await p.waitForTimeout(250)
  assert.equal(await counter("Палет закрыто"), "1"); assert.equal(await pallet(), "2 / 48"); assert.ok((await text()).includes("Палета № 1 агрегирована"))
  assert.equal(await counter("Годных в партии"), "50")
  ok("HID-скан SSCC + Enter: «Палета № 1 агрегирована», закрыто 1, в новой палете 2 / 48, годных 50")
  await shot("v4-06-pallet-closed")
  await p.locator("body").click({ position: { x: 5, y: 1075 } })
  await p.keyboard.type(code); await p.keyboard.press("Enter"); await p.waitForTimeout(250)
  assert.ok((await text()).includes("Повторный скан")); assert.equal(await counter("Палет закрыто"), "1"); ok("повторный скан того же SSCC вне поля ввода — «Повторный скан», повторного закрытия нет")

  console.log("Сценарий 3 · проблемная бутыль")
  await p.getByRole("button", { name: /Работа с кодами/ }).click(); await p.waitForURL("**/mes/codes"); await p.waitForTimeout(300)
  await sim(async () => { await simBtn("Код из текущей палеты") })
  assert.ok((await text()).includes("Код найден")); assert.ok(!(await text()).includes("позиция"))
  await p.getByRole("button", { name: "Подробности" }).click()
  assert.ok((await text()).includes("позиция")); ok("скан кода: крупно «Код найден», палета и позиция — в раскрываемых подробностях")
  await p.getByRole("button", { name: "Удалить код…" }).click()
  await p.getByRole("button", { name: "Бутыль снята с линии (брак)" }).click()
  await shot("v4-07-remove-reason")
  await p.getByRole("button", { name: "Удалить код…" }).click()
  await p.getByRole("dialog").getByRole("button", { name: "Удалить код", exact: true }).click(); await p.waitForTimeout(200)
  assert.ok((await text()).includes("Удалён")); ok("удаление с причиной и подтверждением — «Удалён»")
  await shot("v4-08-removed")
  await sim(async () => { await simBtn("Агрегированный код") })
  assert.ok((await text()).includes("Уже агрегирован"))
  await p.getByRole("button", { name: "Подробности" }).click()
  assert.ok((await text()).includes("SSCC палеты")); ok("агрегированный код: «Уже агрегирован», палета и SSCC в подробностях")
  await p.getByRole("button", { name: /Удалить код/ }).first().click(); await p.waitForTimeout(100)
  await sim(async () => { await simBtn("Агрегированный код") })
  assert.ok((await text()).includes("корректировку агрегации")); ok("в режиме удаления агрегированный код не удаляется — нужна корректировка агрегации")
  await p.getByRole("button", { name: /Добавить код/ }).first().click(); await p.waitForTimeout(100)
  await p.keyboard.type(dm("04607123450019")); await p.keyboard.press("Enter"); await p.waitForTimeout(250)
  assert.ok((await text()).includes("Код добавлен в партию")); ok("HID-скан в режиме «Добавить»: код прошёл 4 проверки и добавлен")
  await shot("v4-09-added")
  const focusAfter = await p.evaluate(() => document.activeElement?.tagName)
  assert.equal(focusAfter, "INPUT"); ok("после скана фокус возвращён в поле сканера")
  await p.keyboard.type(dm("04607123450118")); await p.keyboard.press("Enter"); await p.waitForTimeout(200)
  assert.ok((await text()).includes("Добавление невозможно: Код другой номенклатуры")); ok("код другой номенклатуры не добавляется")

  await p.getByRole("link", { name: "Пост маркировки" }).click(); await p.waitForURL(/\/mes$/); await p.waitForTimeout(300)
  assert.equal(await counter("Нанесено камерой"), "50"); assert.equal(await counter("Годных в партии"), "50"); assert.equal(await pallet(), "2 / 48")
  const sub = await p.evaluate(() => [...document.querySelectorAll("p")].find((x) => x.textContent.trim() === "Годных в партии").parentElement.innerText)
  assert.match(sub, /\+1 вручную · −1 удалено/); ok("после корректировок: зарегистрировано камерой 50, годных 50 = 50 + 1 − 1, палета 2 − 1 + 1 = 2 / 48")

  console.log("Отказ камеры")
  await sim(async () => { await p.getByRole("button", { name: /Связь с камерой/ }).click() })
  await p.waitForTimeout(11500)
  assert.ok((await text()).includes("Нет связи с камерой")); ok("камера не отвечает > 10 с — красное предупреждение с причиной")
  await shot("v4-10-camera-offline")
  await sim(async () => { await p.getByRole("button", { name: /Связь с камерой/ }).click() })
  await p.waitForTimeout(500)
  assert.ok(!(await text()).includes("Нет связи с камерой")); ok("связь восстановлена — предупреждение исчезло")
  await p.goto(URL + "/mes/batches"); await p.waitForTimeout(800); await shot("v4-11-batches")
  const m = await b.newPage({ viewport: { width: 1080, height: 1350 } })
  await m.goto(URL + "/mes"); await m.waitForTimeout(1000); await m.screenshot({ path: `${OUT}/v4-12-narrow.png` })
  assert.deepEqual(errors, []); ok("ошибок JavaScript нет")
  console.log(`\nE2E: пройдено ${n}`)
  await b.close()
})().catch((e) => { console.error("FAIL:", e.message); process.exit(1) })
