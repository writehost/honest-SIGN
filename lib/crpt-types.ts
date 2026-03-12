/** Лицензия на недра (вода) */
export interface CisLicence {
  licenceNumber?: string
  licenceDate?: string
}

/** Разрешительный документ */
export interface CisCertDoc {
  number?: string
  type?: string
  date?: string
  wellNumber?: string
  indx?: number
  statusGroup?: number
}

/** Ответ cises/info — один элемент массива */
export interface CisInfoItem {
  cisInfo?: {
    requestedCis: string
    cis?: string
    gtin?: string
    status?: string
    statusEx?: string
    productGroup?: string
    productGroupId?: number
    packageType?: string
    generalPackageType?: string
    manufacturerInn?: string
    manufacturerName?: string
    producerInn?: string
    producerName?: string
    ownerInn?: string
    ownerName?: string
    emissionDate?: string
    introducedDate?: string
    applicationDate?: string
    emissionType?: string
    tnVedEaes?: string
    tnVedEaesGroup?: string
    productName?: string
    brand?: string
    producedDate?: string
    expirationDate?: string
    turnoverType?: string
    child?: string[]
    withdrawReason?: string
    withdrawReasonOther?: string
    markWithdraw?: boolean
    isTracking?: boolean
    isMultipleSales?: boolean
    batchNumber?: string
    partyNumber?: string
    manufacturerSerialNumber?: string
    ogvs?: string[]
    licences?: CisLicence[]
    certDoc?: CisCertDoc[]
    partialSaleInfo?: {
      soldUnitCount?: number
      rest?: number
      correctRest?: boolean
      innerUnitCount?: number
    }
  }
}

/** Элемент cises/history */
export interface CisHistoryItem {
  cis: string
  gtin?: string
  packageType?: string
  generalPackageType?: string
  ownerInn?: string
  status: string
  producerInn?: string
  manufacturerInn?: string
  timestamp: string
  operationDate: string
  emissionDate?: string
  docId?: string
  productGroup?: string
  parent?: string
}
