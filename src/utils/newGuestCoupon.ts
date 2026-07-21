import couponProducts from '../mock/products/coupon_products.json'
import type { Coupon, PersonaId } from '@/types'

/** 新客专享券产品 ID（与 coupon_products.json 一致） */
export const NEW_GUEST_COUPON_PRODUCT_ID = 'cp_prod_new'

/** 新客专享券展示名称（与券产品 name、发券后 title 一致） */
export const NEW_GUEST_COUPON_TITLE = '新客专享 20 元券'

/** 未配置 claimWindowDays 时的默认领取窗口（天） */
export const DEFAULT_NEW_GUEST_CLAIM_WINDOW_DAYS = 7

/** welcome_templates 中「领新客券」类入口 id，不可领券后应隐藏 */
export const NEW_GUEST_CLAIM_WELCOME_IDS = new Set([
  'new_guest_coupon',
  'claim_new_coupon',
])

export const NEW_GUEST_COUPON_COPY = {
  success: '新客专享券已发放到您的账号。',
  alreadyClaimed: '您已领取过新客券，不能重复领取噢~',
  notEligiblePersona:
    '抱歉，您暂不符合新客专享券的领取条件。\n该优惠仅限新注册会员领取。',
} as const

export function getNewGuestClaimWindowDays(): number {
  const product = couponProducts.find((item) => item.productId === NEW_GUEST_COUPON_PRODUCT_ID)
  const days = (product as { claimWindowDays?: number } | undefined)?.claimWindowDays
  return typeof days === 'number' && days > 0 ? days : DEFAULT_NEW_GUEST_CLAIM_WINDOW_DAYS
}

export function formatClaimWindowExpiredCopy(windowDays = getNewGuestClaimWindowDays()): string {
  return `抱歉，您暂不符合新客专享券的领取条件。\n新客券需在注册后 ${windowDays} 天内领取，您的领取期限已过。`
}

export const COUPON_STATUS_LABEL: Record<Coupon['status'], string> = {
  available: '可使用',
  used: '已使用',
  expired: '已过期',
}

/** 是否为「领取新客券」类意图（非购票顺带发券） */
export function isNewGuestCouponClaimIntent(message: string): boolean {
  if (/两大一小|2大1小|买票|购票|套票|家庭票|年卡/.test(message)) return false
  if (/(?:买|购|订).{0,6}门票|门票.{0,6}(?:买|购|订)/.test(message)) return false
  return (
    /领取|领券|领新.?券|新客券|新人券|怎么领/.test(message) ||
    (/新客|新人/.test(message) && /券|优惠券/.test(message))
  )
}

export function findNewGuestCoupon(coupons: Coupon[]): Coupon | undefined {
  return coupons.find(
    (item) =>
      item.couponProductId === NEW_GUEST_COUPON_PRODUCT_ID || item.title === NEW_GUEST_COUPON_TITLE,
  )
}

export function hasNewGuestCoupon(coupons: Coupon[]): boolean {
  const coupon = findNewGuestCoupon(coupons)
  return coupon?.status === 'available'
}

export function isWithinNewGuestClaimWindow(
  registeredAt?: string,
  now = Date.now(),
  windowDays = getNewGuestClaimWindowDays(),
): boolean {
  if (!registeredAt) return true
  const registeredMs = new Date(registeredAt).getTime()
  if (Number.isNaN(registeredMs)) return true
  const windowMs = windowDays * 24 * 60 * 60 * 1000
  return now - registeredMs <= windowMs
}

/** 演示用：将 demo_new 注册时间设为「昨天」，避免固定日期过期 */
export function buildDemoNewRegisteredAt(now = Date.now()): string {
  return new Date(now - 24 * 60 * 60 * 1000).toISOString()
}

export function canClaimNewGuestCoupon(ctx: {
  personaId: PersonaId | string | null
  coupons: Coupon[]
  registeredAt?: string
}): boolean {
  if (ctx.personaId !== 'demo_new') return false
  if (findNewGuestCoupon(ctx.coupons)) return false
  return isWithinNewGuestClaimWindow(ctx.registeredAt)
}

export function filterNewGuestClaimWelcomeItems<T extends { id: string }>(
  items: T[],
  ctx: {
    personaId: PersonaId | string | null
    coupons: Coupon[]
    registeredAt?: string
  },
): T[] {
  if (canClaimNewGuestCoupon(ctx)) return items
  return items.filter((item) => !NEW_GUEST_CLAIM_WELCOME_IDS.has(item.id))
}
