import type { Coupon } from '@/types'

export const FALLBACK_PURCHASE_COUPON_PRODUCT_ID = 'cp_prod_manual'
export const FALLBACK_PURCHASE_COUPON_TITLE = '购票优享 5 元券'

export function isFallbackPurchaseCoupon(coupon: Coupon): boolean {
  if (coupon.couponProductId) {
    return coupon.couponProductId === FALLBACK_PURCHASE_COUPON_PRODUCT_ID
  }
  return coupon.title === FALLBACK_PURCHASE_COUPON_TITLE
}

export function findFallbackPurchaseCoupon(coupons: Coupon[]): Coupon | undefined {
  return coupons.find(
    (item) => item.status === 'available' && isFallbackPurchaseCoupon(item),
  )
}

export function hasFallbackPurchaseCoupon(coupons: Coupon[]): boolean {
  return Boolean(findFallbackPurchaseCoupon(coupons))
}

/** 无法闭环购票场景：账号尚无可用专用券时才新发 */
export function shouldPushFallbackPurchaseCoupon(coupons: Coupon[]): boolean {
  return !hasFallbackPurchaseCoupon(coupons)
}
