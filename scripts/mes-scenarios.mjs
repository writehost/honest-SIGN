// Сценарные проверки доменной модели MES (FIFO, счётчики, SSCC, корректировки).
// Запуск: node --experimental-strip-types scripts/mes-scenarios.mjs
import assert from "node:assert/strict"
import * as D from "../components/mes/domain.ts"

let t = Date.parse("2026-09-28T08:00:00Z")
const tick = (ms = 1000) => (t += ms)
let s = D.emptyState(t)
const act = (a) => {
  s = D.reducer(s, { at: tick(), ...a })
  const errs = D.checkInvariants(s)
  assert.deepEqual(errs, [], `инвариант нарушен после ${a.type}: ${errs.join("; ")}`)
}
const b = () => D.getActive(s)
const pv = () => D.palletView(s)
const total = () => D.batchTotal(b())
const read = (n = 1) => { for (let i = 0; i < n; i++) act({ type: "CAMERA_READ", raw: D.makeDataMatrix(b().gtin) }) }
let passed = 0
const step = (name, fn) => { fn(); passed++; console.log("  ✓", name) }

console.log("Сценарий 1 · запуск партии и регистрация кодов камерой")
step("запуск партии 19 л, палета 48", () => {
  act({ type: "START_BATCH", nomenclatureId: "n1", palletSize: 48, number: "2809-100" })
  assert.equal(b().palletSize, 48); assert.equal(pv().inPallet, 0); assert.equal(pv().no, 1)
})
step("5 считываний → нанесено 5, всего 5, в палете 5/48, последнее нанесение обновлено", () => {
  read(5)
  assert.equal(b().applied, 5); assert.equal(total(), 5); assert.equal(pv().inPallet, 5); assert.equal(b().lastCameraAt, t)
})
step("NoRead: счётчики не меняются, событие требует действия оператора", () => {
  act({ type: "CAMERA_NOREAD" })
  assert.equal(b().applied, 5); assert.equal(b().noReads, 1); assert.equal(s.alerts[0].kind, "noread")
})
step("повторное считывание того же кода не учитывается", () => {
  act({ type: "CAMERA_READ", raw: s.fifo[0] })
  assert.equal(b().applied, 5); assert.equal(b().duplicates, 1); assert.equal(s.fifo.length, 5)
})
step("код другой номенклатуры не попадает в FIFO", () => {
  act({ type: "CAMERA_READ", raw: D.makeDataMatrix("04607123450118") })
  assert.equal(s.fifo.length, 5); assert.equal(b().foreign, 1)
})
step("связь с камерой: простой без считываний ≠ обрыв; нет heartbeat дольше таймаута = обрыв", () => {
  act({ type: "CAMERA_HEARTBEAT" })
  const hb = t
  assert.equal(D.isCameraOnline(s, hb + 60_000), false)
  for (let i = 0; i < 30; i++) act({ type: "CAMERA_HEARTBEAT" }) // 30 с без бутылей, камера отвечает
  assert.equal(D.isCameraOnline(s, t + 1000), true)
  assert.equal(D.isCameraOnline(s, t + 9_000), true)
  assert.equal(D.isCameraOnline(s, t + 10_500), false)
})

console.log("Сценарий 2 · набор палеты и подтверждение SSCC")
step("SSCC до набора палеты отклоняется без изменений", () => {
  act({ type: "SCAN_SSCC", raw: D.makeSscc() })
  assert.equal(b().pallets, 0); assert.equal(s.ssccFeedback.title, "Палета ещё не собрана")
})
step("48-й код → ожидание SSCC; ещё 3 кода остаются в FIFO за группой", () => {
  read(43)
  assert.equal(pv().inPallet, 48); assert.equal(pv().awaiting, true)
  read(3)
  assert.equal(pv().inPallet, 48); assert.equal(pv().queuedNext, 3); assert.equal(total(), 51)
})
step("мусор, неверная контрольная цифра и DataMatrix вместо SSCC отклоняются", () => {
  const bad = D.makeSscc(); const badCheck = bad.slice(0, -1) + ((+bad.slice(-1) + 1) % 10)
  for (const raw of ["123456", badCheck, s.fifo[0]]) {
    act({ type: "SCAN_SSCC", raw })
    assert.equal(b().pallets, 0); assert.equal(s.fifo.length, 51)
  }
  assert.equal(b().ssccErrors, 3)
})
let sscc1
step("корректный SSCC закрывает палету № 1: 48 кодов связаны, в FIFO остаётся 3, палета № 2", () => {
  sscc1 = D.makeSscc()
  const group = s.fifo.slice(0, 48)
  act({ type: "SCAN_SSCC", raw: sscc1 })
  assert.equal(b().pallets, 1); assert.equal(s.fifo.length, 3); assert.equal(pv().no, 2); assert.equal(pv().inPallet, 3)
  assert.ok(group.every((c) => s.codes[c].status === "aggregated" && s.codes[c].palletCode === sscc1 && s.codes[c].palletNo === 1))
  assert.equal(s.pallets[sscc1].count, 48); assert.equal(total(), 51)
})
step("повторный скан того же SSCC — «Повторный скан», палета не закрывается второй раз", () => {
  const errs = b().ssccErrors
  act({ type: "SCAN_SSCC", raw: sscc1 })
  assert.equal(b().pallets, 1); assert.equal(s.ssccFeedback.title, "Повторный скан"); assert.equal(b().ssccErrors, errs)
})
step("SSCC старой палеты на новой полной палете — «уже использован»", () => {
  read(45)
  act({ type: "SCAN_SSCC", raw: D.makeSscc() }) // палета № 2 закрыта
  read(48)
  act({ type: "SCAN_SSCC", raw: sscc1 })
  assert.equal(s.ssccFeedback.title, "Палетный код уже использован"); assert.equal(b().pallets, 2); assert.equal(pv().awaiting, true)
})

