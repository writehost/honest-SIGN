import type { PlanCode } from './types'

export interface Plan {
  code: PlanCode
  name: string
  priceRub: number
  warehouses: number
  users: number
  products: number
  /** Movements kept visible in the journal, days */
  historyDays: number
  marketplaces: boolean
  api: boolean
}

// Billing itself is Later; limits are enforced by the services already.
export const PLANS: Record<PlanCode, Plan> = {
  start: { code: 'start', name: 'Start', priceRub: 990, warehouses: 1, users: 2, products: 500, historyDays: 30, marketplaces: false, api: false },
  seller: { code: 'seller', name: 'Seller', priceRub: 2490, warehouses: 1, users: 6, products: 5000, historyDays: 365, marketplaces: true, api: false },
  pro: { code: 'pro', name: 'Pro', priceRub: 5990, warehouses: 5, users: 25, products: 50000, historyDays: 1095, marketplaces: true, api: true },
}
