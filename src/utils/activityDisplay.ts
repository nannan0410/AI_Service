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
    mapPoiId: activity.mapPoiId,
  }
}

export function buildActivityRecommendReason(
  activity: Activity,
  context?: {
    guideContext?: ActivityGuideContext
    hasChildren?: boolean
    preferThrill?: boolean
    preferSlow?: boolean
    preferPhoto?: boolean
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
    return '因亲子标签推荐'
  }

  if (context?.preferThrill && activity.tags.includes('刺激')) {
    return '因喜欢刺激偏好推荐'
  }

  if (context?.preferSlow && activity.tags.includes('温和')) {
    return '因慢节奏偏好推荐'
  }

  if (
    context?.preferPhoto &&
    (activity.name.includes('萌宠') ||
      activity.category === 'show' ||
      activity.tags.includes('亲子'))
  ) {
    return '因偏好拍照/出片推荐'
  }

  if (activity.recommendedDuration) {
    return `建议游玩 ${activity.recommendedDuration}`
  }

  return '人气推荐'
}

/** 攻略推荐：在园按排队排序；前期优先热门；可吃画像标签 */
export function pickRecommendActivities(
  list: Activity[],
  options?: {
    limit?: number
    tag?: string
    guideContext?: ActivityGuideContext
    hasChildren?: boolean
    profileTagIds?: string[]
  },
): Activity[] {
  const limit = options?.limit ?? 4
  const inPark = options?.guideContext === 'in_park'
  const tagIds = options?.profileTagIds ?? []
  const family = tagIds.includes('family') || tagIds.includes('order_family')
  const thrill = tagIds.includes('prefer_thrill')
  const slow = tagIds.includes('prefer_slow')
  const photo = tagIds.includes('prefer_photo')

  let pool = list.filter(
    (item) => item.category === 'ride' || item.category === 'show',
  )

  const preferTag =
    options?.tag ||
    (family || options?.hasChildren ? '亲子' : undefined)

  const isPhotoSpot = (item: Activity) =>
    item.name.includes('萌宠') ||
    item.category === 'show' ||
    item.tags.includes('亲子')

  if (preferTag) {
    const tagged = pool.filter((item) => item.tags.includes(preferTag))
    if (tagged.length) pool = tagged
  } else if (thrill) {
    const tagged = pool.filter((item) => item.tags.includes('刺激'))
    if (tagged.length) pool = tagged
  } else if (slow) {
    const tagged = pool.filter((item) => item.tags.includes('温和'))
    if (tagged.length) pool = tagged
  } else if (photo) {
    const tagged = pool.filter(isPhotoSpot)
    if (tagged.length) pool = tagged
  }

  const score = (item: Activity): number => {
    let base = 0
    if (inPark) {
      if (item.queueStatus === 'paused') base = 1000
      else if (item.queueStatus === 'waiting') base = item.waitMinutes ?? 500
      else base = 0
    } else {
      if (item.queueStatus === 'paused') base = 800
      else if (item.isHot) base = 0
      else if (item.queueStatus === 'waiting') base = 100 + (item.waitMinutes ?? 0)
      else base = 200
    }
    if (family && item.tags.includes('亲子')) base -= 50
    if (thrill && item.tags.includes('刺激')) base -= 40
    if (slow && item.tags.includes('温和')) base -= 40
    if (photo && isPhotoSpot(item)) base -= 35
    return base
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
