export type CodeStatus = "В обороте" | "Выведен" | "Выбыл" | "Списан" | "Нанесён" | "Эмитирован" | "Агрегирован" | "Расформирован" | "Пустая упаковка"

export type GroupType = "Продукт" | "Блок" | "Палета"

export type DataSource = "chestnyznak" | "integrator"

export interface CodeEntry {
  id: string
  code: string
  gtin: string
  serial: string
  status: CodeStatus
  owner: string
  ownerInn: string
  nomenclature: string
  groupType: GroupType
  parentCode?: string
  children?: string[]
  productionDate: string
  expirationDate?: string
  batch?: string
  tnVed?: string
  productGroup: string
  /** Причина вывода из оборота (при статусе Выведен) */
  withdrawReason?: string
  /** Признак выбытия от не владельца */
  markWithdraw?: boolean
  /** Доп. поля из API cisInfo */
  applicationDate?: string
  introducedDate?: string
  productName?: string
  brand?: string
  producedDate?: string
  emissionDate?: string
  emissionType?: string
  turnoverType?: string
  producerInn?: string
  producerName?: string
  manufacturerInn?: string
  manufacturerName?: string
  isTracking?: boolean
  isMultipleSales?: boolean
  batchNumber?: string
  partyNumber?: string
  manufacturerSerialNumber?: string
  withdrawReasonOther?: string
  ogvs?: string[]
  licences?: { licenceNumber?: string; licenceDate?: string }[]
  certDoc?: { number?: string; type?: string; date?: string; wellNumber?: string }[]
  partialSaleInfo?: { soldUnitCount?: number; rest?: number; correctRest?: boolean; innerUnitCount?: number }
  tnVedEaesGroup?: string
}

export interface ChestnyZnakData {
  source: "chestnyznak"
  updNumber?: string
  updDate?: string
  trackingHistory: TrackingEvent[]
  lastOperation: string
  /** Статус последней операции для цветного бейджа */
  lastOperationStatus?: CodeStatus
  certificate?: string
}

export interface IntegratorData {
  source: "integrator"
  emissionDate: string
  applicationDate?: string
  aggregationDate?: string
  aggregationHistory: AggregationEvent[]
  lineNumber?: string
  shiftNumber?: string
  /** Доп. поля из Векас getInfo */
  status?: string
  batchNumber?: string
  identificationCode?: string
  parentCode?: string | null
  childrenCount?: number
  childrenCodes?: string[]
  productName?: string
  productGtin?: string
  productGroupType?: string
  startDate?: string
  finalizationDate?: string
  productionDate?: string
  expirationDate?: string
  productLineName?: string
  aggregated?: string
  isValidated?: boolean
  isDefected?: boolean
}

export interface TrackingEvent {
  date: string
  operation: string
  participant: string
  participantInn: string
  documentType?: string
  documentNumber?: string
}

export interface AggregationEvent {
  date: string
  operation: string
  level: GroupType
  parentCode?: string
  operator?: string
}

// Тестовые данные

const mockProducts: CodeEntry[] = [
  {
    id: "1",
    code: "010460043993125621JgXJ!93dGVz",
    gtin: "04600439931256",
    serial: "JgXJ!93dGVz",
    status: "В обороте",
    owner: 'ООО "Фарма-Трейд"',
    ownerInn: "7707049388",
    nomenclature: "Парацетамол 500мг таб. N20",
    groupType: "Продукт",
    parentCode: "BLK-001-2024",
    productionDate: "2024-08-15",
    expirationDate: "2026-08-15",
    batch: "B2024-1587",
    tnVed: "3004909000",
    productGroup: "Лекарственные препараты",
  },
  {
    id: "2",
    code: "010460043993125621AbCd!45eFgH",
    gtin: "04600439931256",
    serial: "AbCd!45eFgH",
    status: "В обороте",
    owner: 'ООО "Фарма-Трейд"',
    ownerInn: "7707049388",
    nomenclature: "Парацетамол 500мг таб. N20",
    groupType: "Продукт",
    parentCode: "BLK-001-2024",
    productionDate: "2024-08-15",
    expirationDate: "2026-08-15",
    batch: "B2024-1587",
    tnVed: "3004909000",
    productGroup: "Лекарственные препараты",
  },
  {
    id: "3",
    code: "010460043993125621KlMn!78oPqR",
    gtin: "04600439931256",
    serial: "KlMn!78oPqR",
    status: "Выведен",
    owner: 'АО "Медикал Групп"',
    ownerInn: "7725624397",
    nomenclature: "Ибупрофен 400мг таб. N30",
    groupType: "Продукт",
    parentCode: "BLK-002-2024",
    productionDate: "2024-06-20",
    expirationDate: "2026-06-20",
    batch: "B2024-0923",
    tnVed: "3004909000",
    productGroup: "Лекарственные препараты",
  },
  {
    id: "4",
    code: "010460076543210021XyZw!12aBcD",
    gtin: "04600765432100",
    serial: "XyZw!12aBcD",
    status: "Нанесён",
    owner: 'ООО "МолокоПром"',
    ownerInn: "5024163825",
    nomenclature: "Молоко 3.2% 1л",
    groupType: "Продукт",
    parentCode: "BLK-003-2024",
    productionDate: "2024-11-01",
    expirationDate: "2024-11-15",
    batch: "M2024-4401",
    tnVed: "0401200000",
    productGroup: "Молочная продукция",
  },
]

