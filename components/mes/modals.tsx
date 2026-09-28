"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  AlertOctagon,
  CheckCircle2,
  Flag,
  PackageCheck,
  PackageOpen,
  Play,
  ScanBarcode,
  Search,
  XCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  PALLET_LABEL,
  SSCC_RE,
  fmtDate,
  fmtDuration,
  fmtNum,
  formatSscc,
  makeSscc,
  useMes,
  type PalletSize,
  type Volume,
} from "./store"
import { Btn, Chip, ConfirmDialog, Modal, Segmented, StatusPill, TONE, TextInput, VolumeBadge } from "./ui"
import { useMesUi } from "./ui-context"

/* ════════════════════════════════════════════════════════════════════════════
 * Запуск партии: одна модалка, 3 касания — номенклатура → палета → «Запустить»
 * ════════════════════════════════════════════════════════════════════════════ */

export function LaunchBatchModal({ open, onClose, preselect }: { open: boolean; onClose: () => void; preselect?: string }) {
  const { state, startBatch } = useMes()
  const { toast } = useMesUi()
  const [query, setQuery] = useState("")
  const [volume, setVolume] = useState<Volume | "all">("all")
  const [selectedId, setSelectedId] = useState<string | undefined>(preselect)
  const [palletSize, setPalletSize] = useState<PalletSize>(state.settings.defaultPalletSize)

  useEffect(() => {
    if (!open) return
    setQuery("")
    setVolume("all")
    setSelectedId(preselect)
    const n = state.nomenclature.find((x) => x.id === preselect)
    setPalletSize(n?.defaultPalletSize ?? state.settings.defaultPalletSize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preselect])

  // Последние использованные позиции — сверху: оператор чаще всего запускает то же, что вчера
  const lastUsed = useMemo(() => {
    const order: string[] = []
    for (const b of state.batches) if (!order.includes(b.nomenclatureId)) order.push(b.nomenclatureId)
    return order
  }, [state.batches])

  const list = state.nomenclature
    .filter((n) => n.active)
    .filter((n) => volume === "all" || n.volume === volume)
    .filter((n) => {
      const q = query.trim().toLowerCase()
      return !q || n.name.toLowerCase().includes(q) || n.sku.toLowerCase().includes(q) || n.gtin.includes(q)
    })
    .sort((a, b) => (lastUsed.indexOf(a.id) + 1 || 99) - (lastUsed.indexOf(b.id) + 1 || 99))

  const selected = state.nomenclature.find((n) => n.id === selectedId)

  const start = () => {
    if (!selected) return
    const number = startBatch(selected.id, palletSize)
    toast({ tone: "success", title: `Партия № ${number} запущена`, text: `${selected.name} · ${selected.volume} л · палета ${palletSize} шт.` })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={Play}
      title="Запуск партии"
      subtitle="Выберите номенклатуру и размер палеты. Остальные параметры заполнятся автоматически."
      width="max-w-[1180px]"
      footer={
        <>
          <Btn size="lg" onClick={onClose} className="min-w-44">
            Отмена
          </Btn>
          <Btn size="lg" variant="primary" icon={Play} onClick={start} disabled={!selected} className="min-w-72">
            Запустить партию
          </Btn>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative min-w-64 flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-6 -translate-y-1/2 text-mes-ink-3" />
              <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск: название, артикул, GTIN" className="pl-13" />
            </div>
            <Chip on={volume === "all"} onClick={() => setVolume("all")}>Все</Chip>
            <Chip on={volume === 19} onClick={() => setVolume(19)}>19 л</Chip>
            <Chip on={volume === 11} onClick={() => setVolume(11)}>11 л</Chip>
          </div>
          <div className="grid max-h-[46vh] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
            {list.map((n) => {
              const on = n.id === selectedId
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(n.id)
                    setPalletSize(n.defaultPalletSize)
                  }}
                  className={cn(
                    "flex min-h-28 items-start gap-4 rounded-2xl border-2 p-4 text-left transition-colors",
                    on ? "border-mes-olive bg-mes-olive-tint ring-4 ring-mes-olive/15" : "border-mes-line bg-mes-card hover:border-mes-line-strong hover:bg-mes-panel",
                  )}
                >
                  <VolumeBadge volume={n.volume} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[18px] font-semibold leading-snug text-mes-ink">{n.name}</span>
                    <span className="mt-1 block text-[14px] text-mes-ink-3">
                      {n.sku} · GTIN {n.gtin}
                    </span>
                    <span className="mt-2 inline-block rounded-lg bg-mes-panel px-2 py-0.5 text-[13px] font-medium text-mes-ink-2 ring-1 ring-mes-line">Палета по умолчанию: {n.defaultPalletSize}</span>
                  </span>
                  <span className={cn("mt-1 flex size-8 shrink-0 items-center justify-center rounded-full border-2", on ? "border-mes-olive-strong bg-mes-olive-strong" : "border-mes-line-strong")}>
                    {on && <CheckCircle2 className="size-6 text-white" />}
                  </span>
                </button>
              )
            })}
            {list.length === 0 && <p className="col-span-full py-10 text-center text-[17px] text-mes-ink-3">Ничего не найдено. Проверьте фильтр объёма или добавьте номенклатуру.</p>}
          </div>
        </div>

        <aside className="flex flex-col gap-5 rounded-2xl bg-mes-panel p-5 ring-1 ring-mes-line">
          <div>
            <p className="text-[14px] font-semibold uppercase tracking-[0.05em] text-mes-ink-2">Номенклатура</p>
            <p className={cn("mt-2 text-[20px] font-semibold leading-snug", selected ? "text-mes-ink" : "text-mes-ink-3")}>{selected ? selected.name : "Не выбрана"}</p>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-[14px] font-semibold uppercase tracking-[0.05em] text-mes-ink-2">Тип продукции</p>
            {selected ? <VolumeBadge volume={selected.volume} size="lg" /> : <span className="text-[20px] text-mes-ink-3">—</span>}
          </div>
          <div>
            <p className="mb-2 text-[14px] font-semibold uppercase tracking-[0.05em] text-mes-ink-2">Размер палеты</p>
            <Segmented
              size="lg"
              value={palletSize}
              onChange={setPalletSize}
              options={[
                { value: 36, label: "36", sub: "бутылей" },
                { value: 48, label: "48", sub: "бутылей" },
              ]}
            />
            {selected && selected.defaultPalletSize !== palletSize && (
              <p className="mt-2 text-[14px] font-medium text-mes-amber-strong">Отличается от шаблона номенклатуры ({selected.defaultPalletSize})</p>
            )}
          </div>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-mes-line pt-4 text-[15px]">
            <dt className="text-mes-ink-3">Дата производства</dt>
            <dd className="text-right font-semibold text-mes-ink">{fmtDate(Date.now())}</dd>
            <dt className="text-mes-ink-3">Линия</dt>
            <dd className="text-right font-semibold text-mes-ink">{state.settings.lineName}</dd>
            <dt className="text-mes-ink-3">Оператор</dt>
            <dd className="text-right font-semibold text-mes-ink">{state.settings.operator}</dd>
            <dt className="text-mes-ink-3">Номер партии</dt>
            <dd className="text-right font-semibold text-mes-ink">авто</dd>
          </dl>
        </aside>
      </div>
    </Modal>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
 * Скан палетного кода
 * ════════════════════════════════════════════════════════════════════════════ */

const PALLET_VIEW = {
  awaiting_code: { icon: ScanBarcode, title: "Палета собрана — отсканируйте палетный код", hint: "Наведите сканер на SSCC-этикетку палеты. Окно закроется автоматически." },
  scan_error: { icon: XCircle, title: "Ошибка сканирования", hint: "Код не распознан как палетный. Отсканируйте этикетку SSCC ещё раз." },
  code_used: { icon: AlertOctagon, title: "Палетный код уже использован", hint: "Эта этикетка уже присвоена другой палете. Возьмите новую этикетку и повторите скан." },
  closed_ok: { icon: PackageCheck, title: "Палета успешно агрегирована", hint: "Палета закрыта. Формируется следующая." },
  filling: { icon: PackageOpen, title: "Палета ещё не собрана", hint: "Палетный код принимается после набора полной палеты." },
} as const

export function PalletScanModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, active, scanPallet } = useMes()
  const [value, setValue] = useState("")
  const [partialConfirm, setPartialConfirm] = useState(false)
  const [partialArmed, setPartialArmed] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const p = state.pallet
  const size = active?.palletSize ?? 48
  const full = p.items.length >= size
  const view = PALLET_VIEW[p.state]
  const tone = p.state === "filling" ? "info" : PALLET_LABEL[p.state].tone
  const t = TONE[tone]

  useEffect(() => {
    if (!open) return
    setValue("")
    setPartialArmed(false)
    const id = window.setTimeout(() => inputRef.current?.focus(), 50)
    return () => window.clearTimeout(id)
  }, [open])

  // Успех — показываем 1.6 с и закрываем, возвращая оператора к линии
  useEffect(() => {
    if (!open || p.state !== "closed_ok") return
    setValue("")
    const id = window.setTimeout(onClose, 1600)
    return () => window.clearTimeout(id)
  }, [open, p.state, p.stateSince, onClose])

  const submit = (code: string) => {
    if (!code.trim()) return
    scanPallet(code, partialArmed && !full)
    setValue("")
    inputRef.current?.focus()
  }

  const usedCode = Object.keys(state.pallets).find((c) => state.pallets[c].batchId === active?.id)
  const canScan = full || partialArmed || p.state === "closed_ok"

  return (
    <>
      <Modal open={open} onClose={onClose} icon={ScanBarcode} tone={tone} title="Сканирование палеты" subtitle={active ? `Партия № ${active.number} · ${active.nomenclatureName} · ${active.volume} л` : undefined} width="max-w-[880px]">
        <div className="flex flex-col gap-6">
          <div className={cn("flex items-center gap-6 rounded-3xl border-2 p-6", t.soft, t.border, p.state === "awaiting_code" && "mes-pulse")}>
            <span className={cn("mes-pop flex size-24 shrink-0 items-center justify-center rounded-3xl", t.solid)} key={p.state + p.stateSince}>
              <view.icon className="size-14" strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <p className={cn("text-[28px] font-bold leading-tight", t.text)}>{partialArmed && !full ? "Закрытие неполной палеты" : view.title}</p>
              <p className="mt-2 text-[17px] text-mes-ink-2">{partialArmed && !full ? `Будет закрыта палета из ${p.items.length} бутылей. Отсканируйте палетный код.` : view.hint}</p>
              {p.lastScan && p.state !== "filling" && <p className="mt-2 font-mono text-[15px] text-mes-ink-2">Последний скан: {SSCC_RE.test(p.lastScan.code) ? formatSscc(p.lastScan.code) : p.lastScan.code}</p>}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-2xl bg-mes-panel p-4 ring-1 ring-mes-line">
              <p className="text-[14px] font-semibold uppercase text-mes-ink-3">Палета</p>
              <p className="mt-1 text-[30px] font-bold text-mes-ink">№ {p.state === "closed_ok" ? p.index - 1 : p.index}</p>
            </div>
            <div className="rounded-2xl bg-mes-panel p-4 ring-1 ring-mes-line">
              <p className="text-[14px] font-semibold uppercase text-mes-ink-3">Бутылей</p>
              <p className="mt-1 text-[30px] font-bold tabular-nums text-mes-ink">
                {p.state === "closed_ok" ? size : p.items.length} <span className="text-mes-ink-3">/ {size}</span>
              </p>
            </div>
            <div className="rounded-2xl bg-mes-panel p-4 ring-1 ring-mes-line">
              <p className="text-[14px] font-semibold uppercase text-mes-ink-3">Накопитель</p>
              <p className={cn("mt-1 text-[30px] font-bold tabular-nums", state.buffer.length > state.settings.bufferLimit * 0.6 ? "text-mes-amber-strong" : "text-mes-ink")}>
                {state.buffer.length} <span className="text-mes-ink-3">/ {state.settings.bufferLimit}</span>
              </p>
            </div>
          </div>

          {canScan ? (
            <form
              className="flex gap-3"
              onSubmit={(e) => {
                e.preventDefault()
                submit(value)
              }}
            >
              <TextInput ref={inputRef} value={value} onChange={(e) => setValue(e.target.value)} placeholder="Сканер активен · или введите SSCC вручную" className="h-[72px] font-mono text-[22px]" inputMode="numeric" autoComplete="off" />
              <Btn type="submit" size="lg" variant="primary" className="min-w-44" disabled={!value.trim()}>
                Принять
              </Btn>
            </form>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-dashed border-mes-line-strong p-5">
              <p className="text-[17px] text-mes-ink-2">
                Осталось набрать <b className="text-mes-ink">{size - p.items.length}</b> бут. Окно откроется само, когда палета будет собрана.
              </p>
              {state.settings.allowPartialPallet && p.items.length > 0 && (
                <Btn variant="danger" icon={Flag} onClick={() => setPartialConfirm(true)}>
                  Закрыть неполную палету
                </Btn>
              )}
            </div>
          )}

          {canScan && (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-mes-panel px-4 py-3 ring-1 ring-mes-line">
              <span className="mr-1 text-[13px] font-semibold uppercase tracking-wider text-mes-ink-3">Демо-сканер</span>
              <Btn onClick={() => submit(makeSscc())}>Новая этикетка</Btn>
              <Btn onClick={() => submit(usedCode ?? makeSscc())}>Повторная этикетка</Btn>
              <Btn onClick={() => submit("0104607123450019")}>Нечитаемый код</Btn>
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={partialConfirm}
        onClose={() => setPartialConfirm(false)}
        onConfirm={() => {
          setPartialConfirm(false)
          setPartialArmed(true)
          window.setTimeout(() => inputRef.current?.focus(), 50)
        }}
        tone="warning"
        icon={Flag}
        title="Закрыть неполную палету?"
        message={`В палете ${p.items.length} из ${size} бутылей. Неполная палета будет отмечена в отчёте партии. Используйте только при смене партии или остановке линии.`}
        confirmLabel="Да, закрыть неполную"
      />
    </>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
 * Завершение партии: итог + решение по неполной палете
 * ════════════════════════════════════════════════════════════════════════════ */

export function FinishBatchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, active, finishBatch } = useMes()
  const { toast } = useMesUi()
  const [mode, setMode] = useState<"close" | "leave">("close")
  const [sscc, setSscc] = useState("")
  const left = state.pallet.items.length + state.buffer.length

  useEffect(() => {
    if (open) {
      setMode(state.pallet.items.length > 0 ? "close" : "leave")
      setSscc("")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!active) return null
  const hasPartial = state.pallet.items.length > 0 && state.pallet.state !== "closed_ok"
  const ssccOk = SSCC_RE.test(sscc.replace(/\s/g, "")) && !state.pallets[sscc.length === 18 ? `00${sscc}` : sscc]
  const canConfirm = !hasPartial || mode === "leave" || ssccOk

  const confirm = () => {
    finishBatch(hasPartial && mode === "close" ? sscc.replace(/\s/g, "") : undefined)
    toast({ tone: "success", title: `Партия № ${active.number} завершена`, text: "Отчёт доступен в разделе «Партии»" })
    onClose()
  }

  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={confirm}
      confirmDisabled={!canConfirm}
      icon={Flag}
      tone="critical"
      title={`Завершить партию № ${active.number}?`}
      confirmLabel="Завершить партию"
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Нанесено", fmtNum(active.applied)],
          ["Годных", fmtNum(active.good)],
          ["Палет", fmtNum(active.pallets)],
          ["В работе", fmtDuration(Date.now() - active.startedAt)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl bg-mes-panel p-4 ring-1 ring-mes-line">
            <p className="text-[13px] font-semibold uppercase text-mes-ink-3">{k}</p>
            <p className="mt-1 text-[24px] font-bold tabular-nums text-mes-ink">{v}</p>
          </div>
        ))}
      </div>

      {hasPartial ? (
        <div className="mt-5 flex flex-col gap-3">
          <p className="text-[17px] font-semibold text-mes-amber-strong">
            В текущей палете {state.pallet.items.length} бут. без палетного кода{state.buffer.length ? `, в накопителе ещё ${state.buffer.length}` : ""}.
          </p>
          <Segmented
            size="lg"
            value={mode}
            onChange={setMode}
            options={[
              { value: "close", label: "Закрыть неполную палету", sub: "нужен палетный код" },
              { value: "leave", label: "Оставить без агрегации", sub: `${left} бут. уйдут в отчёт` },
            ]}
          />
          {mode === "close" && (
            <div className="flex gap-3">
              <TextInput autoFocus value={sscc} onChange={(e) => setSscc(e.target.value)} placeholder="Отсканируйте SSCC палеты" className="font-mono" invalid={!!sscc && !ssccOk} />
              <Btn onClick={() => setSscc(makeSscc())}>Демо</Btn>
            </div>
          )}
        </div>
      ) : (
        <p className="mt-5 flex items-center gap-2 text-[17px] text-mes-olive-deep">
          <CheckCircle2 className="size-6" /> Все годные бутыли агрегированы в палеты.
        </p>
      )}
      <p className="mt-5 text-[15px] text-mes-ink-3">После завершения линия перейдёт в режим ожидания. Действие нельзя отменить.</p>
      <StatusPill tone="neutral" size="sm" className="mt-3">
        Оператор: {state.settings.operator}
      </StatusPill>
    </ConfirmDialog>
  )
}
