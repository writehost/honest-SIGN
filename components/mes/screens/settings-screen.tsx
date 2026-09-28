"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { Bell, Camera, Cloud, Cpu, Factory, Layers, Monitor, Printer, ScanLine, ShieldCheck, UserRound, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { useMes, type MesState, type ScanMode } from "../store"
import { Btn, Card, Field, PageHeader, Segmented, StatusPill, TextInput, ToggleRow } from "../ui"

type Section = "ui" | "line" | "pallet" | "scanner" | "notify" | "equipment" | "users"

const SECTIONS: { id: Section; label: string; icon: LucideIcon }[] = [
  { id: "ui", label: "Интерфейс", icon: Monitor },
  { id: "line", label: "Линия", icon: Factory },
  { id: "pallet", label: "Палета и агрегация", icon: Layers },
  { id: "scanner", label: "Ручной сканер", icon: ScanLine },
  { id: "notify", label: "Уведомления", icon: Bell },
  { id: "equipment", label: "Оборудование", icon: Cpu },
  { id: "users", label: "Пользователи и доступ", icon: ShieldCheck },
]

export function SettingsScreen() {
  const params = useSearchParams()
  const router = useRouter()
  const section = (SECTIONS.find((s) => s.id === params.get("section"))?.id ?? "ui") as Section
  const go = (s: Section) => router.replace(`/mes/settings?section=${s}`)

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Настройки" subtitle="Изменения применяются сразу и фиксируются в журнале" />
      <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <nav className="flex gap-2 overflow-x-auto lg:flex-col">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => go(id)}
              className={cn(
                "flex min-h-16 shrink-0 items-center gap-3 rounded-2xl px-4 text-left text-[17px] font-semibold transition-colors",
                section === id ? "bg-mes-card text-mes-ink shadow-sm ring-2 ring-mes-olive" : "text-mes-ink-2 hover:bg-mes-card",
              )}
            >
              <Icon className={cn("size-6", section === id ? "text-mes-olive-strong" : "text-mes-ink-3")} />
              {label}
            </button>
          ))}
        </nav>
        <div className="min-w-0">
          {section === "ui" && <UiSection />}
          {section === "line" && <LineSection />}
          {section === "pallet" && <PalletSection />}
          {section === "scanner" && <ScannerSection />}
          {section === "notify" && <NotifySection />}
          {section === "equipment" && <EquipmentSection />}
          {section === "users" && <UsersSection />}
        </div>
      </div>
    </div>
  )
}

