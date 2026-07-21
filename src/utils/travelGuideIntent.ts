import { isParkingLocationIntent, isParkingPayIntent } from '@/utils/parkingPayIntent'

/** 完整出行攻略（交通 + 入园 + 推荐项目）— 需明确出行/订单语境 */
export function isFullTravelGuideIntent(message: string): boolean {
  return (
    /出行攻略|出游计划|近期出游|订单攻略|查看近期出游计划|完整出行|全套攻略/.test(
      message,
    ) ||
    /按订单.{0,12}攻略|待出行.{0,8}攻略|订单.{0,8}(?:做|生成|整理).{0,6}攻略/.test(
      message,
    ) ||
    /最近.{0,12}待出行.{0,16}攻略/.test(message) ||
    /当天游玩.{0,6}攻略|轻松游玩攻略|新客攻略/.test(message) ||
    /(?:做|整理|规划).{0,10}(?:出行|出游|当天).{0,6}攻略/.test(message)
  )
}

/** 单篇「交通指南」— 对齐 welcome / RecommendEntry 提示语 */
export function isTrafficGuideIntent(message: string): boolean {
  if (isFullTravelGuideIntent(message)) return false
  return (
    /交通指南|怎么去(?:景区|欢乐景区)?|怎么到(?:景区|欢乐景区)?|怎么去最方便|当天怎么去/.test(
      message,
    ) ||
    /停车位置|停车场(?!费)|在哪停|哪里停|停车在哪|交通路线|入园路线|出行交通|怎么去.*交通|交通.*停车|怎么去/.test(
      message,
    ) ||
    isParkingLocationIntent(message)
  )
}

/** 单篇「入园提醒」— 对齐 welcome 快捷按钮与猜你想问 */
export function isEntryNoticeIntent(message: string): boolean {
  if (isFullTravelGuideIntent(message)) return false
  if (isTrafficGuideIntent(message)) return false
  return (
    /入园须知|入园提醒|入园事项/.test(message) ||
    /入园前(?:要|需要)?(?:准备)?|入园当天|要带什么|几点到|几点到更合适/.test(message) ||
    /提醒我入园|入园前.*准备|入园前需要准备/.test(message) ||
    // welcome「门票如何使用」
    /门票怎么用|门票如何使用|门票.*(?:怎么|如何)使用|怎么使用门票|如何使用门票/.test(
      message,
    ) ||
    /几点可以入园|几点入园|何时入园|什么时候可以入园|入园几点/.test(message)
  )
}

/**
 * 园内路线推荐 — 游客在景区内，根据位置与排队推荐今日路线；不含交通指南与入园提醒
 */
export function isInParkRouteIntent(message: string): boolean {
  if (isFullTravelGuideIntent(message)) return false
  if (isTrafficGuideIntent(message)) return false
  if (isEntryNoticeIntent(message)) return false

  const inParkCue =
    /在园区内|在园里|在景区里|在园内|园内游玩|在园状态|我现在在园/.test(message)
  const routeCue =
    /今日路线|今日游玩路线|现在先玩|根据当前位置|排队情况|安排今日游玩|游玩路线|先玩哪里|马上玩的项目|排队时间较短/.test(
      message,
    )

  return (
    (inParkCue && routeCue) ||
    /现在先玩哪里|根据当前位置和排队情况推荐今日路线|根据我在园状态安排今日游玩路线/.test(
      message,
    )
  )
}

/**
 * 游玩攻略 / 项目推荐 — 日程建议 + 推荐项目，不含交通与入园
 */
export function isRecommendTravelGuideIntent(message: string): boolean {
  if (isFullTravelGuideIntent(message)) return false
  if (isTrafficGuideIntent(message)) return false
  if (isEntryNoticeIntent(message)) return false
  if (isInParkRouteIntent(message)) return false

  return (
    /游玩攻略|景区攻略|玩什么|推荐项目|景点推荐|怎么玩|一天怎么玩|规划路线|游玩路线|帮我规划|热门线路/.test(
      message,
    ) ||
    /游玩项目|适合今天.*(?:游玩|路线)|推荐.*(?:游玩项目|路线)/.test(message) ||
    /(?:做|生成|整理).{0,10}游玩攻略/.test(message) ||
    /不需要交通|不含交通|不要交通|不需要入园/.test(message)
  )
}

export type TravelGuideIntentKind =
  | 'full'
  | 'traffic'
  | 'entry_notice'
  | 'in_park'
  | 'recommend'

export function resolveTravelGuideIntent(message: string): TravelGuideIntentKind | null {
  if (!shouldRunTravelGuideWorkflow(message)) return null
  if (isFullTravelGuideIntent(message)) return 'full'
  if (isTrafficGuideIntent(message)) return 'traffic'
  if (isEntryNoticeIntent(message)) return 'entry_notice'
  if (isInParkRouteIntent(message)) return 'in_park'
  if (isRecommendTravelGuideIntent(message)) return 'recommend'
  return 'recommend'
}

export function shouldRunTravelGuideWorkflow(message: string): boolean {
  if (isParkingPayIntent(message)) return false
  return (
    isFullTravelGuideIntent(message) ||
    isTrafficGuideIntent(message) ||
    isEntryNoticeIntent(message) ||
    isInParkRouteIntent(message) ||
    isRecommendTravelGuideIntent(message) ||
    /交通|攻略|怎么去|路线|出行|出游|指南|入园/.test(message) ||
    isParkingLocationIntent(message)
  )
}

/**
 * 明确的游玩攻略子意图：与购票冲突时优先攻略
 *（不含 shouldRunTravelGuideWorkflow 的宽泛兜底，避免「出行」误抢购票）
 */
export function isTravelGuidePreferredOverTicket(message: string): boolean {
  return (
    isEntryNoticeIntent(message) ||
    isRecommendTravelGuideIntent(message) ||
    isTrafficGuideIntent(message) ||
    isInParkRouteIntent(message) ||
    isFullTravelGuideIntent(message)
  )
}

/** 将子意图映射为 generateTravelGuide 的 scope */
export function travelGuideIntentToScope(
  intent: TravelGuideIntentKind,
): 'full' | 'in_park' | 'recommend' {
  if (intent === 'in_park') return 'in_park'
  if (intent === 'full') return 'full'
  return 'recommend'
}
