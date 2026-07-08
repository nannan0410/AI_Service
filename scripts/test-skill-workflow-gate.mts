/**
 * P0-2 增强：高置信度 LLM 路由可进 Workflow
 * 运行: npx vite-node scripts/test-skill-workflow-gate.mts
 */
import {
  isLlmWorkflowEntry,
  shouldRunTicketWorkflowFromRoute,
  shouldRunOrderQueryWorkflowFromRoute,
} from '../src/ai/nlu/skillWorkflowGate'
import type { SkillRouteResult } from '../src/ai/nlu/resolveSkillRoute'
import type { AssistantSkillConfig } from '../src/types'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

const ticketSkill = {
  skillId: 'ticket_purchase',
  name: '智能购票',
  enabled: true,
} as AssistantSkillConfig

const orderSkill = {
  skillId: 'order_query',
  name: '订单查询',
  enabled: true,
} as AssistantSkillConfig

const llmTicketHigh: SkillRouteResult = {
  skill: ticketSkill,
  source: 'llm',
  confidence: 0.9,
}

const llmTicketLow: SkillRouteResult = {
  skill: ticketSkill,
  source: 'llm',
  confidence: 0.6,
}

const llmOrderHigh: SkillRouteResult = {
  skill: orderSkill,
  source: 'llm',
  confidence: 0.85,
}

const keywordTicket: SkillRouteResult = {
  skill: ticketSkill,
  source: 'keyword',
}

assert(
  shouldRunTicketWorkflowFromRoute(llmTicketHigh, '想帮家人把行程订好', false),
  'llm high conf enters ticket workflow',
)
assert(
  !shouldRunTicketWorkflowFromRoute(llmTicketLow, '想帮家人把行程订好', false),
  'llm low conf does not enter without regex',
)
assert(
  shouldRunTicketWorkflowFromRoute(keywordTicket, '买票', false),
  'keyword + regex intent',
)
assert(
  shouldRunOrderQueryWorkflowFromRoute(llmOrderHigh, '上次买的票在哪看'),
  'llm high conf order query',
)
assert(isLlmWorkflowEntry(llmTicketHigh, 'ticket_purchase'), 'llm entry ticket')
assert(!isLlmWorkflowEntry(llmTicketLow, 'ticket_purchase'), 'low conf no entry')

console.log('OK: skill workflow gate (P0-2 enhancement)')
