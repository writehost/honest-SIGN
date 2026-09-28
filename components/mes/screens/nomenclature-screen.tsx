"use client"

import { useState } from "react"
import { Boxes, Pencil, Play, Plus, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { uid, useMes, type Nomenclature, type Volume } from "../store"
import { Btn, Chip, Drawer, EmptyState, Field, PageHeader, Segmented, StatusPill, TextInput, ToggleRow, VolumeBadge } from "../ui"
import { useMesUi } from "../ui-context"

const EMPTY: Nomenclature = { id: "", name: "", sku: "", gtin: "", volume: 19, description: "", active: true, defaultPalletSize: 48 }

export function NomenclatureScreen() {
  const { state, active } = useMes()
  const { openLaunch } = useMesUi()
  const [query, setQuery] = useState("")
  const [volume, setVolume] = useState<Volume | "all">("all")
  const [archived, setArchived] = useState(false)
  const [editing, setEditing] = useState<Nomenclature | null>(null)

  const q = query.trim().toLowerCase()
  const list = state.nomenclature
    .filter((n) => n.active !== archived)
    .filter((n) => volume === "all" || n.volume === volume)
    .filter((n) => !q || n.name.toLowerCase().includes(q) || n.sku.toLowerCase().includes(q) || n.gtin.includes(q))
  const batchCount = (id: string) => state.batches.filter((b) => b.nomenclatureId === id).length

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Номенклатура"
        subtitle="Продукция, которую можно запускать на линии"
        actions={
          <Btn size="lg" variant="primary" icon={Plus} onClick={() => setEditing({ ...EMPTY, defaultPalletSize: state.settings.defaultPalletSize })}>
            Добавить номенклатуру
          </Btn>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-96">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-6 -translate-y-1/2 text-mes-ink-3" />
          <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Название, артикул или GTIN" className="h-12 pl-13 text-[16px]" />
        </div>
        <Chip on={volume === "all"} onClick={() => setVolume("all")}>Все объёмы</Chip>
        <Chip on={volume === 19} onClick={() => setVolume(19)}>19 л</Chip>
        <Chip on={volume === 11} onClick={() => setVolume(11)}>11 л</Chip>
        <span className="mx-1 h-8 w-px bg-mes-line-strong" />
        <Chip on={!archived} onClick={() => setArchived(false)} count={state.nomenclature.filter((n) => n.active).length}>
          Активные
        </Chip>
        <Chip on={archived} onClick={() => setArchived(true)} count={state.nomenclature.filter((n) => !n.active).length}>
          Архив
        </Chip>
      </div>

      {list.length === 0 ? (
        <section className="rounded-2xl border border-mes-line bg-mes-card">
          <EmptyState icon={Boxes} title="Номенклатура не найдена" text="Измените фильтр или создайте новую позицию" />
        </section>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {list.map((n) => (
            <article key={n.id} className={cn("flex flex-col rounded-2xl border bg-mes-card", active?.nomenclatureId === n.id ? "border-mes-olive ring-4 ring-mes-olive/15" : "border-mes-line")}>
              <div className="flex flex-1 gap-4 p-5">
                <VolumeBadge volume={n.volume} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {active?.nomenclatureId === n.id && (
                      <StatusPill tone="success" size="sm">
                        На линии
                      </StatusPill>
                    )}
                    {!n.active && (
                      <StatusPill tone="neutral" size="sm">
                        В архиве
                      </StatusPill>
                    )}
                  </div>
                  <h3 className="mt-1 text-[20px] font-bold leading-snug text-mes-ink">{n.name}</h3>
                  <p className="mt-1 line-clamp-2 text-[15px] text-mes-ink-3">{n.description || "Без описания"}</p>
                  <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[15px]">
                    <dt className="text-mes-ink-3">Артикул</dt>
                    <dd className="font-semibold text-mes-ink">{n.sku}</dd>
                    <dt className="text-mes-ink-3">GTIN</dt>
                    <dd className="font-mono font-semibold text-mes-ink">{n.gtin}</dd>
                    <dt className="text-mes-ink-3">Палета</dt>
                    <dd className="font-semibold text-mes-ink">{n.defaultPalletSize} бут. · партий: {batchCount(n.id)}</dd>
                  </dl>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 border-t border-mes-line p-3">
                <Btn icon={Pencil} onClick={() => setEditing(n)}>
                  Изменить
                </Btn>
                <Btn variant="primary" icon={Play} disabled={!n.active || !!active} onClick={() => openLaunch(n.id)}>
                  Запустить
                </Btn>
              </div>
            </article>
          ))}
        </div>
      )}

      {editing && <NomenclatureForm initial={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function NomenclatureForm({ initial, onClose }: { initial: Nomenclature; onClose: () => void }) {
  const { state, active, upsertNomenclature } = useMes()
  const { toast } = useMesUi()
  const [f, setF] = useState(initial)
  const [touched, setTouched] = useState(false)
  const isNew = !initial.id
  const set = <K extends keyof Nomenclature>(k: K, v: Nomenclature[K]) => setF((x) => ({ ...x, [k]: v }))

  const gtinDup = state.nomenclature.some((n) => n.gtin === f.gtin && n.id !== f.id)
  const errors = {
    name: !f.name.trim() ? "Укажите название" : undefined,
    sku: !f.sku.trim() ? "Укажите артикул" : undefined,
    gtin: !/^\d{14}$/.test(f.gtin) ? "GTIN — 14 цифр" : gtinDup ? "Такой GTIN уже есть в справочнике" : undefined,
  }
  const valid = !errors.name && !errors.sku && !errors.gtin
  const onLine = active?.nomenclatureId === f.id

  const save = () => {
    setTouched(true)
    if (!valid) return
    upsertNomenclature({ ...f, id: f.id || uid(), name: f.name.trim(), sku: f.sku.trim() })
    toast({ tone: "success", title: isNew ? "Номенклатура создана" : "Изменения сохранены", text: `${f.name} · ${f.volume} л` })
    onClose()
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title={isNew ? "Новая номенклатура" : "Редактирование номенклатуры"}
      subtitle={isNew ? "Поля со звёздочкой обязательны" : f.name}
      footer={
        <>
          <Btn size="lg" onClick={onClose} className="min-w-40">
            Отмена
          </Btn>
          <Btn size="lg" variant="primary" onClick={save} className="min-w-56">
            {isNew ? "Создать" : "Сохранить"}
          </Btn>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        {onLine && <p className="rounded-2xl bg-mes-amber-soft p-4 text-[15px] font-medium text-mes-amber-strong ring-1 ring-mes-amber/40">Позиция сейчас на линии. Изменения GTIN и объёма применятся к следующей партии.</p>}
        <Field label="Название *" error={touched && errors.name}>
          <TextInput value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Вода питьевая «…»" invalid={touched && !!errors.name} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Артикул *" error={touched && errors.sku}>
            <TextInput value={f.sku} onChange={(e) => set("sku", e.target.value.toUpperCase())} placeholder="GR-19-001" invalid={touched && !!errors.sku} />
          </Field>
          <Field label="GTIN *" error={touched && errors.gtin} hint="14 цифр, из карточки товара в ГИС МТ">
            <TextInput value={f.gtin} onChange={(e) => set("gtin", e.target.value.replace(/\D/g, "").slice(0, 14))} inputMode="numeric" placeholder="04607…" className="font-mono" invalid={touched && !!errors.gtin} />
          </Field>
        </div>
        <Field label="Объём">
          <Segmented<Volume>
            size="lg"
            value={f.volume}
            onChange={(v) => set("volume", v)}
            options={[
              { value: 19, label: "19 л" },
              { value: 11, label: "11 л" },
            ]}
          />
        </Field>
        <Field label="Шаблон палеты по умолчанию" hint="Подставляется при запуске партии, оператор может изменить">
          <Segmented
            size="lg"
            value={f.defaultPalletSize}
            onChange={(v) => set("defaultPalletSize", v)}
            options={[
              { value: 36, label: "36 бутылей", sub: "3 яруса × 12" },
              { value: 48, label: "48 бутылей", sub: "4 яруса × 12" },
            ]}
          />
        </Field>
        <Field label="Описание">
          <textarea
            value={f.description}
            onChange={(e) => set("description", e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-mes-line-strong bg-mes-card px-4 py-3 text-[17px] text-mes-ink outline-none focus:border-mes-olive focus:ring-4 focus:ring-mes-olive/20"
          />
        </Field>
        <div className="rounded-2xl ring-1 ring-mes-line">
          <ToggleRow checked={f.active} onChange={(v) => set("active", v)} label="Активна" description="Неактивные позиции уходят в архив и не предлагаются при запуске партии" />
        </div>
      </div>
    </Drawer>
  )
}
