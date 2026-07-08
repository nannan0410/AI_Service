import type { RuleExpression } from '@/types/businessConfig'

export interface RuleContext {
  personaId: string | null
  memberId: string
  nickname: string
  memberLevel: string
  inPark: boolean
  tags: string[]
  hasPendingVisitOrder: boolean
  /** 最近一笔待出行订单的 visitDate（YYYY-MM-DD） */
  nextVisitDate?: string
  upcomingVisitOrderCount: number
  /** 今天是否有待出行订单 */
  hasVisitToday: boolean
  hasInvoiceableOrders: boolean
  hasReviewableOrders: boolean
  /** 账户是否已持有可用的新客专享券 */
  hasNewGuestCoupon: boolean
  /** 当前是否可领取新客专享券（身份 + 窗口 + 未领过） */
  canClaimNewGuestCoupon: boolean
  visitorPhase: 'pre' | 'in_park' | 'post_same_day' | 'post_later'
}

function getField(ctx: RuleContext, field: string): unknown {
  if (field in ctx) return ctx[field as keyof RuleContext]
  if (field === 'tags') return ctx.tags
  return undefined
}

export function evaluateRule(rule: RuleExpression, ctx: RuleContext): boolean {
  switch (rule.op) {
    case 'eq':
      return getField(ctx, rule.field) === rule.value
    case 'in':
      return rule.values.includes(getField(ctx, rule.field))
    case 'contains': {
      const fieldValue = getField(ctx, rule.field)
      if (Array.isArray(fieldValue)) return fieldValue.includes(rule.value)
      return false
    }
    case 'and':
      return rule.rules.every((r) => evaluateRule(r, ctx))
    case 'or':
      return rule.rules.some((r) => evaluateRule(r, ctx))
    default:
      return false
  }
}

export function evaluateRules(rules: RuleExpression[], ctx: RuleContext): boolean {
  if (!rules.length) return true
  return rules.every((r) => evaluateRule(r, ctx))
}
