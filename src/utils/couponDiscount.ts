import type { Coupon } from '@/types'

/** 计算单张券对订单金额的抵扣（与 mock/_utils calcDiscount 规则一致） */
export function calcCouponDiscount(orderAmount: number, coupon?: Coupon): number {
  if (!coupon || coupon.status !== 'available') return 0
  if (coupon.type === 'cash') {
    if (coupon.condition?.includes('200') && orderAmount < 200) return 0
    return Math.min(coupon.value, orderAmount)
  }
  if (coupon.type === 'dining') {
    if (coupon.condition?.includes('100') && orderAmount < 100) return 0
    return Math.min(coupon.value, orderAmount)
  }
  return 0
}

export function pickBestCoupon(
  coupons: Coupon[],
  orderAmount: number,
): { coupon: Coupon; discountAmount: number } | null {
  let best: { coupon: Coupon; discountAmount: number } | null = null
  for (const coupon of coupons) {
    if (coupon.status !== 'available') continue
    const discountAmount = calcCouponDiscount(orderAmount, coupon)
    if (discountAmount <= 0) continue
    if (!best || discountAmount > best.discountAmount) {
      best = { coupon, discountAmount }
    }
  }
  return best
}
