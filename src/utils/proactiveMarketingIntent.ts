import { shouldRunNewGuestCouponWorkflow } from '@/ai/workflow/newGuestCoupon'

export type ProactiveMarketingScene =
  | 'coupon_query'
  | 'dining'
  | 'retail'
  | 'order_intent_dining'
  | 'order_intent_retail'

/** 餐饮 / 美食询问 */
export function isDiningRecommendIntent(message: string): boolean {
  const text = message.trim()
  if (!text) return false
  return /美食|餐饮|好吃|餐厅|午饭|晚饭|午餐|晚餐|吃什么|觅食|小吃|套餐|点餐|吃饭/.test(
    text,
  )
}

/** 零售 / 伴手礼 / 商品询问 */
export function isRetailRecommendIntent(message: string): boolean {
  const text = message.trim()
  if (!text) return false
  return /伴手礼|纪念品|零售|商店|店铺|商品|礼品店|玩具屋|买点什么|周边|文创|购物/.test(
    text,
  )
}

/** 明确下单/购买意图（非门票） */
export function isNonTicketOrderIntent(message: string): boolean {
  const text = message.trim()
  if (!text) return false
  if (/买票|购票|门票|套票|两大一小|2大1小/.test(text)) return false
  return /想买|要买|下单|购买|点一份|来一份|帮我买|现在买|马上买|下单买/.test(text)
}

export function resolveProactiveMarketingScene(
  message: string,
): ProactiveMarketingScene | null {
  const text = message.trim()
  if (!text || shouldRunNewGuestCouponWorkflow(text)) return null
  if (/领新客|领取新客|新客券|首次领券/.test(text)) return null
  if (/点评|评价|满意度/.test(text)) return null

  const dining = isDiningRecommendIntent(text)
  const retail = isRetailRecommendIntent(text)
  const order = isNonTicketOrderIntent(text)

  if (order && dining && !retail) return 'order_intent_dining'
  if (order && retail && !dining) return 'order_intent_retail'
  if (order && (dining || retail)) {
    return dining ? 'order_intent_dining' : 'order_intent_retail'
  }
  if (order && !dining && !retail) {
    // 「想买这个」「帮我下单」等泛化下单：默认带出餐饮+零售可领券场景里优先餐饮
    if (/纪念品|伴手礼|商品|玩具|礼品/.test(text)) return 'order_intent_retail'
    if (/吃|餐|美食|饭/.test(text)) return 'order_intent_dining'
  }

  if (dining && !retail) return 'dining'
  if (retail && !dining) return 'retail'
  if (dining && retail) return 'dining'

  if (/买票|购票|门票|套票|两大一小|2大1小/.test(text)) return null
  // 会员权益选品交给 member_offer
  if (
    /会员专属|适合我的套餐|按会员等级|会员怎么买最划算|黄金会员推荐|专属门票推荐|会员权益推荐|推荐适合我的门票组合/.test(
      text,
    )
  ) {
    return null
  }

  if (
    /有什么券|有哪些券|可用券|优惠券|会员券|专属券|查券|我的券/.test(text) ||
    /优惠券推荐|推荐.*券|查看.*券|可用的.*券/.test(text) ||
    /有什么活动|优惠活动|推荐优惠|附近.*优惠|会员.*优惠|有什么优惠|附近优惠/.test(text) ||
    /餐饮.*优惠|二消.*优惠|项目优惠|会员权益/.test(text) ||
    /^优惠$|^活动$|^查券$|^优惠券$/.test(text)
  ) {
    return 'coupon_query'
  }

  // 泛化下单意图且未命中餐饮/零售关键词：仍走营销推券（展示可领券）
  if (order) return 'coupon_query'

  return null
}

/** 泛推券 / 餐饮零售推荐 / 下单意图顺势推券 → proactive_marketing */
export function shouldRunProactiveMarketingWorkflow(message: string): boolean {
  return resolveProactiveMarketingScene(message) != null
}