const mockBlocks: CodeEntry[] = [
  {
    id: "blk-1",
    code: "BLK-001-2024",
    gtin: "04600439931256",
    serial: "BLK-001",
    status: "Агрегирован",
    owner: 'ООО "Фарма-Трейд"',
    ownerInn: "7707049388",
    nomenclature: "Парацетамол 500мг таб. N20",
    groupType: "Блок",
    parentCode: "PAL-001-2024",
    children: ["010460043993125621JgXJ!93dGVz", "010460043993125621AbCd!45eFgH"],
    productionDate: "2024-08-15",
    batch: "B2024-1587",
    productGroup: "Лекарственные препараты",
  },
  {
    id: "blk-2",
    code: "BLK-002-2024",
    gtin: "04600439931256",
    serial: "BLK-002",
    status: "Агрегирован",
    owner: 'АО "Медикал Групп"',
    ownerInn: "7725624397",
    nomenclature: "Ибупрофен 400мг таб. N30",
    groupType: "Блок",
    parentCode: "PAL-001-2024",
    children: ["010460043993125621KlMn!78oPqR"],
    productionDate: "2024-06-20",
    batch: "B2024-0923",
    productGroup: "Лекарственные препараты",
  },
  {
    id: "blk-3",
    code: "BLK-003-2024",
    gtin: "04600765432100",
    serial: "BLK-003",
    status: "Агрегирован",
    owner: 'ООО "МолокоПром"',
    ownerInn: "5024163825",
    nomenclature: "Молоко 3.2% 1л",
    groupType: "Блок",
    parentCode: "PAL-002-2024",
    children: ["010460076543210021XyZw!12aBcD"],
    productionDate: "2024-11-01",
    batch: "M2024-4401",
    productGroup: "Молочная продукция",
  },
]

const mockPalettes: CodeEntry[] = [
  {
    id: "pal-1",
    code: "PAL-001-2024",
    gtin: "04600439931256",
    serial: "PAL-001",
    status: "Агрегирован",
    owner: 'ООО "Фарма-Трейд"',
    ownerInn: "7707049388",
    nomenclature: "Фармацевтическая продукция (смешанная)",
    groupType: "Палета",
    children: ["BLK-001-2024", "BLK-002-2024"],
    productionDate: "2024-08-15",
    productGroup: "Лекарственные препараты",
  },
  {
    id: "pal-2",
    code: "PAL-002-2024",
    gtin: "04600765432100",
    serial: "PAL-002",
    status: "Агрегирован",
    owner: 'ООО "МолокоПром"',
    ownerInn: "5024163825",
    nomenclature: "Молочная продукция (смешанная)",
    groupType: "Палета",
    children: ["BLK-003-2024"],
    productionDate: "2024-11-01",
    productGroup: "Молочная продукция",
  },
]

export const allCodes = [...mockProducts, ...mockBlocks, ...mockPalettes]

