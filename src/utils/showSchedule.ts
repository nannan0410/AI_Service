import type { Activity } from '@/types'

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

/** 展开当日全部演出场次并按开始时间排序 */
export function listTodayShowSlots(
  activities: Activity[],
  ref = new Date(),
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

export function buildShowScheduleReply(
  slots: ShowSlot[],
  ref = new Date(),
): string {
  if (!slots.length) {
    return '今日暂无演出安排，您可以在园区项目页查看其他可玩项目。'
  }

  const next = findNextShowSlot(slots, ref)
  const grouped = groupShowSlotsByActivity(slots)
  const scheduleLines = [...grouped.values()]
    .map((item) => `· ${item.name}（${item.location}）：${item.times.join('、')}`)
    .join('\n')

  if (next) {
    const durationHint = next.recommendedDuration
      ? `，预计 ${next.recommendedDuration}`
      : ''
    return (
      `为您查到今日 ${grouped.size} 场演出、共 ${slots.length} 个场次。` +
      `下一场是 ${next.startTime} ${next.activityName}（${next.location}）${durationHint}，建议提前 10 分钟到场。\n\n` +
      `今日全部场次：\n${scheduleLines}`
    )
  }

  const last = slots[slots.length - 1]
  return (
    `今日演出场次已全部结束（最后一场 ${last.startTime} ${last.activityName}）。\n\n` +
    `今日场次回顾：\n${scheduleLines}`
  )
}
