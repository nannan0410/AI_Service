import type { TravelGuideResult } from '@/types'

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const

export function formatVisitWeekday(visitDate: string): string {
  const [year, month, day] = visitDate.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return WEEKDAYS[date.getDay()] ?? ''
}

/** 园内路线推荐 — 不含交通与入园提醒 */
export function buildInParkRouteReply(
  guide: Pick<TravelGuideResult, 'visitorCount'>,
): string {
  const countLabel =
    guide.visitorCount && guide.visitorCount > 0
      ? `（同行 ${guide.visitorCount} 人）`
      : ''
  return `根据您在园状态与当前热度${countLabel}，为您推荐今日游玩路线与项目，详见下方卡片（不含交通与入园提醒）。`
}

/** 游玩攻略 / 项目推荐 — 不含交通与入园 */
export function buildRecommendGuideReply(
  guide: Pick<TravelGuideResult, 'visitDate' | 'ticketName' | 'visitorCount'>,
): string {
  if (guide.visitDate && guide.ticketName) {
    const weekday = formatVisitWeekday(guide.visitDate)
    const weekdayLabel = weekday ? ` ${weekday}` : ''
    const countLabel =
      guide.visitorCount && guide.visitorCount > 0
        ? `，游客 ${guide.visitorCount} 名`
        : ''
    return `结合您 ${guide.visitDate}${weekdayLabel} 的「${guide.ticketName}」${countLabel}，为您推荐游玩路线与热门项目，详见下方卡片（不含交通与入园提醒）。`
  }
  return '为您推荐游玩路线与热门项目，详见下方卡片（不含交通与入园提醒）。'
}

/** 完整出行攻略 — 含交通与入园 */
export function buildTravelGuideReply(
  guide: Pick<TravelGuideResult, 'visitDate' | 'ticketName' | 'visitorCount'>,
): string {
  if (guide.visitDate && guide.ticketName) {
    const weekday = formatVisitWeekday(guide.visitDate)
    const weekdayLabel = weekday ? ` ${weekday}` : ''
    const countLabel =
      guide.visitorCount && guide.visitorCount > 0
        ? `，游客 ${guide.visitorCount} 名`
        : ''
    return `查到您最近的出行订单日期为 ${guide.visitDate}${weekdayLabel}，「${guide.ticketName}」${countLabel}，为您整理完整出行攻略：交通 → 入园 → 推荐项目详见下方卡片。`
  }
  return '为您整理完整出行攻略：交通 → 入园 → 推荐项目详见下方卡片。'
}

export function buildGuideReplyByScope(
  guide: Pick<
    TravelGuideResult,
    'scope' | 'visitDate' | 'ticketName' | 'visitorCount'
  >,
): string {
  if (guide.scope === 'in_park') return buildInParkRouteReply(guide)
  if (guide.scope === 'recommend') return buildRecommendGuideReply(guide)
  return buildTravelGuideReply(guide)
}
