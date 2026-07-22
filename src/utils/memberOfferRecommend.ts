import type { Coupon, TicketProduct } from '@/types'
import { pickBestCoupon } from '@/utils/couponDiscount'
import { filterByBusinessScenicId } from '@/utils/scenicScope'
import type { ParsedParty } from '@/utils/ticketPartyParser'

/** 会员等级 → 折后系数（在券抵扣前） */
export const MEMBER_LEVEL_DISCOUNT_RATE: Record<string, number> = {
  黄金会员: 0.95,
}

export interface MemberOfferPick {
  product: TicketProduct
  quantity: { adult: number; child: number }
  /** 目录价合计 */
  listAmount: number
  /** 会员折后合计（券前） */
  memberAmount: number
  memberDiscountAmount: number
  memberRate: number
  coupon?: Coupon
  couponDiscountAmount: number
  /** 最终应付 */
  payAmount: number
  reason: string
}

function scoreProduct(product: TicketProduct, tags: string[]): number {
  let score = 0
  const productTags = product.tags ?? []
  if (tags.includes('family') && productTags.some((t) => /亲子|套票/.test(t))) {
    score += 40
  }
  if (tags.includes('high_value') && productTags.some((t) => /套票|年卡/.test(t))) {
    score += 20
  }
  if (product.recommendLabel) score += 15
  if (product.ticketTypeId === 'family_bundle') score += 25
  if (product.ticketTypeId === 'family_annual') score += 10
  if (product.ticketTypeId === 'adult') score += 5
  return score
}

export function resolveOfferParty(tags: string[]): ParsedParty {
  if (tags.includes('family')) {
    return { adult: 2, child: 1, elderly: 0 }
  }
  return { adult: 2, child: 0, elderly: 0 }
}

export function listAmountForProduct(
  product: TicketProduct,
  party: ParsedParty,
): number {
  if (product.composition) {
    return product.price
  }
  if (product.ticketTypeId === 'adult') {
    return product.price * Math.max(party.adult, 1)
  }
  return product.price
}

export function quantityForProduct(
  product: TicketProduct,
  party: ParsedParty,
): { adult: number; child: number } {
  if (product.composition) {
    return {
      adult: product.composition.adult,
      child: product.composition.child,
    }
  }
  return { adult: Math.max(party.adult, 1), child: party.child }
}

/**
 * 按当前景区 + 标签挑选自营票（优先家庭套票，默认仅 1 个），叠加会员折扣与最优可用券。
 */
export function pickMemberOffers(options: {
  products: TicketProduct[]
  coupons: Coupon[]
  tags: string[]
  memberLevel?: string
  scenicId: string
  limit?: number
}): MemberOfferPick[] {
  const { coupons, tags, memberLevel, scenicId } = options
  const limit = options.limit ?? 1
  const rate = (memberLevel && MEMBER_LEVEL_DISCOUNT_RATE[memberLevel]) || 1
  const party = resolveOfferParty(tags)

  const scoped = filterByBusinessScenicId(options.products, scenicId).filter(
    (p) => p.channels.includes('self') && p.status === 'on',
  )

  const ranked = [...scoped]
    .map((product) => ({ product, score: scoreProduct(product, tags) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)

  const familyBundle = ranked.find((item) => item.product.ticketTypeId === 'family_bundle')
  const selected =
    familyBundle
      ? [familyBundle.product]
      : ranked.length > 0
        ? ranked.slice(0, limit).map((item) => item.product)
        : scoped
            .filter((p) => p.ticketTypeId === 'family_bundle' || p.ticketTypeId === 'adult')
            .slice(0, limit)

  return selected.map((product) => {
    const listAmount = listAmountForProduct(product, party)
    const memberAmount = Math.round(listAmount * rate)
    const memberDiscountAmount = Math.max(listAmount - memberAmount, 0)
    const best = pickBestCoupon(coupons, memberAmount)
    const couponDiscountAmount = best?.discountAmount ?? 0
    const payAmount = Math.max(memberAmount - couponDiscountAmount, 0)

    const tagHint = tags.includes('family')
      ? '亲子标签'
      : tags.includes('high_value')
        ? '高价值标签'
        : '会员画像'
    const levelHint =
      rate < 1 && memberLevel
        ? `${memberLevel}${Math.round(rate * 100)}折`
        : memberLevel || '会员'
    const couponHint = best ? `+${best.coupon.title}` : ''

    return {
      product,
      quantity: quantityForProduct(product, party),
      listAmount,
      memberAmount,
      memberDiscountAmount,
      memberRate: rate,
      coupon: best?.coupon,
      couponDiscountAmount,
      payAmount,
      // 优惠券另起一行，避免卡片标签过长
      reason: `${levelHint} · ${tagHint}${couponHint ? `\n${couponHint}` : ''}`,
    }
  })
}
