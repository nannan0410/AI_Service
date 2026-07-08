import type { TicketCardPayload, TicketTypeId } from '@/types'

export interface PurchaseDisplayFields {
  ticketType: TicketTypeId
  quantity: { adult: number; child: number }
  unitPrice?: number
  purchaseCount?: number
  purchaseUnit?: '张' | '套'
  originalAmount?: number
  totalAmount: number
  discountAmount?: number
}

export function resolvePurchaseUnit(payload: PurchaseDisplayFields): {
  unitPrice: number
  purchaseCount: number
  purchaseUnit: '张' | '套'
} {
  const purchaseUnit = payload.purchaseUnit ?? (payload.ticketType === 'adult' ? '张' : '套')
  const purchaseCount =
    payload.purchaseCount ??
    (payload.ticketType === 'adult' ? Math.max(payload.quantity.adult, 1) : 1)
  const unitPrice =
    payload.unitPrice ??
    (payload.originalAmount != null && purchaseCount > 0
      ? Math.round(payload.originalAmount / purchaseCount)
      : payload.totalAmount)

  return { unitPrice, purchaseCount, purchaseUnit }
}

export function payableAmount(payload: PurchaseDisplayFields): number {
  return payload.originalAmount ?? payload.totalAmount + (payload.discountAmount ?? 0)
}

export function preferentialAmount(payload: PurchaseDisplayFields): number {
  if (payload.discountAmount && payload.originalAmount != null) {
    return Math.max(payload.originalAmount - payload.discountAmount, 0)
  }
  return payload.totalAmount
}

/** @deprecated 使用 PurchaseDisplayFields */
export type { TicketCardPayload }
