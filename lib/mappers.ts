import type { CodeEntry, CodeStatus, GroupType, ChestnyZnakData, IntegratorData, TrackingEvent, AggregationEvent } from "@/lib/mock-data"
import type { CisInfoItem, CisHistoryItem } from "./crpt-types"

const STATUS_MAP: Record<string, CodeStatus> = {
  INTRODUCED: "В обороте",
  INTRODUCED_APPLIED: "В обороте",
  INTRODUCED_INTO_TURNOVER: "В обороте",
  WITHDRAWN: "Выведен",
  RETIRED: "Выбыл",
  WRITTEN_OFF: "Списан",
  APPLIED: "Нанесён",
  EMITTED: "Эмитирован",
  DISAGGREGATION: "Расформирован",
  EMPTY: "Пустая упаковка",
}

function mapStatus(status?: string): CodeStatus {
  if (!status) return "В обороте"
  return STATUS_MAP[status] ?? "В обороте"
}

function mapGroupType(packageType?: string, generalPackageType?: string, cis?: string): GroupType {
  const p = (packageType || "").toUpperCase()
  const g = (generalPackageType || "").toUpperCase()
  const code = (cis || "").trim()
  if (p === "UNIT" || g === "UNIT") return "Продукт"
  if (code.startsWith("00")) return "Палета"
  if (g === "BOX" || p === "LEVEL2") return "Блок"
  return "Блок"
}

/** Извлечь серийный номер: код без GTIN (первые 14 символов у UNIT, у агрегатов по-другому) */
/** Причины вывода из оборота — по справочнику ГИС МТ */
const WITHDRAW_REASON_LABELS: Record<string, string> = {
  AUTO_CANCELLATION: "Аннулирование неиспользованных КМ по истечении срока",
  BALANCE_CORRECTION: "Корректировка остатков (ОСУ)",
  BEFORE_MARKING: "Выбытие до обязательности маркировки",
  BEYOND_EEC_EXPORT: "Экспорт за пределы стран ЕАЭС",
  BY_SAMPLES: "Продажа по образцам",
  COMPLAINTS: "Рекламации",
  OWN_USE: "Для собственных нужд",
  RETAIL: "Розничная продажа",
  LOST: "Утрата",
  THEFT: "Кража",
  EXPIRED: "Истёк срок годности",
  DEFECT: "Брак",
  EXPORT: "Экспорт",
  SALE: "Реализация",
  OTHER: "Иное",
}

function mapWithdrawReason(reason?: string): string | undefined {
  if (!reason) return undefined
  return WITHDRAW_REASON_LABELS[reason] ?? reason
}

function getSerial(cis: string, gtin?: string): string {
  if (!cis) return ""
  if (gtin && cis.startsWith(gtin)) return cis.slice(gtin.length).trim()
  if (cis.length > 14 && /^\d{14}/.test(cis)) return cis.slice(14).trim()
  return cis
}

export function cisInfoToCodeEntry(item: CisInfoItem, index: number): CodeEntry | null {
  const info = item?.cisInfo
  if (!info) return null
  const code = info.cis || info.requestedCis || ""
  const gtin = (info.gtin || "").trim()
  const productGroup = info.productGroup || "—"
  const nomenclature = (info.productName && info.productName !== "-") ? info.productName : (productGroup === "water" ? "Вода (ЕГАИС)" : productGroup)
  return {
    id: `crpt-${index}-${code}`,
    code,
    gtin: gtin || "—",
    serial: getSerial(code, gtin) || "—",
    status: mapStatus(info.status || info.statusEx),
    owner: info.ownerName || "—",
    ownerInn: info.ownerInn || "—",
    nomenclature,
    groupType: mapGroupType(info.packageType, info.generalPackageType, code),
    parentCode: undefined,
    children: info.child,
    productionDate: info.producedDate || info.emissionDate || info.introducedDate || "—",
    expirationDate: info.expirationDate,
    batch: info.batchNumber ?? info.partyNumber,
    tnVed: info.tnVedEaes,
    productGroup,
    withdrawReason: mapWithdrawReason(info.withdrawReason),
    markWithdraw: info.markWithdraw,
    applicationDate: info.applicationDate,
    introducedDate: info.introducedDate,
    productName: info.productName && info.productName !== "-" ? info.productName : undefined,
    brand: info.brand,
    producedDate: info.producedDate,
    emissionDate: info.emissionDate,
    emissionType: info.emissionType,
    turnoverType: info.turnoverType,
    producerInn: info.producerInn,
    producerName: info.producerName,
    manufacturerInn: info.manufacturerInn,
    manufacturerName: info.manufacturerName,
    isTracking: info.isTracking,
    isMultipleSales: info.isMultipleSales,
    batchNumber: info.batchNumber,
    partyNumber: info.partyNumber,
    manufacturerSerialNumber: info.manufacturerSerialNumber,
    withdrawReasonOther: info.withdrawReasonOther,
    ogvs: info.ogvs?.length ? info.ogvs : undefined,
    licences: info.licences?.length ? info.licences : undefined,
    certDoc: info.certDoc?.length ? info.certDoc : undefined,
    partialSaleInfo: info.partialSaleInfo,
    tnVedEaesGroup: info.tnVedEaesGroup,
  }
}

