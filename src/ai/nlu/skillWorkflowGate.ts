import { llmConfig } from '@config/llm.config'
import type { Stage2SkillId } from '@/ai/skills/utils'
import { isTicketPurchaseIntent } from '@/utils/ticketPurchaseIntent'
import { shouldRunOrderQueryWorkflow } from '@/utils/orderQueryIntent'
import { shouldRunInvoiceWorkflow } from '@/utils/invoiceIntent'
import { shouldRunReviewWorkflow } from '@/utils/reviewIntent'
import { shouldRunParkingPayWorkflow } from '@/utils/parkingPayIntent'
import { shouldRunProactiveMarketingWorkflow } from '@/utils/proactiveMarketingIntent'
import { shouldRunShowScheduleWorkflow } from '@/utils/showScheduleIntent'
import { shouldRunTravelGuideWorkflow } from '@/utils/travelGuideIntent'
import type { SkillRouteResult } from './resolveSkillRoute'

/** P0-2 增强：高置信度 LLM 语义路由是否可进入 Workflow */
export function isSkillWorkflowEnhancementEnabled(): boolean {
  const flag = import.meta.env.VITE_ENABLE_SKILL_WORKFLOW_NLU
  if (flag === 'false' || flag === '0') return false
  return llmConfig.nlu.skillRoutingWorkflowEnhancement !== false
}

export function getSkillWorkflowConfidenceThreshold(): number {
  return llmConfig.nlu.skillRoutingWorkflowThreshold ?? 0.8
}

/** LLM 语义路由且置信度达阈值时，可替代 Workflow 二级正则 */
export function isLlmWorkflowEntry(
  route: SkillRouteResult,
  expectedSkillId: Stage2SkillId,
): boolean {
  if (!isSkillWorkflowEnhancementEnabled()) return false
  if (route.source !== 'llm') return false
  if (route.skill?.skillId !== expectedSkillId) return false
  return (route.confidence ?? 0) >= getSkillWorkflowConfidenceThreshold()
}

export function shouldRunTicketWorkflowFromRoute(
  route: SkillRouteResult,
  message: string,
  hasPurchaseSession: boolean,
): boolean {
  if (hasPurchaseSession) return true
  if (route.skill?.skillId !== 'ticket_purchase') return false
  return isTicketPurchaseIntent(message) || isLlmWorkflowEntry(route, 'ticket_purchase')
}

export function shouldRunTravelGuideWorkflowFromRoute(
  route: SkillRouteResult,
  message: string,
): boolean {
  if (route.skill?.skillId !== 'travel_guide') return false
  return shouldRunTravelGuideWorkflow(message) || isLlmWorkflowEntry(route, 'travel_guide')
}

export function shouldRunOrderQueryWorkflowFromRoute(
  route: SkillRouteResult,
  message: string,
): boolean {
  if (route.skill?.skillId !== 'order_query') return false
  return shouldRunOrderQueryWorkflow(message) || isLlmWorkflowEntry(route, 'order_query')
}

export function shouldRunParkingPayWorkflowFromRoute(
  route: SkillRouteResult,
  message: string,
): boolean {
  if (route.skill?.skillId !== 'parking_pay') return false
  return shouldRunParkingPayWorkflow(message) || isLlmWorkflowEntry(route, 'parking_pay')
}

export function shouldRunShowScheduleWorkflowFromRoute(
  route: SkillRouteResult,
  message: string,
): boolean {
  if (route.skill?.skillId !== 'scenic_recommend') return false
  return shouldRunShowScheduleWorkflow(message) || isLlmWorkflowEntry(route, 'scenic_recommend')
}

export function shouldRunInvoiceWorkflowFromRoute(
  route: SkillRouteResult,
  message: string,
): boolean {
  if (route.skill?.skillId !== 'invoice_service') return false
  return shouldRunInvoiceWorkflow(message) || isLlmWorkflowEntry(route, 'invoice_service')
}

export function shouldRunReviewWorkflowFromRoute(
  route: SkillRouteResult,
  message: string,
): boolean {
  if (route.skill?.skillId !== 'review_service') return false
  return shouldRunReviewWorkflow(message) || isLlmWorkflowEntry(route, 'review_service')
}

export function shouldRunProactiveMarketingWorkflowFromRoute(
  route: SkillRouteResult,
  message: string,
): boolean {
  if (route.skill?.skillId !== 'proactive_marketing') return false
  return (
    shouldRunProactiveMarketingWorkflow(message) ||
    isLlmWorkflowEntry(route, 'proactive_marketing')
  )
}
