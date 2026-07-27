import type {
  Activity,
  ActivityCardAction,
  ActivityCardPayload,
  ActivityVirtualQueue,
} from '@/types'

const TAKE_PATH = '/queue/take'
const PAY_PATH = '/queue/pay'

export function buildQueueActionLabel(vq?: ActivityVirtualQueue): string | null {
  if (!vq?.enabled) return null
  if (vq.isFree) return '立即排队'
  const price = vq.queuePrice ?? 10
  return `¥${price}排队`
}

export function buildQueueActionPath(
  activityId: string,
  vq?: ActivityVirtualQueue,
): string | null {
  if (!vq?.enabled) return null
  if (vq.isFree) {
    return `${TAKE_PATH}?activityId=${encodeURIComponent(activityId)}`
  }
  return `${PAY_PATH}?activityId=${encodeURIComponent(activityId)}`
}

/**
 * 在园项目卡操作（同一排）：
 * - 演出：打卡 · 预约 · 地图查看
 * - 餐饮/零售：打卡 · 地图查看
 * - 游乐：立即排队/¥x排队 · 打卡 · 地图查看
 */
export function buildInParkCardActions(options: {
  category?: Activity['category'] | ActivityCardPayload['category']
  activityId: string
  virtualQueue?: ActivityVirtualQueue
  /** 是否有关联打卡点 */
  canCheckin?: boolean
  /** 地图 deepLink */
  mapPath?: string
  /** 演出：当日仍有可看场次 */
  canReserve?: boolean
}): ActivityCardAction[] {
  const {
    category,
    activityId,
    virtualQueue,
    canCheckin,
    mapPath,
    canReserve,
  } = options
  const actions: ActivityCardAction[] = []

  if (category === 'ride') {
    const label = buildQueueActionLabel(virtualQueue)
    const path = buildQueueActionPath(activityId, virtualQueue)
    if (label && path) {
      actions.push({ key: 'queue', label, path })
    }
  }

  if (canCheckin) {
    actions.push({ key: 'checkin', label: '打卡' })
  }

  if (category === 'show' && canReserve) {
    actions.push({ key: 'reserve', label: '预约' })
  }

  if (mapPath) {
    actions.push({ key: 'map', label: '地图查看', path: mapPath })
  }

  return actions
}

export function applyInParkActionsToCard(
  card: ActivityCardPayload,
  options: {
    canCheckin?: boolean
    mapPath?: string
    canReserve?: boolean
  },
): ActivityCardPayload {
  if (card.guideContext !== 'in_park') {
    return card
  }
  const inParkActions = buildInParkCardActions({
    category: card.category,
    activityId: card.activityId,
    virtualQueue: card.virtualQueue,
    canCheckin: options.canCheckin,
    mapPath: options.mapPath ?? card.mapActions?.[0]?.path,
    canReserve: options.canReserve,
  })
  return {
    ...card,
    inParkActions: inParkActions.length ? inParkActions : undefined,
  }
}
