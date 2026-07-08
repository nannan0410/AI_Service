import couponProducts from '@/mock/products/coupon_products.json'
import activities from '@/mock/activities.json'
import { fetchMemberInfo } from '@/api/business'
import { useAuthStore } from '@/store/authStore'
import type { Activity, ChatMessageDraft, Coupon, CouponCardPayload, CouponRecommendPayload, LlmChatResult } from '@/types'
import { NEW_GUEST_COUPON_PRODUCT_ID, canClaimNewGuestCoupon } from '@/utils/newGuestCoupon'

const RECOMMEND_LIMIT = 2

/** 主动营销 / 查券场景下不作为「可领券」推送的产品 */
const PROACTIVE_CLAIM_EXCLUDED_PRODUCT_IDS = new Set([
  'cp_prod_purchase',
  'cp_prod_manual',
])

const VIP_COUPON_PRODUCT_ID = 'cp_prod_vip'

/** 推荐优先级：代金券 > 折扣券 > 停车券 > 其他；同类按 value 降序 */
const COUPON_TYPE_PRIORITY: Record<Coupon['type'], number> = {
  cash: 0,
  discount: 1,
  parking: 2,
  dining: 3,
  retail: 4,
  express: 5,
}

export interface ClaimableCouponContext {
  personaId: string | null
  memberLevel?: string
  coupons: Coupon[]
  registeredAt?: string
}

export function isCouponRecommendPayload(payload: unknown): payload is CouponRecommendPayload {
  return (
    Boolean(payload) &&
    typeof payload === 'object' &&
    Array.isArray((payload as CouponRecommendPayload).items)
  )
}

export function compareCouponsForRecommend(a: Coupon, b: Coupon): number {
  const typeDiff = (COUPON_TYPE_PRIORITY[a.type] ?? 99) - (COUPON_TYPE_PRIORITY[b.type] ?? 99)
  if (typeDiff !== 0) return typeDiff
  return b.value - a.value
}

export function sortCouponsForRecommend(coupons: Coupon[]): Coupon[] {
  return [...coupons].sort(compareCouponsForRecommend)
}

export function pickRecommendedCoupons(coupons: Coupon[], limit = RECOMMEND_LIMIT): Coupon[] {
  return sortCouponsForRecommend(coupons).slice(0, limit)
}

function activityNameById(activityId?: string): string | undefined {
  if (!activityId) return undefined
  return (activities as Activity[]).find((item) => item.activityId === activityId)?.name
}

function couponFromProduct(product: (typeof couponProducts)[number]): Coupon {
  return {
    couponId: `claim_preview_${product.productId}`,
    couponProductId: product.productId,
    title: product.name,
    type: product.couponType as Coupon['type'],
    value: product.value,
    condition: product.condition,
    expireAt: '领取后 30 天内有效',
    status: 'available',
    redeemActivityId: product.redeemActivityId,
    redeemActivityName: activityNameById(product.redeemActivityId),
  }
}

function hasAvailableProductCoupon(coupons: Coupon[], productId: string): boolean {
  return coupons.some(
    (item) => item.couponProductId === productId && item.status === 'available',
  )
}

/** 当前账号可领取、尚未持有的券（演示 Mock 规则） */
export function resolveClaimableCouponPreviews(ctx: ClaimableCouponContext): Coupon[] {
  const previews: Coupon[] = []

  for (const product of couponProducts) {
    if (product.status !== 'on') continue
    if (PROACTIVE_CLAIM_EXCLUDED_PRODUCT_IDS.has(product.productId)) continue
    if (hasAvailableProductCoupon(ctx.coupons, product.productId)) continue

    if (product.productId === NEW_GUEST_COUPON_PRODUCT_ID) {
      if (
        !canClaimNewGuestCoupon({
          personaId: ctx.personaId,
          coupons: ctx.coupons,
          registeredAt: ctx.registeredAt,
        })
      ) {
        continue
      }
    }

    if (product.productId === VIP_COUPON_PRODUCT_ID && ctx.memberLevel !== '黄金会员') {
      continue
    }

    previews.push(couponFromProduct(product))
  }

  return sortCouponsForRecommend(previews)
}

export function buildCouponCardPayload(
  coupon: Coupon,
  action: CouponCardPayload['action'] = 'view',
  claimable = false,
): CouponCardPayload {
  return {
    couponId: coupon.couponId,
    title: coupon.title,
    type: coupon.type,
    value: coupon.value,
    condition: coupon.condition,
    expireAt: coupon.expireAt,
    status: coupon.status,
    action,
    claimable,
    redeemActivityId: coupon.redeemActivityId,
    redeemActivityName: coupon.redeemActivityName,
  }
}

export function buildCouponRecommendChatResult(
  content: string,
  coupons: Coupon[],
  options?: { claimable?: boolean },
): Pick<LlmChatResult, 'content' | 'cards'> {
  const items = pickRecommendedCoupons(coupons).map((coupon) =>
    buildCouponCardPayload(coupon, 'view', options?.claimable === true),
  )

  const payload: CouponRecommendPayload = {
    items,
    action: 'view',
  }

  const card: ChatMessageDraft = {
    type: 'coupon',
    role: 'assistant',
    content,
    payload,
  }

  return {
    content: '',
    cards: [card],
  }
}

/** 多条券 + 文案合并为一条对话消息（单个「点击查看」） */
export function buildMergedCouponMessage(content: string, coupons: Coupon[]): ChatMessageDraft {
  const payload: CouponRecommendPayload = {
    items: coupons.map((coupon) => buildCouponCardPayload(coupon, 'view')),
    action: 'view',
  }
  return {
    type: 'coupon',
    role: 'assistant',
    content,
    payload,
  }
}

export function buildAvailableCouponRecommendResult(
  coupons: Coupon[],
  claimablePreviews: Coupon[],
): Pick<LlmChatResult, 'content' | 'cards'> {
  const available = coupons.filter((item) => item.status === 'available')

  if (available.length > 0) {
    const total = available.length
    const shown = Math.min(total, RECOMMEND_LIMIT)
    const content =
      total > shown
        ? `您账户里共有${total}张可用优惠券，优先为您推荐以下${shown}张：`
        : `已为您找到${total}张可用优惠券：`
    return buildCouponRecommendChatResult(content, available)
  }

  if (claimablePreviews.length > 0) {
    const total = claimablePreviews.length
    const shown = Math.min(total, RECOMMEND_LIMIT)
    const content =
      total > shown
        ? `账户里暂时没有可用优惠券，共有${total}张可领，优先为您推荐以下${shown}张：`
        : `账户里暂时没有可用优惠券，为您推荐以下${total}张可领取的券：`
    return buildCouponRecommendChatResult(content, claimablePreviews, { claimable: true })
  }

  return {
    content:
      '当前账号暂时没有可用或可领取的优惠券。购票、参与园区活动或关注会员权益，常有好礼相送～',
    cards: [],
  }
}

export async function buildCouponQueryRecommendResult(
  coupons: Coupon[],
): Promise<LlmChatResult> {
  const authStore = useAuthStore()
  let memberLevel: string | undefined
  let registeredAt: string | undefined
  try {
    const { data: res } = await fetchMemberInfo()
    if (res.code === 200) {
      memberLevel = res.data.level
      registeredAt = res.data.registeredAt
    }
  } catch {
    // 演示版忽略
  }

  const claimablePreviews = resolveClaimableCouponPreviews({
    personaId: authStore.personaId,
    memberLevel,
    coupons,
    registeredAt,
  })

  return buildAvailableCouponRecommendResult(coupons, claimablePreviews)
}
