"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Camera, Factory, Layers, Monitor, ScanLine, ShieldCheck, UserRound, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { fmtTime, isCameraOnline, useMes, useNow, type ScanMode } from "../store"
import { Card, Field, PageHeader, Segmented, StatusPill, TextInput, ToggleRow } from "../ui"

type Section = "ui" | "line" | "pallet" | "scanner" | "camera" | "users"

const SECTIONS: { id: Section; label: string; icon: LucideIcon }[] = [
  { id: "line", label: "Линия", icon: Factory },
  { id: "pallet", label: "Палета и агрегация", icon: Layers },
  { id: "camera", label: "Камера", icon: Camera },
  { id: "scanner", label: "Ручной сканер", icon: ScanLine },
  { id: "ui", label: "Интерфейс", icon: Monitor },
  { id: "users", label: "Пользователи", icon: ShieldCheck },
]

export function SettingsScreen() {
  const params = useSearchParams()
  const router = useRouter()
  const section = (SECTIONS.find((s) => s.id === params.get("section"))?.id ?? "line") as Section
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Настройки" />
      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <nav className="flex gap-2 overflow-x-auto lg:flex-col">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => router.replace(`/mes/settings?section=${id}`)}
              className={cn("flex min-h-16 shrink-0 items-center gap-3 rounded-2xl px-4 text-left text-[17px] font-semibold", section === id ? "bg-mes-card text-mes-ink shadow-sm ring-2 ring-mes-olive" : "text-mes-ink-2 hover:bg-mes-card")}
            >
              <Icon className={cn("size-6", section === id ? "text-mes-olive-strong" : "text-mes-ink-3")} />
              {label}
            </button>
          ))}
        </nav>
        <div className="min-w-0 max-w-[960px]">
          {section === "line" && <LineSection />}
          {section === "pallet" && <PalletSection />}
          {section === "camera" && <CameraSection />}
          {section === "scanner" && <ScannerSection />}
          {section === "ui" && <UiSection />}
          {section === "users" && <UsersSection />}
        </div>
      </div>
    </div>
  )
}

function LineSection() {
  const { state, updateSettings } = useMes()
  return (
    <Card title="Линия" icon={Factory}>
      <Field label="Название линии" hint="Показывается в верхней панели и отчётах">
        <TextInput value={state.settings.lineName} onChange={(e) => updateSettings({ lineName: e.target.value })} />
      </Field>
      <p className="mt-5 text-[15px] text-mes-ink-3">Управление конвейером (пуск/останов) не предусмотрено: интеграция с ПЛК линии не подключена.</p>
    </Card>
  )
}

function PalletSection() {
  const { state, updateSettings } = useMes()
  const s = state.settings
  return (
    <Card title="Палета и агрегация" icon={Layers}>
      <div className="flex flex-col gap-5">
        <Field label="Размер палеты по умолчанию" hint="Для новых позиций номенклатуры; при запуске партии берётся из номенклатуры">
          <Segmented size="lg" value={s.defaultPalletSize} onChange={(v) => updateSettings({ defaultPalletSize: v })} options={[{ value: 36, label: "36 бутылей" }, { value: 48, label: "48 бутылей" }]} />
        </Field>
        <div className="rounded-2xl ring-1 ring-mes-line">
          <ToggleRow checked={s.allowPartialPallet} onChange={(v) => updateSettings({ allowPartialPallet: v })} label="Разрешить закрытие неполной палеты" description="С подтверждением; палета отмечается в отчёте как неполная" />
        </div>
        <p className="text-[15px] text-mes-ink-2">
          Палетный код: SSCC (AI 00), 18 цифр. Проверяются формат, контрольная цифра GS1 и уникальность. Повторный скан уже закрытой палеты не изменяет учёт.
        </p>
      </div>
    </Card>
  )
}

function CameraSection() {
  const { state, updateSettings } = useMes()
  const now = useNow()
  const online = isCameraOnline(state, now)
  return (
    <Card title="Камера контроля нанесения" icon={Camera}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-mes-panel p-4 ring-1 ring-mes-line">
          <StatusPill tone={online ? "success" : "critical"}>{online ? "На связи" : "Нет связи"}</StatusPill>
          <span className="text-[15px] text-mes-ink-2">Последний отклик: {fmtTime(state.camera.lastHeartbeat)}</span>
        </div>
        <Field label="Режим работы">
          <Segmented
            value="sim"
            onChange={() => undefined}
            options={[
              { value: "sim", label: "Симуляция", sub: "текущий режим" },
              { value: "prod", label: "Производство", sub: "интеграция не подключена" },
            ]}
          />
        </Field>
        <Field label="Адрес камеры" hint="Используется в сообщении об обрыве связи">
          <TextInput value={state.settings.cameraAddress} onChange={(e) => updateSettings({ cameraAddress: e.target.value })} className="font-mono" />
        </Field>
        <Field label="Считать связь потерянной через" hint="Отсутствие новых бутылей — это простой, а не ошибка. Предупреждение появляется только если камера перестала отвечать.">
          <Segmented value={state.settings.cameraTimeoutSec} onChange={(v) => updateSettings({ cameraTimeoutSec: v })} options={[5, 10, 30].map((v) => ({ value: v, label: `${v} с` }))} />
        </Field>
      </div>
    </Card>
  )
}

function ScannerSection() {
  const { state, updateSettings } = useMes()
  return (
    <Card title="Ручной сканер" icon={ScanLine}>
      <div className="flex flex-col gap-5">
        <Field label="Режим экрана «Коды» по умолчанию">
          <Segmented<ScanMode>
            value={state.settings.defaultScanMode}
            onChange={(v) => updateSettings({ defaultScanMode: v })}
            options={[
              { value: "check", label: "Проверить" },
              { value: "add", label: "Добавить" },
              { value: "remove", label: "Удалить" },
            ]}
          />
        </Field>
        <p className="text-[15px] text-mes-ink-2">
          USB-сканер в режиме HID Keyboard с суффиксом Enter. Скан попадает в активное поле; вне поля ввода система распознаёт быстрый ввод и направляет код на текущий экран: DataMatrix — в проверку кода, SSCC — в подтверждение палеты. Разделитель GS может отсутствовать — код всё равно распознаётся.
        </p>
      </div>
    </Card>
  )
}

function UiSection() {
  const { state, updateSettings } = useMes()
  return (
    <Card title="Интерфейс" icon={Monitor}>
      <div className="rounded-2xl ring-1 ring-mes-line">
        <ToggleRow checked={state.settings.largeText} onChange={(v) => updateSettings({ largeText: v })} label="Крупный текст" description="Для экрана, на который смотрят с 2 м" />
      </div>
    </Card>
  )
}

function UsersSection() {
  const { state, updateSettings } = useMes()
  return (
    <Card title="Оператор смены" icon={UserRound}>
      <Field label="Оператор" hint="Фиксируется в партии и журнале. Вход по карте/PIN и роли — на следующем этапе">
        <Segmented value={state.settings.operator} onChange={(v) => updateSettings({ operator: v })} options={["Смирнова Е.", "Петров А.", "Иванов С."].map((v) => ({ value: v, label: v }))} />
      </Field>
    </Card>
  )
}
