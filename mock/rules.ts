import type { PersonaId, UserSnapshot } from '../src/types/index'
import { getSnapshot, parsePersonaFromAuthHeader } from './_utils'

export interface RuleContext {
  personaId: PersonaId | null
  memberId: string
  nickname: string
  memberLevel: string
  inPark: boolean
  tags: string[]
  hasPendingVisitOrder: boolean
  hasInvoiceableOrders: boolean
  visitorPhase: 'pre' | 'in_park' | 'post_same_day' | 'post_later'
}

type RuleExpression =
  | { op: 'eq'; field: keyof RuleContext | string; value: unknown }
  | { op: 'in'; field: keyof RuleContext | string; values: unknown[] }
  | { op: 'and'; rules: RuleExpression[] }
  | { op: 'or'; rules: RuleExpression[] }

export function buildRuleContext(personaId: PersonaId): RuleContext {
  const snapshot = getSnapshot(personaId)
  const orders = snapshot.orders
  const now = Date.now()
  const thirtyDays = 30 * 24 * 60 * 60 * 1000

  const hasPendingVisitOrder = orders.some((o) => o.status === 'paid')
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

  const tagsByPersona: Record<PersonaId, string[]> = {
    demo_new: ['new_guest'],
    demo_mid: ['family'],
    demo_vip: ['family', 'high_value'],
  }

  return {
    personaId,
    memberId: snapshot.memberInfo.memberId,
    nickname: snapshot.memberInfo.nickname,
    memberLevel: snapshot.memberInfo.level,
    inPark: snapshot.visitorState.inPark,
    tags: tagsByPersona[personaId],
    hasPendingVisitOrder,
    hasInvoiceableOrders,
    visitorPhase,
  }
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
    case 'and':
      return rule.rules.every((r) => evaluateRule(r, ctx))
    case 'or':
      return rule.rules.some((r) => evaluateRule(r, ctx))
    default:
      return false
  }
}

export function evaluateRules(rules: RuleExpression[], ctx: RuleContext): boolean {
  return rules.every((r) => evaluateRule(r, ctx))
}

export function getPersonaFromHeaders(headers: Record<string, unknown>): PersonaId | null {
  return parsePersonaFromAuthHeader(headers.authorization as string | undefined)
}

export type { RuleExpression, UserSnapshot }
