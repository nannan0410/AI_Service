import type {
  Activity,
  ActivityCardPayload,
  ActivityCategory,
  ActivityGuideContext,
  ActivityQueueStatus,
  TravelGuideScope,
} from '@/types'

export const ACTIVITY_CATEGORY_LABELS: Record<ActivityCategory, string> = {
  dining: '餐饮',
  retail: '零售',
  ride: '游乐',
  show: '演出',
}

export const QUEUE_STATUS_LABELS: Record<ActivityQueueStatus, string> = {
  none: '无需排队',
  waiting: '排队中',
  paused: '暂停排队',
}

export function travelGuideScopeToGuideContext(
  scope?: TravelGuideScope,
): ActivityGuideContext {
  return scope === 'in_park' ? 'in_park' : 'pre_visit'
}

export function activityToCardPayload(
  activity: Activity,
  options?: {
    reason?: string
    guideContext?: ActivityGuideContext
  },
): ActivityCardPayload {
  return {
    activityId: activity.activityId,
    name: activity.name,
    category: activity.category,
    location: activity.location,
    timeRange: activity.timeRange,
    tags: activity.tags,
    queueStatus: activity.queueStatus,
    waitMinutes: activity.waitMinutes,
    pausedQueueLength: activity.pausedQueueLength,
    showStartTimes: activity.showStartTimes,
    recommendedDuration: activity.recommendedDuration,
    isHot: activity.isHot,
    virtualQueue: activity.virtualQueue,
    guideContext: options?.guideContext,
    reason: options?.reason,
  }
}

export function buildActivityRecommendReason(
  activity: Activity,
  context?: {
    guideContext?: ActivityGuideContext
    hasChildren?: boolean
  },
): string {
  const inPark = context?.guideContext === 'in_park'

  if (activity.category === 'show' && activity.showStartTimes?.length) {
    return `今日场次 ${activity.showStartTimes.join(' / ')}，请提前到场避免跑空`
  }

  if (inPark) {
    if (activity.queueStatus === 'paused') {
      const len = activity.pausedQueueLength ?? 0
      return `当前暂停排队（队伍约 ${len} 人），建议先玩其他项目`
    }
    if (activity.queueStatus === 'waiting' && activity.waitMinutes != null) {
      if (activity.waitMinutes <= 20) {
        return `排队约 ${activity.waitMinutes} 分钟，适合马上体验`
      }
      return `当前排队约 ${activity.waitMinutes} 分钟`
    }
  }

  // 前期攻略热门提示由 formatHotProjectLine 展示，此处不重复

  if (context?.hasChildren && activity.tags.includes('亲子')) {
    return '亲子优选'
  }

  if (activity.recommendedDuration) {
    return `建议游玩 ${activity.recommendedDuration}`
  }

  return '人气推荐'
}

/** 攻略推荐：在园按排队排序；前期优先热门 */
export function pickRecommendActivities(
  list: Activity[],
  options?: {
    limit?: number
    tag?: string
    guideContext?: ActivityGuideContext
    hasChildren?: boolean
  },
): Activity[] {
  const limit = options?.limit ?? 4
  const inPark = options?.guideContext === 'in_park'

  let pool = list.filter(
    (item) => item.category === 'ride' || item.category === 'show',
  )

  if (options?.tag) {
    const tagged = pool.filter((item) => item.tags.includes(options.tag!))
    if (tagged.length) pool = tagged
  }

  const score = (item: Activity): number => {
    if (inPark) {
      if (item.queueStatus === 'paused') return 1000
      if (item.queueStatus === 'waiting') return item.waitMinutes ?? 500
      return 0
    }
    // 前期攻略：热门优先，暂停排队仍降权
    if (item.queueStatus === 'paused') return 800
    if (item.isHot) return 0
    if (item.queueStatus === 'waiting') return 100 + (item.waitMinutes ?? 0)
    return 200
  }

  pool.sort((a, b) => score(a) - score(b))

  return pool.slice(0, limit)
}

export function formatActivityMetaLine(payload: ActivityCardPayload): string {
  const parts: string[] = [payload.location, payload.timeRange]
  if (payload.category) {
    parts.unshift(ACTIVITY_CATEGORY_LABELS[payload.category])
  }
  return parts.filter(Boolean).join(' · ')
}

/** 攻略卡片：仅 in_park 展示实时排队；列表页等场景默认展示 */
export function formatQueueLine(
  payload: ActivityCardPayload,
  options?: { respectGuideContext?: boolean },
): string | null {
  if (
    options?.respectGuideContext &&
    payload.guideContext === 'pre_visit'
  ) {
    return null
  }

  if (payload.queueStatus === 'waiting' && payload.waitMinutes != null) {
    return `${QUEUE_STATUS_LABELS.waiting} · 约 ${payload.waitMinutes} 分钟`
  }
  if (payload.queueStatus === 'paused') {
    const len = payload.pausedQueueLength ?? 0
    return `${QUEUE_STATUS_LABELS.paused} · 当前队伍约 ${len} 人`
  }
  if (payload.queueStatus === 'none') {
    return QUEUE_STATUS_LABELS.none
  }
  return null
}

export function formatHotProjectLine(
  payload: ActivityCardPayload,
): string | null {
  if (payload.guideContext !== 'pre_visit' || !payload.isHot) return null
  return '热门项目 · 建议提早前往并预留排队时间'
}

export function formatVirtualQueueLine(payload: ActivityCardPayload): string | null {
  const vq = payload.virtualQueue
  if (!vq?.enabled) return null
  if (vq.isFree) return '支持免费虚拟排队'
  return `虚拟排队 ¥${vq.queuePrice ?? 0}`
}