console.log("Сценарий 3 · проблемная бутыль: проверка и корректировка ручным сканером")
let target
step("проверка кода в FIFO: НАНЕСЁН, палета № 3, позиция", () => {
  target = s.fifo[10]
  const v = D.evaluateCode(s, target)
  assert.equal(v.verdict, "Код найден"); assert.equal(v.queue.palletNo, 3); assert.equal(v.queue.position, 11); assert.equal(v.canRemove, true)
})
step("удаление с причиной: всего −1, FIFO −1, нанесено без изменений, ожидание SSCC снято", () => {
  const applied = b().applied, tot = total()
  act({ type: "MANUAL_REMOVE", raw: target, reason: "Бутыль снята с линии (брак)" })
  assert.equal(b().applied, applied); assert.equal(total(), tot - 1); assert.equal(b().removed, 1)
  assert.equal(pv().inPallet, 47); assert.equal(pv().awaiting, false)
  assert.equal(D.evaluateCode(s, target).verdict, "Удалён")
})
step("повторное удаление того же кода — отказ, счётчики не меняются", () => {
  const tot = total()
  assert.equal(D.evaluateCode(s, target).canRemove, false)
  act({ type: "MANUAL_REMOVE", raw: target, reason: "Другое" })
  assert.equal(total(), tot); assert.equal(b().removed, 1)
})
step("код в закрытой палете: АГРЕГИРОВАН + SSCC, удаление запрещено", () => {
  const agg = Object.values(s.codes).find((c) => c.palletCode === sscc1).code
  const v = D.evaluateCode(s, agg)
  assert.equal(v.verdict, "Уже агрегирован"); assert.equal(v.canRemove, false); assert.match(v.removeBlockedReason, /корректировку агрегации/)
  const tot = total()
  act({ type: "MANUAL_REMOVE", raw: agg, reason: "Другое" })
  assert.equal(total(), tot); assert.equal(s.codes[agg].status, "aggregated")
})
step("добавление: неизвестный код своей номенклатуры → в конец FIFO, всего +1, палета снова собрана", () => {
  const code = D.makeDataMatrix(b().gtin)
  const v = D.evaluateCode(s, code)
  assert.equal(v.verdict, "Не зарегистрирован"); assert.equal(v.canAdd, true); assert.ok(v.checks.every((c) => c.ok))
  const applied = b().applied, tot = total()
  act({ type: "MANUAL_ADD", raw: code })
  assert.equal(b().applied, applied); assert.equal(b().manualAdded, 1); assert.equal(total(), tot + 1); assert.equal(s.fifo.at(-1), D.parseDataMatrix(code).key)
  assert.equal(pv().awaiting, true)
})
step("добавление дубликата, чужого GTIN, кода другой партии и мусора запрещено", () => {
  assert.equal(D.evaluateCode(s, s.fifo[0]).canAdd, false)
  assert.equal(D.evaluateCode(s, D.makeDataMatrix("04607123450118")).addBlockedReason, "Код другой номенклатуры")
  assert.equal(D.evaluateCode(s, D.makeDataMatrix("04607123450118")).verdict, "Чужая номенклатура")
  assert.equal(D.evaluateCode(s, "4607123450019").verdict, "Неверный код")
  const tot = total()
  act({ type: "MANUAL_ADD", raw: s.fifo[0] })
  assert.equal(total(), tot)
})
step("возврат удалённого кода: всего +1, код снова в FIFO", () => {
  const tot = total()
  act({ type: "MANUAL_ADD", raw: target })
  assert.equal(total(), tot + 1); assert.equal(s.codes[target].status, "queued"); assert.equal(b().manualAdded, 2)
})
step("код с криптохвостом и GS от сканера распознаётся как тот же код", () => {
  const raw = D.makeDataMatrix(b().gtin)
  act({ type: "CAMERA_READ", raw })
  const key = D.parseDataMatrix(raw).key
  assert.equal(D.evaluateCode(s, raw.replace("\u001d", "")).record.code, key)
})

console.log("Завершение")
step("неполная палета: запрос → SSCC → палета с фактическим числом бутылей", () => {
  // закрываем полную палету № 3
  act({ type: "SCAN_SSCC", raw: D.makeSscc() })
  const n = s.fifo.length
  assert.ok(n > 0 && n < 48)
  act({ type: "REQUEST_PARTIAL", on: true })
  assert.equal(pv().awaiting, true)
  const code = D.makeSscc()
  act({ type: "SCAN_SSCC", raw: code })
  assert.equal(s.pallets[code].count, n); assert.equal(s.pallets[code].partial, true); assert.equal(s.fifo.length, 0)
})
step("завершение партии с остатком в FIFO: остаток фиксируется в отчёте", () => {
  read(4)
  const tot = total(), id = b().id
  act({ type: "FINISH_BATCH" })
  const done = s.batches.find((x) => x.id === id)
  assert.equal(done.unaggregated, 4); assert.equal(done.status, "completed_warn"); assert.equal(D.batchTotal(done), tot); assert.equal(s.activeBatchId, null)
})
step("демо-данные прототипа согласованы", () => {
  const seeded = D.seed()
  assert.deepEqual(D.checkInvariants(seeded), [])
  const pv2 = D.palletView(seeded)
  assert.equal(pv2.no, 8); assert.equal(pv2.inPallet, 44)
})
console.log(`\nВсе проверки пройдены: ${passed}`)
