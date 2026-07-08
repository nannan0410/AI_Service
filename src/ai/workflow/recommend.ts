import type { PersonaId, TicketProduct } from '@/types'
import type { ParsedParty } from '@/utils/ticketPartyParser'
import { getEffectiveAdultCount } from '@/utils/ticketPartyParser'
import { matchPartyToProducts } from '@/utils/partyProductMatch'

export interface TicketRecommendation {
  product: TicketProduct
  quantity: { adult: number; child: number }
  originalAmount: number
  recommendTag?: string
}

/** 读取票产品 mock 中的推荐标签；空字符串视为未配置 */
export function getTicketRecommendLabel(product: TicketProduct): string | undefined {
  const label = product.recommendLabel?.trim()
  return label || undefined
}

export function recommendTicketByParty(
  products: TicketProduct[],
  party: ParsedParty,
): TicketRecommendation {
  const match = matchPartyToProducts(products, party)
  if (match.kind !== 'single') {
    const selfProducts = products.filter(
      (item) => item.channels.includes('self') && item.status === 'on',
    )
    const fallback = selfProducts[0]
    if (!fallback) {
      throw new Error('No ticket products available')
    }
    return {
      product: fallback,
      quantity: { adult: getEffectiveAdultCount(party), child: party.child },
      originalAmount: fallback.price,
    }
  }
  return match.recommendation
}

export function buildRecommendReason(recommendation: TicketRecommendation): string | undefined {
  return recommendation.recommendTag
}

/** @deprecated 多轮购票会话请使用 recommendTicketByParty */
export function parseTicketIntent(message: string) {
  if (/两大一小|2大1小|家庭套票|家庭票/.test(message)) return 'family_bundle' as const
  if (/年卡/.test(message)) return 'family_annual' as const
  if (/儿童|小孩/.test(message)) return 'child' as const
  if (/假日|特惠/.test(message)) return 'holiday_special' as const
  return 'family_bundle' as const
}

/** @deprecated */
export function pickTicketProduct(
  products: TicketProduct[],
  message: string,
  _personaId: PersonaId,
): TicketProduct {
  const party: ParsedParty = { adult: 2, child: 1, elderly: 0 }
  if (/两大一小|2大1小/.test(message)) {
    return recommendTicketByParty(products, party).product
  }
  if (/儿童|小孩/.test(message)) {
    return recommendTicketByParty(products, { adult: 1, child: 1, elderly: 0 }).product
  }
  return recommendTicketByParty(products, { adult: 1, child: 0, elderly: 0 }).product
}