const mockChestnyZnakData: Record<string, ChestnyZnakData> = {
  "010460043993125621JgXJ!93dGVz": {
    source: "chestnyznak",
    updNumber: "УПД-2024/08/1547",
    updDate: "2024-09-10",
    certificate: "RU Д-RU.НВ07.В.03012/22",
    lastOperation: "Приёмка товара",
    trackingHistory: [
      {
        date: "2024-08-15",
        operation: "Производство",
        participant: 'ООО "ФармаЗавод"',
        participantInn: "5038012345",
      },
      {
        date: "2024-08-20",
        operation: "Отгрузка со склада производителя",
        participant: 'ООО "ФармаЗавод"',
        participantInn: "5038012345",
        documentType: "УПД",
        documentNumber: "УПД-2024/08/1547",
      },
      {
        date: "2024-09-01",
        operation: "Приёмка на склад дистрибьютора",
        participant: 'ООО "Фарма-Дист"',
        participantInn: "7712345678",
        documentType: "УПД",
        documentNumber: "УПД-2024/09/0234",
      },
      {
        date: "2024-09-10",
        operation: "Отгрузка в аптеку",
        participant: 'ООО "Фарма-Дист"',
        participantInn: "7712345678",
        documentType: "УПД",
        documentNumber: "УПД-2024/09/0891",
      },
      {
        date: "2024-09-15",
        operation: "Приёмка товара",
        participant: 'ООО "Фарма-Трейд"',
        participantInn: "7707049388",
        documentType: "УПД",
        documentNumber: "УПД-2024/09/1102",
      },
    ],
  },
  "010460043993125621KlMn!78oPqR": {
    source: "chestnyznak",
    updNumber: "УПД-2024/07/0812",
    updDate: "2024-07-15",
    lastOperation: "Розничная продажа",
    trackingHistory: [
      {
        date: "2024-06-20",
        operation: "Производство",
        participant: 'ООО "ФармаЗавод"',
        participantInn: "5038012345",
      },
      {
        date: "2024-07-01",
        operation: "Отгрузка",
        participant: 'ООО "ФармаЗавод"',
        participantInn: "5038012345",
        documentType: "УПД",
        documentNumber: "УПД-2024/07/0812",
      },
      {
        date: "2024-07-15",
        operation: "Розничная продажа",
        participant: 'АО "Медикал Групп"',
        participantInn: "7725624397",
        documentType: "Чек ККТ",
        documentNumber: "ФД-0004521788",
      },
    ],
  },
}

const mockIntegratorData: Record<string, IntegratorData> = {
  "010460043993125621JgXJ!93dGVz": {
    source: "integrator",
    emissionDate: "2024-08-10",
    applicationDate: "2024-08-14",
    aggregationDate: "2024-08-15",
    lineNumber: "Линия 3",
    shiftNumber: "Смена 2",
    aggregationHistory: [
      {
        date: "2024-08-10",
        operation: "Эмиссия кода",
        level: "Продукт",
      },
      {
        date: "2024-08-14",
        operation: "Нанесение на упаковку",
        level: "Продукт",
      },
      {
        date: "2024-08-15",
        operation: "Вложение в блок",
        level: "Блок",
        parentCode: "BLK-001-2024",
        operator: "Иванов А.С.",
      },
      {
        date: "2024-08-15",
        operation: "Вложение блока в палету",
        level: "Палета",
        parentCode: "PAL-001-2024",
        operator: "Петров Д.В.",
      },
    ],
  },
  "010460043993125621KlMn!78oPqR": {
    source: "integrator",
    emissionDate: "2024-06-15",
    applicationDate: "2024-06-19",
    aggregationDate: "2024-06-20",
    lineNumber: "Линия 1",
    shiftNumber: "Смена 1",
    aggregationHistory: [
      {
        date: "2024-06-15",
        operation: "Эмиссия кода",
        level: "Продукт",
      },
      {
        date: "2024-06-19",
        operation: "Нанесение на упаковку",
        level: "Продукт",
      },
      {
        date: "2024-06-20",
        operation: "Вложение в блок",
        level: "Блок",
        parentCode: "BLK-002-2024",
        operator: "Сидоров К.Н.",
      },
    ],
  },
  "010460076543210021XyZw!12aBcD": {
    source: "integrator",
    emissionDate: "2024-10-28",
    applicationDate: "2024-10-31",
    aggregationDate: "2024-11-01",
    lineNumber: "Линия 5",
    shiftNumber: "Смена 3",
    aggregationHistory: [
      {
        date: "2024-10-28",
        operation: "Эмиссия кода",
        level: "Продукт",
      },
      {
        date: "2024-10-31",
        operation: "Нанесение на упаковку",
        level: "Продукт",
      },
      {
        date: "2024-11-01",
        operation: "Вложение в блок",
        level: "Блок",
        parentCode: "BLK-003-2024",
        operator: "Козлова М.А.",
      },
    ],
  },
}

export function searchCode(query: string): CodeEntry | undefined {
  const trimmed = query.trim()
  return allCodes.find(
    (c) =>
      c.code === trimmed ||
      c.code.toLowerCase().includes(trimmed.toLowerCase()) ||
      c.serial.toLowerCase().includes(trimmed.toLowerCase()) ||
      c.gtin.includes(trimmed)
  )
}

export function getChestnyZnakData(code: string): ChestnyZnakData | undefined {
  return mockChestnyZnakData[code]
}

export function getIntegratorData(code: string): IntegratorData | undefined {
  return mockIntegratorData[code]
}

export function getChildCodes(parentCode: string): CodeEntry[] {
  return allCodes.filter((c) => c.parentCode === parentCode)
}

export function getParentCode(code: string): CodeEntry | undefined {
  const entry = allCodes.find((c) => c.code === code)
  if (!entry?.parentCode) return undefined
  return allCodes.find((c) => c.code === entry.parentCode)
}

export function getRecentCodes(): CodeEntry[] {
  return allCodes.slice(0, 6)
}
