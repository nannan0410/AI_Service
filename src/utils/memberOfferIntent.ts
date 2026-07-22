import { isTicketPurchaseIntent } from '@/utils/ticketPurchaseIntent'
import { shouldRunNewGuestCouponWorkflow } from '@/ai/workflow/newGuestCoupon'

/**
 * 等级+折扣+券+标签商品组合推荐（会员权益选品）。
 * 与「查券 / 购票槽位」区分：强调按身份匹配套餐，而非单纯列券或已报人数买票。
 */
export function shouldRunMemberOfferWorkflow(message: string): boolean {
  const text = message.trim()
  if (!text) return false
  if (shouldRunNewGuestCouponWorkflow(text)) return false
  // 已明确人数购票 → 走 ticket_purchase
  if (isTicketPurchaseIntent(text) && /两大一小|2大1小|\d\s*大/.test(text)) {
    return false
  }
  // 纯查券（无「套餐/推荐/划算/等级」等选品词）交给 proactive_marketing
  if (
    /^(有什么券|有哪些券|可用券|查券|我的券|优惠券)$/.test(text) ||
    (/有什么券|查券|我的券/.test(text) && !/套餐|划算|推荐|等级|专属|组合/.test(text))
  ) {
    return false
  }

  return (
    /会员专属(?:推荐|套餐|优惠)?|会员(?:套餐|组合)|黄金会员(?:推荐|专享|套餐)?/.test(text) ||
    /适合我的(?:优惠)?套餐|按(?:我的)?会员等级|等级(?:\+|加)?折扣|会员怎么买最划算/.test(
      text,
    ) ||
    /专属门票推荐|权益选品|标签商品|会员权益推荐/.test(text) ||
    /请按我的会员等级和优惠|推荐适合我的门票组合|会员专属怎么买最划算/.test(text)
  )
}
