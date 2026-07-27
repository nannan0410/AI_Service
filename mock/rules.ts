import type { PersonaId } from '../src/types/index'
import type { RuleExpression } from '../src/types/businessConfig'
import { evaluateRule, evaluateRules, type RuleContext } from '../src/utils/ruleEngine'
import { hasNewGuestCoupon, canClaimNewGuestCoupon } from '../src/utils/newGuestCoupon'
import { getSnapshot, parsePersonaFromAuthHeader } from './_utils'
import {
  getUpcomingVisitOrders,
  hasVisitToday,
  pickNearestUpcomingVisitOrder,
} from '../src/utils/upcomingVisitOrder'
import { filterByBusinessScenicId, filterCouponsByScenic } from '../src/utils/scenicScope'
import { resolveProfileRuleTagIds } from '../src/utils/profileTags'

/** Mock 侧规则上下文（profileTags 使用相对路径，避免 vite-plugin-mock 打包失败） */
export function buildRuleContext(
  personaId: PersonaId,
  options?: { scenicId?: string | null },
): RuleContext {
  const snapshot = getSnapshot(personaId)
  const scenicId = options?.scenicId ?? null
  const orders = filterByBusinessScenicId(snapshot.orders, scenicId)
  const coupons = filterCouponsByScenic(snapshot.visitorState.coupons, scenicId)
  const now = Date.now()
  const invoiceWindowMs = 90 * 24 * 60 * 60 * 1000
  const ninetyDays = 90 * 24 * 60 * 60 * 1000

  const upcomingVisitOrders = getUpcomingVisitOrders(orders, new Date(now))
  const hasPendingVisitOrder = upcomingVisitOrders.length > 0
  const nextVisitDate = pickNearestUpcomingVisitOrder(orders, new Date(now))
    ?.visitDate
  const upcomingVisitOrderCount = upcomingVisitOrders.length
  const hasVisitTodayOrder = hasVisitToday(orders, new Date(now))
  const hasInvoiceableOrders = orders.some((o) => {
    if (o.status !== 'completed' || o.invoiceStatus !== 'none') return false
    const completed = o.completedAt ? new Date(o.completedAt).getTime() : 0
    return completed > 0 && now - completed <= invoiceWindowMs
  })
  const hasReviewableOrders = orders.some((o) => {
    if (o.status !== 'completed' || (o.reviewStatus ?? 'none') !== 'none') return false
    const completed = o.completedAt ? new Date(o.completedAt).getTime() : 0
    return completed > 0 && now - completed <= ninetyDays
  })

  let visitorPhase: RuleContext['visitorPhase'] = 'pre'
  if (snapshot.visitorState.inPark) {
    visitorPhase = 'in_park'
  } else if (hasInvoiceableOrders || orders.some((o) => o.status === 'completed')) {
    visitorPhase = 'post_later'
  }

  return {
    personaId,
    scenicId,
    memberId: snapshot.memberInfo.memberId,
    nickname: snapshot.memberInfo.nickname,
    memberLevel: snapshot.memberInfo.level,
    inPark: snapshot.visitorState.inPark,
    tags: resolveProfileRuleTagIds(personaId),
    hasPendingVisitOrder,
    nextVisitDate,
    upcomingVisitOrderCount,
    hasVisitToday: hasVisitTodayOrder,
    hasInvoiceableOrders,
    hasReviewableOrders,
    hasNewGuestCoupon: hasNewGuestCoupon(coupons),
    canClaimNewGuestCoupon: canClaimNewGuestCoupon({
      personaId,
      coupons,
      registeredAt: snapshot.memberInfo.registeredAt,
    }),
    visitorPhase,
  }
}

export function getPersonaFromHeaders(headers: Record<string, unknown>): PersonaId | null {
  return parsePersonaFromAuthHeader(headers.authorization as string | undefined)
}

export function getScenicIdFromHeaders(headers: Record<string, unknown>): string | null {
  const raw =
    (headers['x-scenic-id'] as string | undefined) ||
    (headers['X-Scenic-Id'] as string | undefined)
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null
}

export { evaluateRule, evaluateRules, type RuleContext }
export type { RuleExpression }
