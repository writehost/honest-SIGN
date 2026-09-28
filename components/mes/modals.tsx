"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, Flag, Layers, ListChecks, PackageOpen, Play, ScrollText, Search, Undo2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { batchTotal, fmtDate, fmtNum, useMes, type PalletSize, type Volume } from "./store"
import { Btn, Chip, ConfirmDialog, Modal, Segmented, TextInput, VolumeBadge } from "./ui"
import { useMesUi } from "./ui-context"

/* ════════════════════════════════════════════════════════════════════════════
 * Запуск партии: номенклатура → размер палеты → «Начать партию»
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
    const last = preselect ?? state.batches[0]?.nomenclatureId
    const n = state.nomenclature.find((x) => x.id === last && x.active)
    setSelectedId(n?.id)
    setPalletSize(n?.defaultPalletSize ?? state.settings.defaultPalletSize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preselect])

  // Недавно запускавшиеся позиции — первыми
  const order = useMemo(() => {
    const o: string[] = []
    for (const b of state.batches) if (!o.includes(b.nomenclatureId)) o.push(b.nomenclatureId)
    return o
  }, [state.batches])

  const q = query.trim().toLowerCase()
  const list = state.nomenclature
    .filter((n) => n.active && (volume === "all" || n.volume === volume))
    .filter((n) => !q || n.name.toLowerCase().includes(q) || n.sku.toLowerCase().includes(q) || n.gtin.includes(q))
    .sort((a, b) => (order.indexOf(a.id) + 1 || 99) - (order.indexOf(b.id) + 1 || 99))
  const selected = state.nomenclature.find((n) => n.id === selectedId)

  const start = () => {
    if (!selected) return
    const number = startBatch(selected.id, palletSize)
    toast({ tone: "success", title: `Партия № ${number} начата`, text: `${selected.name} · ${selected.volume} л · палета ${palletSize}` })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={Play}
      title="Начать партию"
      width="max-w-[1120px]"
      footer={
        <>
          <Btn size="lg" onClick={onClose} className="min-w-40">
            Отмена
          </Btn>
          <Btn size="lg" variant="primary" icon={Play} onClick={start} disabled={!selected} className="min-w-72">
            Начать партию
          </Btn>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative min-w-64 flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-6 -translate-y-1/2 text-mes-ink-3" />
              <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Название, артикул, GTIN" className="pl-13" />
            </div>
            <Chip on={volume === "all"} onClick={() => setVolume("all")}>Все</Chip>
            <Chip on={volume === 19} onClick={() => setVolume(19)}>19 л</Chip>
            <Chip on={volume === 11} onClick={() => setVolume(11)}>11 л</Chip>
          </div>
          <div className="flex max-h-[48vh] flex-col gap-2 overflow-y-auto pr-1">
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
                  className={cn("flex min-h-[76px] items-center gap-4 rounded-2xl border-2 px-4 text-left", on ? "border-mes-olive bg-mes-olive-tint" : "border-mes-line bg-mes-card hover:bg-mes-panel")}
                >
                  <VolumeBadge volume={n.volume} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[18px] font-semibold text-mes-ink">{n.name}</span>
                    <span className="block text-[14px] text-mes-ink-3">
                      {n.sku} · GTIN {n.gtin} · палета {n.defaultPalletSize}
                    </span>
                  </span>
                  {on && <CheckCircle2 className="size-8 shrink-0 text-mes-olive-strong" />}
                </button>
              )
            })}
            {list.length === 0 && <p className="py-10 text-center text-[17px] text-mes-ink-3">Ничего не найдено</p>}
          </div>
        </div>
        <aside className="flex flex-col gap-5 rounded-2xl bg-mes-panel p-5 ring-1 ring-mes-line">
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-[0.05em] text-mes-ink-3">Номенклатура</p>
            <p className={cn("mt-1 text-[19px] font-semibold", selected ? "text-mes-ink" : "text-mes-ink-3")}>{selected?.name ?? "Не выбрана"}</p>
            {selected && (
              <p className="mt-2 flex items-center gap-2 text-[15px] text-mes-ink-2">
                <VolumeBadge volume={selected.volume} size="sm" /> GTIN {selected.gtin}
              </p>
            )}
          </div>
          <div>
            <p className="mb-2 text-[13px] font-semibold uppercase tracking-[0.05em] text-mes-ink-3">Бутылей в палете</p>
            <Segmented size="lg" value={palletSize} onChange={setPalletSize} options={[{ value: 36, label: "36" }, { value: 48, label: "48" }]} />
            {selected && selected.defaultPalletSize !== palletSize && <p className="mt-2 text-[14px] font-medium text-mes-amber-strong">В номенклатуре указано {selected.defaultPalletSize}</p>}
          </div>
          <dl className="grid grid-cols-2 gap-y-2 border-t border-mes-line pt-4 text-[15px]">
            <dt className="text-mes-ink-3">Дата</dt>
            <dd className="text-right font-semibold">{fmtDate(Date.now())}</dd>
            <dt className="text-mes-ink-3">Оператор</dt>
            <dd className="text-right font-semibold">{state.settings.operator}</dd>
            <dt className="text-mes-ink-3">Номер партии</dt>
            <dd className="text-right font-semibold">присвоится автоматически</dd>
          </dl>
        </aside>
      </div>
    </Modal>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
 * Завершение партии
 * ════════════════════════════════════════════════════════════════════════════ */

