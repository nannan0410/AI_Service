import type { Coupon } from '@/types'
import { findNewGuestCoupon } from '@/utils/newGuestCoupon'
import type { ParsedParty } from '@/utils/ticketPartyParser'

export const PURCHASE_MARKETING_COUPON_PRODUCT_ID = 'cp_prod_purchase'
export const PURCHASE_MARKETING_COUPON_TITLE = '购票10元券'

/** 无可用新客券时推送购票营销券（老用户优先） */
export function shouldPushPurchaseMarketingCoupon(coupons: Coupon[]): boolean {
  const newGuest = findNewGuestCoupon(coupons)
  if (!newGuest) return true
  return newGuest.status !== 'available'
}

/**
 * 购票营销券推送门槛：已拿到出行人数或游玩日期（任一即可）；
 * 仅「我想买票」等入口追问、尚未填槽时不发券。
 */
export function hasPurchaseMarketingSlot(input: {
  party?: ParsedParty | null
  visitDate?: string | null
}): boolean {
  if (input.visitDate?.trim()) return true
  const party = input.party
  if (!party) return false
  return party.adult > 0 || party.child > 0 || party.elderly > 0
}