function Rows({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col divide-y divide-mes-line">{children}</div>
}

function UiSection() {
  const { state, updateSettings } = useMes()
  return (
    <Card title="Интерфейс" icon={Monitor}>
      <Rows>
        <ToggleRow checked={state.settings.largeText} onChange={(v) => updateSettings({ largeText: v })} label="Крупный текст" description="Для экранов, на которые смотрят с 1,5–2 м" />
        <div className="grid gap-5 py-5 sm:grid-cols-2">
          <Field label="Тема">
            <Segmented value="light" onChange={() => undefined} options={[{ value: "light", label: "Светлая" }, { value: "dark", label: "Тёмная", sub: "в разработке" }]} />
          </Field>
          <Field label="Язык">
            <Segmented value="ru" onChange={() => undefined} options={[{ value: "ru", label: "Русский" }, { value: "kz", label: "Қазақша", sub: "позже" }]} />
          </Field>
        </div>
        <ToggleRow checked onChange={() => undefined} label="Экранная клавиатура" description="Появляется при касании поля ввода (системная клавиатура ОС)" />
      </Rows>
    </Card>
  )
}

function LineSection() {
  const { state, updateSettings } = useMes()
  const s = state.settings
  return (
    <Card title="Линия" icon={Factory}>
      <div className="flex flex-col gap-6">
        <Field label="Название линии" hint="Показывается в шапке и отчётах">
          <TextInput value={s.lineName} onChange={(e) => updateSettings({ lineName: e.target.value })} />
        </Field>
        <Field label="Скорость линии (симуляция)" hint="Бутылей в минуту. В боевой системе — фактическая скорость с ПЛК">
          <Segmented value={s.lineSpeed} onChange={(v) => updateSettings({ lineSpeed: v })} options={[20, 40, 60, 120].map((v) => ({ value: v, label: `${v}`, sub: "бут/мин" }))} />
        </Field>
        <Field label="Доля брака камеры (симуляция)">
          <Segmented value={s.rejectRate} onChange={(v) => updateSettings({ rejectRate: v })} options={[0, 0.01, 0.03, 0.1].map((v) => ({ value: v, label: `${v * 100} %` }))} />
        </Field>
        <Field label="Ёмкость накопителя" hint="Сколько бутылей может накопиться, пока палета ждёт палетный код. При заполнении — автостоп линии">
          <Segmented value={s.bufferLimit} onChange={(v) => updateSettings({ bufferLimit: v })} options={[6, 12, 24].map((v) => ({ value: v, label: `${v}`, sub: "бутылей" }))} />
        </Field>
      </div>
    </Card>
  )
}

function PalletSection() {
  const { state, updateSettings } = useMes()
  const s = state.settings
  return (
    <Card title="Палета и агрегация" icon={Layers}>
      <div className="flex flex-col gap-5">
        <Field label="Размер палеты по умолчанию" hint="Для новых позиций номенклатуры и при запуске без шаблона">
          <Segmented
            size="lg"
            value={s.defaultPalletSize}
            onChange={(v) => updateSettings({ defaultPalletSize: v })}
            options={[
              { value: 36, label: "36 бутылей", sub: "3 яруса × 12" },
              { value: 48, label: "48 бутылей", sub: "4 яруса × 12" },
            ]}
          />
        </Field>
        <Rows>
          <ToggleRow checked={s.autoOpenPalletScan} onChange={(v) => updateSettings({ autoOpenPalletScan: v })} label="Автоматически открывать окно скана палеты" description="Как только набрано 36/48 бутылей" />
          <ToggleRow checked={s.allowPartialPallet} onChange={(v) => updateSettings({ allowPartialPallet: v })} label="Разрешить закрытие неполной палеты" description="С подтверждением. Отмечается в отчёте партии" />
        </Rows>
        <div className="rounded-2xl bg-mes-panel p-4 text-[15px] text-mes-ink-2 ring-1 ring-mes-line">
          Формат палетного кода: <b className="text-mes-ink">SSCC (GS1-128), 18 цифр, AI (00)</b>. Проверяется формат и уникальность в пределах предприятия.
        </div>
      </div>
    </Card>
  )
}

function ScannerSection() {
  const { state, updateSettings } = useMes()
  const s = state.settings
  return (
    <Card title="Ручной сканер" icon={ScanLine}>
      <div className="flex flex-col gap-5">
        <Field label="Режим при открытии экрана «Коды»">
          <Segmented<ScanMode>
            value={s.defaultScanMode}
            onChange={(v) => updateSettings({ defaultScanMode: v })}
            options={[
              { value: "check", label: "Проверить" },
              { value: "add", label: "Добавить" },
              { value: "remove", label: "Удалить" },
            ]}
          />
        </Field>
        <Rows>
          <ToggleRow checked={s.confirmRemove} onChange={(v) => updateSettings({ confirmRemove: v })} label="Подтверждать удаление кода" description="Рекомендуется оставить включённым" />
          <ToggleRow checked onChange={() => undefined} label="Перехват сканера на любом экране" description="Скан DataMatrix вне поля ввода открывает «Коды», скан SSCC — окно палеты" />
        </Rows>
      </div>
    </Card>
  )
}

function NotifySection() {
  const { state, updateSettings } = useMes()
  const s = state.settings
  return (
    <Card title="Уведомления" icon={Bell}>
      <div className="flex flex-col gap-5">
        <Rows>
          <ToggleRow checked={s.sound} onChange={(v) => updateSettings({ sound: v })} label="Звуковой сигнал" description="Палета собрана, ошибка скана, аварийный стоп" />
          <ToggleRow checked onChange={() => undefined} label="Сигнальная колонна" description="Жёлтый — ждём палетный код, красный — стоп (через ПЛК)" />
        </Rows>
        <Field label="Время показа всплывающих сообщений">
          <Segmented value={s.toastSeconds} onChange={(v) => updateSettings({ toastSeconds: v })} options={[3, 4, 6, 10].map((v) => ({ value: v, label: `${v} с` }))} />
        </Field>
        <p className="text-[15px] text-mes-ink-3">Критические состояния (аварийный стоп, нет связи) не скрываются автоматически — они остаются в красной полосе до устранения.</p>
      </div>
    </Card>
  )
}

function EquipmentSection() {
  const { state, toggleEquipment } = useMes()
  const rows: { key: keyof MesState["equipment"]; label: string; icon: LucideIcon; addr: string }[] = [
    { key: "printer", label: "Принтер-аппликатор", icon: Printer, addr: "TCP 192.168.10.21:9100" },
    { key: "camera", label: "Камера контроля нанесения", icon: Camera, addr: "TCP 192.168.10.22:2001" },
    { key: "scanner", label: "Ручной сканер", icon: ScanLine, addr: "USB HID · клавиатурный режим" },
    { key: "gis", label: "ГИС МТ / СУЗ", icon: Cloud, addr: "HTTPS · api.crpt.ru" },
  ]
  return (
    <Card title="Оборудование" icon={Cpu}>
      <div className="flex flex-col divide-y divide-mes-line">
        {rows.map(({ key, label, icon: Icon, addr }) => {
          const ok = state.equipment[key]
          return (
            <div key={key} className="flex flex-wrap items-center gap-4 py-4">
              <span className={cn("flex size-14 items-center justify-center rounded-2xl", ok ? "bg-mes-olive-soft" : "bg-mes-red-soft")}>
                <Icon className={cn("size-7", ok ? "text-mes-olive-strong" : "text-mes-red-strong")} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[18px] font-semibold text-mes-ink">{label}</p>
                <p className="font-mono text-[14px] text-mes-ink-3">{addr}</p>
              </div>
              <StatusPill tone={ok ? "success" : "critical"} pulse={!ok}>
                {ok ? "На связи" : "Нет связи"}
              </StatusPill>
              <Btn onClick={() => toggleEquipment(key)} variant={ok ? "ghost" : "primary"}>
                {ok ? "Симулировать обрыв" : "Восстановить"}
              </Btn>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function UsersSection() {
  const { state, updateSettings } = useMes()
  const roles = [
    { role: "Оператор", can: "Запуск/пауза партии, скан палет, проверка и добавление кодов" },
    { role: "Мастер смены", can: "+ удаление кодов, неполные палеты, завершение партии, номенклатура" },
    { role: "Администратор", can: "+ настройки линии и оборудования, пользователи" },
  ]
  return (
    <div className="flex flex-col gap-5">
      <Card title="Текущий пользователь" icon={UserRound}>
        <Field label="Оператор смены" hint="В боевой системе — вход по карте/PIN, смена пользователя без перезапуска партии">
          <Segmented value={state.settings.operator} onChange={(v) => updateSettings({ operator: v })} options={["Смирнова Е.", "Петров А.", "Иванов С."].map((v) => ({ value: v, label: v }))} />
        </Field>
      </Card>
      <Card title="Роли и права" icon={ShieldCheck} bodyClassName="p-0">
        <div className="divide-y divide-mes-line">
          {roles.map((r) => (
            <div key={r.role} className="flex min-h-[72px] flex-wrap items-center gap-4 px-5 py-3">
              <span className="w-48 text-[17px] font-semibold text-mes-ink">{r.role}</span>
              <span className="flex-1 text-[15px] text-mes-ink-2">{r.can}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
