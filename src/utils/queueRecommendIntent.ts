import activities from '@/mock/activities.json'
import type { Activity } from '@/types'

/** 支持虚拟排队的项目（按名称长度降序，便于点名匹配） */
export function listVirtualQueueActivities(): Activity[] {
  return (activities as Activity[])
    .filter((item) => item.virtualQueue?.enabled)
    .slice()
    .sort((a, b) => b.name.length - a.name.length)
}

/** 免费虚拟排队 Demo 包：亲子漂流 + 萌宠乐园 */
export const FREE_QUEUE_DEMO_IDS = ['act_001', 'act_004'] as const

/** 付费快速排队 Demo：极限过山车 ¥10 */
export const PAID_QUEUE_DEMO_ID = 'act_002'

/** 明确园内「今日路线」攻略（让位 travel_guide） */
export function isTodayRouteGuideIntent(message: string): boolean {
  return /今日路线|今日游玩路线|根据当前位置和排队情况推荐今日路线|根据我在园状态安排今日游玩路线|现在先玩哪里/.test(
    message,
  )
}

/** 付费 / 快速排队话术 */
export function isPaidQueueRecommendIntent(message: string): boolean {
  const text = message.trim()
  if (!text) return false
  return (
    /快速排队|付费虚拟排队|付费排队|花钱排队|加速排队/.test(text) ||
    /¥\s*10|￥\s*10|10\s*元.{0,6}排队|十元.{0,6}排队/.test(text)
  )
}

/** 免费包话术（与付费、今日路线互斥） */
export function isFreeQueueRecommendIntent(message: string): boolean {
  const text = message.trim()
  if (!text) return false
  if (isPaidQueueRecommendIntent(text)) return false
  if (isTodayRouteGuideIntent(text)) return false
  return (
    /虚拟排队|免费取号|免费虚拟排队|立即取号|取号排队|在线取号/.test(text) ||
    /排队少的项目|排队时间较短|适合马上玩的项目|马上玩的项目/.test(text) ||
    /推荐附近排队|附近排队少|推荐.*排队少/.test(text)
  )
}

/** 消息中点名的虚拟排队项目 */
export function matchVirtualQueueActivityByName(message: string): Activity | null {
  const text = message.trim()
  if (!text) return null
  for (const activity of listVirtualQueueActivities()) {
    if (text.includes(activity.name)) return activity
  }
  return null
}

/** 是否走虚拟排队推荐 Workflow */
export function shouldRunQueueRecommendWorkflow(message: string): boolean {
  const text = message.trim()
  if (!text) return false
  if (matchVirtualQueueActivityByName(text)) return true
  if (isPaidQueueRecommendIntent(text)) return true
  if (isFreeQueueRecommendIntent(text)) return true
  return false
}

export type QueueRecommendKind = 'free_bundle' | 'paid_single' | 'named'

export function resolveQueueRecommendKind(message: string): QueueRecommendKind | null {
  if (!shouldRunQueueRecommendWorkflow(message)) return null
  if (matchVirtualQueueActivityByName(message)) return 'named'
  if (isPaidQueueRecommendIntent(message)) return 'paid_single'
  if (isFreeQueueRecommendIntent(message)) return 'free_bundle'
  return null
}
