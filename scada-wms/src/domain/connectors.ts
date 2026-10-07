// Marketplace integration seam. The MVP works without any connector:
// orders come from manual entry and CSV. A connector only translates a
// marketplace API into the same OrderInput / stock numbers the services use,
// so adding Ozon later touches no warehouse logic.

import type { Channel, ID } from './types'
import type { OrderInput } from './services'

export interface ExternalOrder {
  externalId: string
  number: string
  customer: string
  createdAt: string
  /** marketplace SKU / offer id → qty; mapped via Product.marketplace */
  lines: { offerId: string; qty: number }[]
}

export interface MarketplaceConnector {
  readonly channel: Exclude<Channel, 'manual' | 'site'>
  readonly title: string
  /** Validate credentials the seller pasted in settings. */
  testConnection(credentials: Record<string, string>): Promise<{ ok: boolean; message: string }>
  /** New FBS orders since the cursor. Called by a periodic job on the backend. */
  fetchOrders(since: string): Promise<ExternalOrder[]>
  /** Push available stock so the marketplace does not oversell. */
  pushStock(items: { offerId: string; available: number }[]): Promise<void>
  /** Tell the marketplace the parcel is assembled (Later: labels, supplies). */
  markPacked(externalId: string): Promise<void>
}

/** Turns marketplace lines into an order for createOrder(); unknown offers are reported, not guessed. */
export function toOrderInput(
  channel: MarketplaceConnector['channel'],
  ext: ExternalOrder,
  offerToProduct: (offerId: string) => ID | undefined,
): { input: OrderInput; unknown: string[] } {
  const unknown: string[] = []
  const items = ext.lines.flatMap((l) => {
    const productId = offerToProduct(l.offerId)
    if (!productId) { unknown.push(l.offerId); return [] }
    return [{ productId, qty: l.qty }]
  })
  return { input: { channel, number: ext.number, customer: ext.customer, externalId: ext.externalId, items }, unknown }
}

export const CONNECTORS: { channel: MarketplaceConnector['channel']; title: string; scheme: string; status: 'planned' }[] = [
  { channel: 'wb', title: 'Wildberries', scheme: 'FBS: сборочные задания, остатки, поставки', status: 'planned' },
  { channel: 'ozon', title: 'Ozon', scheme: 'FBS: отправления, остатки, этикетки', status: 'planned' },
  { channel: 'ym', title: 'Яндекс Маркет', scheme: 'FBS/DBS: заказы, остатки', status: 'planned' },
]