export function historyToChestnyZnakData(history: CisHistoryItem[], lastOperationLabel?: string): ChestnyZnakData {
  const trackingHistory: TrackingEvent[] = history.map((h) => ({
    date: h.operationDate || h.timestamp || "",
    operation: statusToOperationLabel(h.status),
    participant: h.ownerInn ? `ИНН ${h.ownerInn}` : "—",
    participantInn: h.ownerInn || "—",
    documentNumber: h.docId || undefined,
  }))
  const last = history[history.length - 1]
  return {
    source: "chestnyznak",
    lastOperation: lastOperationLabel || (last ? statusToOperationLabel(last.status) : "—"),
    lastOperationStatus: last ? mapStatus(last.status) : undefined,
    trackingHistory,
  }
}

function statusToOperationLabel(status: string): string {
  const labels: Record<string, string> = {
    EMITTED: "Эмитирован",
    APPLIED: "Нанесён",
    INTRODUCED: "Введён в оборот",
    DISAGGREGATION: "Расформирован",
    WRITTEN_OFF: "Списан",
    RETIRED: "Выбыл",
    WITHDRAWN: "Выведен из оборота",
  }
  return labels[status] || status
}

/** Ответ Векас getInfo -> IntegratorData для панели «Интегратор» */
export function vekasToIntegratorData(vekas: {
  Value?: {
    Status?: string
    BatchNumber?: string
    IdentificationCode?: string
    ParentCode?: string | null
    ChildrenCodes?: string[]
    StartDate?: string
    FinalizationDate?: string
    ProductionDate?: string
    ExpirationDate?: string
    ProductLineName?: string
    Aggregated?: string
    IsValidated?: boolean
    IsDefected?: boolean
    ProductType?: { Name?: string; ShortName?: string; GTIN?: string; GroupType?: string }
  }
}): IntegratorData {
  const v = vekas?.Value
  const emissionDate = v?.ProductionDate || v?.StartDate || ""
  const aggregationHistory: AggregationEvent[] = []
  if (v?.ProductionDate) {
    aggregationHistory.push({
      date: v.ProductionDate,
      operation: "Производство",
      level: "Продукт",
    })
  }
  if (v?.FinalizationDate) {
    aggregationHistory.push({
      date: v.FinalizationDate,
      operation: "Агрегация",
      level: (v.ParentCode ? "Палета" : "Блок") as GroupType,
      parentCode: v.ParentCode ?? undefined,
    })
  }
  const children = v?.ChildrenCodes ?? []
  return {
    source: "integrator",
    emissionDate: emissionDate || "—",
    applicationDate: v?.StartDate,
    aggregationDate: v?.FinalizationDate,
    aggregationHistory: aggregationHistory.length ? aggregationHistory : [{ date: emissionDate || "—", operation: "Данные из Векас", level: "Продукт" }],
    lineNumber: v?.ProductType?.Name,
    status: v?.Status,
    batchNumber: v?.BatchNumber,
    identificationCode: v?.IdentificationCode,
    parentCode: v?.ParentCode ?? undefined,
    childrenCount: children.length,
    childrenCodes: children.length > 0 ? children : undefined,
    productName: v?.ProductType?.Name ?? v?.ProductType?.ShortName,
    productGtin: v?.ProductType?.GTIN,
    productGroupType: v?.ProductType?.GroupType,
    startDate: v?.StartDate,
    finalizationDate: v?.FinalizationDate,
    productionDate: v?.ProductionDate,
    expirationDate: v?.ExpirationDate,
    productLineName: v?.ProductLineName,
    aggregated: v?.Aggregated,
    isValidated: v?.IsValidated,
    isDefected: v?.IsDefected,
  }
}
