import type { Coupon, Order, PersonaId, UserSnapshot } from '@/types'
import type { RuleContext } from '@/utils/ruleEngine'
import {
  buildDemoNewRegisteredAt,
  canClaimNewGuestCoupon,
  findNewGuestCoupon,
  hasNewGuestCoupon,
  isWithinNewGuestClaimWindow,
} from '@/utils/newGuestCoupon'
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

/** 与 mock ensureDemoNewRegistrationFresh 对齐：静态 JSON 注册日过期时自愈，避免预览/规则误判 */
function ensureDemoNewRegistrationFresh(snapshot: UserSnapshot): void {
  if (findNewGuestCoupon(snapshot.visitorState.coupons)) return
  if (isWithinNewGuestClaimWindow(snapshot.memberInfo.registeredAt)) return
  snapshot.memberInfo.registeredAt = buildDemoNewRegisteredAt()
}

ensureDemoNewRegistrationFresh(snapshots.demo_new)

function resolveTagsForPersona(personaId: PersonaId): string[] {
  const catalog = defaultFieldCatalog as FieldCatalog
  return catalog.tags
    .filter((tag: TagCatalogItem) => tag.demoPersonas?.includes(personaId))
    .map((tag) => tag.tagId)
}

/** 聊天页实时态（Mock 内存快照）覆盖静态 JSON，避免清空券后规则仍读旧数据 */
export type DemoRuleLiveOverrides = {
  coupons?: Coupon[]
  orders?: Order[]
  registeredAt?: string
  inPark?: boolean
  nickname?: string
  memberLevel?: string
}

/** Demo 版：基于 mock 用户快照构建规则上下文（客户端预览与 Chat 过滤共用） */
export function buildDemoRuleContext(
  personaId: PersonaId,
  live?: DemoRuleLiveOverrides,
): RuleContext {
  const snapshot = snapshots[personaId]
  const orders = live?.orders ?? snapshot.orders
  const coupons = live?.coupons ?? snapshot.visitorState.coupons
  const registeredAt = live?.registeredAt ?? snapshot.memberInfo.registeredAt
  const inPark = live?.inPark ?? snapshot.visitorState.inPark
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
  if (inPark) {
    visitorPhase = 'in_park'
  } else if (hasInvoiceableOrders || orders.some((o) => o.status === 'completed')) {
    visitorPhase = 'post_later'
  }

  return {
    personaId,
    memberId: snapshot.memberInfo.memberId,
    nickname: live?.nickname ?? snapshot.memberInfo.nickname,
    memberLevel: live?.memberLevel ?? snapshot.memberInfo.level,
    inPark,
    tags: resolveTagsForPersona(personaId),
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
      registeredAt,
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
