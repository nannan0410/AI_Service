import type { Activity } from '@/types'
import type { ShowDayKind } from '@/utils/showScheduleIntent'
import { showDayLabel } from '@/utils/showScheduleIntent'

export interface ShowSlot {
  activityId: string
  activityName: string
  location: string
  startTime: string
  startMinutes: number
  recommendedDuration?: string
}

export function parseShowTimeMinutes(time: string): number {
  const [hour, minute] = time.split(':').map(Number)
  return hour * 60 + (minute || 0)
}

export function getNowMinutes(ref = new Date()): number {
  return ref.getHours() * 60 + ref.getMinutes()
}

/** 展开全部演出场次并按开始时间排序（演示场次表按日复用） */
export function listTodayShowSlots(
  activities: Activity[],
  _ref = new Date(),
): ShowSlot[] {
  const slots: ShowSlot[] = []
  for (const activity of activities) {
    if (activity.category !== 'show' || !activity.showStartTimes?.length) continue
    for (const startTime of activity.showStartTimes) {
      slots.push({
        activityId: activity.activityId,
        activityName: activity.name,
        location: activity.location,
        startTime,
        startMinutes: parseShowTimeMinutes(startTime),
        recommendedDuration: activity.recommendedDuration,
      })
    }
  }
  return slots.sort((a, b) => a.startMinutes - b.startMinutes)
}

export function findNextShowSlot(
  slots: ShowSlot[],
  ref = new Date(),
): ShowSlot | undefined {
  const now = getNowMinutes(ref)
  return slots.find((slot) => slot.startMinutes > now)
}

export function findEarliestShowSlot(slots: ShowSlot[]): ShowSlot | undefined {
  return slots[0]
}

/**
 * 推荐场次：
 * - 今日：仅「尚未开始的下一场」（全部结束则为 undefined）
 * - 明日/后天/项目推荐：最早一场
 */
export function findRecommendedShowSlot(
  slots: ShowSlot[],
  dayKind: ShowDayKind,
  ref = new Date(),
): ShowSlot | undefined {
  if (dayKind === 'today') {
    return findNextShowSlot(slots, ref)
  }
  return findEarliestShowSlot(slots)
}

export function groupShowSlotsByActivity(
  slots: ShowSlot[],
): Map<string, { name: string; location: string; times: string[] }> {
  const map = new Map<string, { name: string; location: string; times: string[] }>()
  for (const slot of slots) {
    const existing = map.get(slot.activityId)
    if (existing) {
      existing.times.push(slot.startTime)
    } else {
      map.set(slot.activityId, {
        name: slot.activityName,
        location: slot.location,
        times: [slot.startTime],
      })
    }
  }
  return map
}

/** 某项目在「今日」视角下尚未开始的场次 */
export function remainingTimesForActivity(
  activityId: string,
  slots: ShowSlot[],
  ref = new Date(),
): string[] {
  const now = getNowMinutes(ref)
  return slots
    .filter((slot) => slot.activityId === activityId && slot.startMinutes > now)
    .map((slot) => slot.startTime)
}

export function buildShowScheduleReply(
  slots: ShowSlot[],
  options: {
    dayKind?: ShowDayKind
    ref?: Date
  } = {},
): string {
  const dayKind = options.dayKind ?? 'today'
  const ref = options.ref ?? new Date()
  const day = showDayLabel(dayKind)

  if (!slots.length) {
    return dayKind === 'general'
      ? '暂无演出项目可推荐，您可以在园区项目页查看其他可玩项目。'
      : `${day}暂无演出安排，您可以在园区项目页查看其他可玩项目。`
  }

  const nextToday = dayKind === 'today' ? findNextShowSlot(slots, ref) : undefined
  const earliest = findEarliestShowSlot(slots)!
  const grouped = groupShowSlotsByActivity(slots)
  const scheduleLines = [...grouped.values()]
    .map((item) => `· ${item.name}（${item.location}）：${item.times.join('、')}`)
    .join('\n')

  if (dayKind === 'general') {
    const durationHint = earliest.recommendedDuration
      ? `，预计 ${earliest.recommendedDuration}`
      : ''
    return (
      `为您推荐 ${grouped.size} 个演出项目、共 ${slots.length} 个场次。` +
      `可优先安排最早一场：${earliest.startTime} ${earliest.activityName}（${earliest.location}）${durationHint}，建议提前 10 分钟到场。\n\n` +
      `场次一览：\n${scheduleLines}`
    )
  }

  if (dayKind !== 'today') {
    const durationHint = earliest.recommendedDuration
      ? `，预计 ${earliest.recommendedDuration}`
      : ''
    return (
      `${day}有演出安排，共 ${grouped.size} 个演出项目、${slots.length} 个场次。` +
      `建议优先观看最早一场：${earliest.startTime} ${earliest.activityName}（${earliest.location}）${durationHint}，建议提前 10 分钟到场。\n\n` +
      `${day}全部场次：\n${scheduleLines}`
    )
  }

  if (nextToday) {
    const durationHint = nextToday.recommendedDuration
      ? `，预计 ${nextToday.recommendedDuration}`
      : ''
    const earliestHint =
      earliest.activityId === nextToday.activityId &&
      earliest.startTime === nextToday.startTime
        ? ''
        : ` 当日最早一场为 ${earliest.startTime} ${earliest.activityName}。`
    return (
      `为您查到${day} ${grouped.size} 个演出、共 ${slots.length} 个场次。` +
      `下一场是 ${nextToday.startTime} ${nextToday.activityName}（${nextToday.location}）${durationHint}，建议提前 10 分钟到场。` +
      earliestHint +
      `\n\n${day}全部场次：\n${scheduleLines}`
    )
  }

  const last = slots[slots.length - 1]
  return (
    `${day}演出场次已全部结束（最后一场 ${last.startTime} ${last.activityName}）。\n\n` +
    `${day}场次回顾：\n${scheduleLines}`
  )
}