export function FinishBatchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, active, pallet, finishBatch, requestPartial } = useMes()
  const { toast } = useMesUi()
  if (!active || !pallet) return null
  const left = state.fifo.length

  const finish = () => {
    finishBatch()
    toast({ tone: left ? "warning" : "success", title: `Партия № ${active.number} завершена`, text: left ? `${left} бут. без агрегации отмечены в отчёте` : undefined })
    onClose()
  }
  const closePartialFirst = () => {
    requestPartial(true)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} icon={Flag} tone="critical" title={`Завершить партию № ${active.number}?`} width="max-w-[760px]">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Нанесено кодов", active.applied],
          ["Всего бутылей", batchTotal(active)],
          ["Палет", active.pallets],
          ["Без палеты", left],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-mes-panel p-4 ring-1 ring-mes-line">
            <dt className="text-[13px] font-semibold uppercase text-mes-ink-3">{k}</dt>
            <dd className={cn("mt-1 text-[28px] font-bold tabular-nums", k === "Без палеты" && Number(v) > 0 ? "text-mes-amber-strong" : "text-mes-ink")}>{fmtNum(Number(v))}</dd>
          </div>
        ))}
      </dl>
      {left > 0 ? (
        <div className="mt-6 flex flex-col gap-3">
          <p className="text-[18px] text-mes-ink-2">
            В FIFO {left} бут. без палетного кода. Закройте их неполной палетой или завершите партию — остаток попадёт в отчёт как неагрегированный.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {state.settings.allowPartialPallet && (
              <Btn size="lg" variant="primary" icon={PackageOpen} onClick={closePartialFirst} sub={`палета № ${pallet.no} · ${Math.min(left, active.palletSize)} бут.`}>
                Закрыть неполную палету
              </Btn>
            )}
            <Btn size="lg" variant="dark" icon={Flag} onClick={finish} className="bg-mes-red shadow-none hover:bg-mes-red-strong" sub={`${left} бут. без агрегации`}>
              Завершить партию
            </Btn>
          </div>
        </div>
      ) : (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <p className="flex items-center gap-2 text-[17px] text-mes-olive-deep">
            <CheckCircle2 className="size-6" /> Все бутыли агрегированы
          </p>
          <div className="flex gap-3">
            <Btn size="lg" onClick={onClose} className="min-w-40">
              Отмена
            </Btn>
            <Btn size="lg" variant="dark" icon={Flag} onClick={finish} className="bg-mes-red shadow-none hover:bg-mes-red-strong">
              Завершить партию
            </Btn>
          </div>
        </div>
      )}
    </Modal>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
 * Дополнительные операции — редкие действия, убранные с главного экрана
 * ════════════════════════════════════════════════════════════════════════════ */

export function MoreOperationsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, active, pallet, requestPartial } = useMes()
  const router = useRouter()
  const [confirmPartial, setConfirmPartial] = useState(false)
  if (!active || !pallet) return null
  const canPartial = state.settings.allowPartialPallet && pallet.inPallet > 0 && !pallet.full && !state.partialRequested
  const go = (href: string) => {
    onClose()
    router.push(href)
  }
  const Item = ({ icon: Icon, title, sub, onClick, disabled }: { icon: typeof Layers; title: string; sub: string; onClick: () => void; disabled?: boolean }) => (
    <button type="button" disabled={disabled} onClick={onClick} className="flex min-h-[76px] w-full items-center gap-4 rounded-2xl border border-mes-line bg-mes-card px-5 text-left hover:bg-mes-panel disabled:opacity-40">
      <Icon className="size-7 shrink-0 text-mes-olive-strong" />
      <span>
        <span className="block text-[18px] font-semibold text-mes-ink">{title}</span>
        <span className="block text-[14px] text-mes-ink-3">{sub}</span>
      </span>
    </button>
  )
  return (
    <>
      <Modal open={open && !confirmPartial} onClose={onClose} title="Другие операции" width="max-w-[620px]">
        <div className="flex flex-col gap-3">
          {state.partialRequested ? (
            <Item icon={Undo2} title="Отменить закрытие неполной палеты" sub="Продолжить набор палеты до полной" onClick={() => { requestPartial(false); onClose() }} />
          ) : (
            <Item
              icon={PackageOpen}
              title="Закрыть неполную палету"
              sub={canPartial ? `Палета № ${pallet.no}: ${pallet.inPallet} из ${pallet.size}` : pallet.full ? "Палета уже собрана — отсканируйте SSCC" : !state.settings.allowPartialPallet ? "Запрещено в настройках" : "В палете нет бутылей"}
              onClick={() => setConfirmPartial(true)}
              disabled={!canPartial}
            />
          )}
          <Item icon={ListChecks} title="Детали партии" sub="Закрытые палеты, SSCC, корректировки" onClick={() => go(`/mes/batches?batch=${active.id}`)} />
          <Item icon={ScrollText} title="Журнал событий" sub="Все события камеры, агрегации и кодов" onClick={() => go("/mes/events")} />
        </div>
      </Modal>
      <ConfirmDialog
        open={confirmPartial}
        onClose={() => setConfirmPartial(false)}
        onConfirm={() => {
          requestPartial(true)
          setConfirmPartial(false)
          onClose()
        }}
        tone="warning"
        icon={PackageOpen}
        title={`Закрыть палету № ${pallet.no} неполной?`}
        message={`В палете ${pallet.inPallet} из ${pallet.size} бутылей. После подтверждения система запросит палетный код. Палета будет отмечена в отчёте как неполная.`}
        confirmLabel="Запросить палетный код"
      />
    </>
  )
}
