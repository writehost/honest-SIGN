import type { CodeStatus } from "@/lib/mock-data"

export const STATUS_LABELS: Record<string, string> = {
  EMITTED: "Эмитирован",
  APPLIED: "Нанесён",
  INTRODUCED: "Введён в оборот",
  DISAGGREGATION: "Расформирован",
  WRITTEN_OFF: "Списан",
  RETIRED: "Выбыл",
  WITHDRAWN: "Выведен из оборота",
  INTRODUCED_APPLIED: "Введён (нанесён)",
  INTRODUCED_INTO_TURNOVER: "Введён в оборот",
  EMPTY: "Пустая упаковка",
  PARTIAL_SALE: "Частичная реализация",
}

/** Подсказки для статусов (как в основном приложении) */
export const STATUS_DESCRIPTIONS: Record<CodeStatus, string> = {
  "В обороте": "Товар в обороте у участника",
  "Выведен": "Товар выведен из оборота (реализация, экспорт и т.д.)",
  "Выбыл": "КИ выбыл из оборота (статус RETIRED)",
  "Списан": "КИ списан (статус WRITTEN_OFF)",
  "Нанесён": "Маркировка нанесена на товар",
  "Эмитирован": "Код эмитирован в оборот производителем",
  "Агрегирован": "Упаковка агрегирована",
  "Расформирован": "Упаковка расформирована, коды перешли на уровень ниже",
  "Пустая упаковка": "Пустая упаковка (без вложенных кодов)",
}

export function getStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status
}

export function getStatusDescription(status: CodeStatus): string {
  return STATUS_DESCRIPTIONS[status] ?? ""
}
