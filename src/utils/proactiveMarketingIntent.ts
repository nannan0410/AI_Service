import { shouldRunNewGuestCouponWorkflow } from '@/ai/workflow/newGuestCoupon'

/** 泛推券/活动推荐 → proactive_marketing（不含新客领券 Workflow） */
export function shouldRunProactiveMarketingWorkflow(message: string): boolean {
  const text = message.trim()
  if (!text || shouldRunNewGuestCouponWorkflow(text)) return false

  if (/领新客|领取新客|新客券|首次领券/.test(text)) return false
  if (/买票|购票|门票|套票|两大一小|2大1小/.test(text)) return false

  return (
    /有什么券|有哪些券|可用券|优惠券推荐|推荐.*券/.test(text) ||
    /有什么活动|优惠活动|推荐优惠|附近.*优惠|会员.*优惠/.test(text) ||
    /^优惠$|^活动$/.test(text)
  )
}
