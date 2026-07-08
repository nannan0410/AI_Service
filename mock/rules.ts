import type { PersonaId } from '../src/types/index'
import type { RuleExpression } from '../src/types/businessConfig'
import type { TagCatalogItem } from '../src/types/businessConfig'
import { evaluateRule, evaluateRules, type RuleContext } from '../src/utils/ruleEngine'
import { hasNewGuestCoupon, canClaimNewGuestCoupon } from '../src/utils/newGuestCoupon'
import fieldCatalog from '../src/mock/assistant/field_catalog.json'
import { getSnapshot, parsePersonaFromAuthHeader } from './_utils'
import {
  getUpcomingVisitOrders,
  hasVisitToday,
  pickNearestUpcomingVisitOrder,
} from '../src/utils/upcomingVisitOrder'

function resolveTagsForPersona(personaId: PersonaId): string[] {
  return fieldCatalog.tags
    .filter((tag: TagCatalogItem) => tag.demoPersonas?.includes(personaId))
    .map((tag) => tag.tagId)
}

/** Mock 侧规则上下文（不依赖 src 中带 @/ 别名的模块，避免 vite-plugin-mock 打包失败） */
export function buildRuleContext(personaId: PersonaId): RuleContext {
  const snapshot = getSnapshot(personaId)
  const orders = snapshot.orders
  const now = Date.now()
  const thirtyDays = 30 * 24 * 60 * 60 * 1000

  const upcomingVisitOrders = getUpcomingVisitOrders(orders, new Date(now))
  const hasPendingVisitOrder = upcomingVisitOrders.length > 0
  const nextVisitDate = pickNearestUpcomingVisitOrder(orders, new Date(now))
    ?.visitDate
  const upcomingVisitOrderCount = upcomingVisitOrders.length
  const hasVisitTodayOrder = hasVisitToday(orders, new Date(now))
  const hasInvoiceableOrders = orders.some((o) => {
    if (o.status !== 'completed' || o.invoiceStatus !== 'none') return false
    const completed = o.completedAt ? new Date(o.completedAt).getTime() : 0
    return completed > 0 && now - completed <= thirtyDays
  })

  let visitorPhase: RuleContext['visitorPhase'] = 'pre'
  if (snapshot.visitorState.inPark) {
    visitorPhase = 'in_park'
  } else if (hasInvoiceableOrders || orders.some((o) => o.status === 'completed')) {
    visitorPhase = 'post_later'
  }

  return {
    personaId,
    memberId: snapshot.memberInfo.memberId,
    nickname: snapshot.memberInfo.nickname,
    memberLevel: snapshot.memberInfo.level,
    inPark: snapshot.visitorState.inPark,
    tags: resolveTagsForPersona(personaId),
    hasPendingVisitOrder,
    nextVisitDate,
    upcomingVisitOrderCount,
    hasVisitToday: hasVisitTodayOrder,
    hasInvoiceableOrders,
    hasNewGuestCoupon: hasNewGuestCoupon(snapshot.visitorState.coupons),
    canClaimNewGuestCoupon: canClaimNewGuestCoupon({
      personaId,
      coupons: snapshot.visitorState.coupons,
      registeredAt: snapshot.memberInfo.registeredAt,
    }),
    visitorPhase,
  }
}

export function getPersonaFromHeaders(headers: Record<string, unknown>): PersonaId | null {
  return parsePersonaFromAuthHeader(headers.authorization as string | undefined)
}

export { evaluateRule, evaluateRules, type RuleContext }
export type { RuleExpression }
