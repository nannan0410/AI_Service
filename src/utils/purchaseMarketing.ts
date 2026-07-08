import type { Coupon } from '@/types'
import { findNewGuestCoupon } from '@/utils/newGuestCoupon'

export const PURCHASE_MARKETING_COUPON_PRODUCT_ID = 'cp_prod_purchase'
export const PURCHASE_MARKETING_COUPON_TITLE = '购票10元券'

/** 无可用新客券时推送购票营销券（老用户优先） */
export function shouldPushPurchaseMarketingCoupon(coupons: Coupon[]): boolean {
  const newGuest = findNewGuestCoupon(coupons)
  if (!newGuest) return true
  return newGuest.status !== 'available'
}
