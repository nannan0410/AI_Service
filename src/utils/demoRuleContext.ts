import type { PersonaId, UserSnapshot } from '@/types'
import type { RuleContext } from '@/utils/ruleEngine'
import { hasNewGuestCoupon, canClaimNewGuestCoupon } from '@/utils/newGuestCoupon'
import { filterInvoiceableOrders } from '@/utils/invoiceableOrders'
import { filterReviewableOrders } from '@/utils/reviewableOrders'
import defaultFieldCatalog from '@/mock/assistant/field_catalog.json'
import demoNew from '@/mock/users/demo_new.json'
import demoMid from '@/mock/users/demo_mid.json'
import demoVip from '@/mock/users/demo_vip.json'
import type { FieldCatalog, TagCatalogItem } from '@/types/businessConfig'

import {
  getUpcomingVisitOrders,
  hasVisitToday,
  pickNearestUpcomingVisitOrder,
} from '@/utils/upcomingVisitOrder'

const snapshots: Record<PersonaId, UserSnapshot> = {
  demo_new: demoNew as UserSnapshot,
  demo_mid: demoMid as UserSnapshot,
  demo_vip: demoVip as UserSnapshot,
}

function resolveTagsForPersona(personaId: PersonaId): string[] {
  const catalog = defaultFieldCatalog as FieldCatalog
  return catalog.tags
    .filter((tag: TagCatalogItem) => tag.demoPersonas?.includes(personaId))
    .map((tag) => tag.tagId)
}

/** Demo 版：基于 mock 用户快照构建规则上下文（客户端预览与 Chat 过滤共用） */
export function buildDemoRuleContext(personaId: PersonaId): RuleContext {
  const snapshot = snapshots[personaId]
  const orders = snapshot.orders
  const now = Date.now()

  const upcomingVisitOrders = getUpcomingVisitOrders(orders, new Date(now))
  const hasPendingVisitOrder = upcomingVisitOrders.length > 0
  const nextVisitDate = pickNearestUpcomingVisitOrder(orders, new Date(now))
    ?.visitDate
  const upcomingVisitOrderCount = upcomingVisitOrders.length
  const hasVisitTodayOrder = hasVisitToday(orders, new Date(now))
  const hasInvoiceableOrders = filterInvoiceableOrders(orders, now).length > 0
  const hasReviewableOrders = filterReviewableOrders(orders, now).length > 0

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
    hasReviewableOrders,
    hasNewGuestCoupon: hasNewGuestCoupon(snapshot.visitorState.coupons),
    canClaimNewGuestCoupon: canClaimNewGuestCoupon({
      personaId,
      coupons: snapshot.visitorState.coupons,
      registeredAt: snapshot.memberInfo.registeredAt,
    }),
    visitorPhase,
  }
}

export const DEMO_PERSONA_OPTIONS: Array<{ value: PersonaId; label: string }> = [
  { value: 'demo_new', label: '新客（demo_new）' },
  { value: 'demo_mid', label: '中级会员（demo_mid）' },
  { value: 'demo_vip', label: '高级会员（demo_vip）' },
]

/** 演示账号券过滤上下文（欢迎页猜你想问预览 / 过滤） */
export function buildDemoCouponFilterCtx(personaId: PersonaId) {
  const snapshot = snapshots[personaId]
  return {
    personaId,
    coupons: snapshot.visitorState.coupons,
    registeredAt: snapshot.memberInfo.registeredAt,
  }
}
