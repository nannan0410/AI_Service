import { getSkillById } from '@/ai/skills/router'
import { shouldRunNewGuestCouponWorkflow } from '@/ai/workflow/newGuestCoupon'
import { shouldRunOrderQueryWorkflow } from '@/utils/orderQueryIntent'
import { shouldRunInvoiceWorkflow } from '@/utils/invoiceIntent'
import { shouldRunReviewWorkflow } from '@/utils/reviewIntent'
import { shouldRunParkingPayWorkflow } from '@/utils/parkingPayIntent'
import { shouldRunProactiveMarketingWorkflow } from '@/utils/proactiveMarketingIntent'
import { shouldRunShowScheduleWorkflow } from '@/utils/showScheduleIntent'
import { isTicketPurchaseIntent } from '@/utils/ticketPurchaseIntent'
import { shouldRunTravelGuideWorkflow } from '@/utils/travelGuideIntent'
import type { AssistantSkillConfig } from '@/types'

/**
 * 已由代码 Workflow 覆盖的意图：跳过 LLM Skill 分类，避免短句（如「停车费」）卡住。
 */
export function resolveSkillByWorkflowIntent(
  message: string,
  skills: AssistantSkillConfig[],
): AssistantSkillConfig | null {
  if (shouldRunNewGuestCouponWorkflow(message)) return null

  if (shouldRunParkingPayWorkflow(message)) {
    return getSkillById(skills, 'parking_pay') ?? null
  }
  if (isTicketPurchaseIntent(message)) {
    return getSkillById(skills, 'ticket_purchase') ?? null
  }
  if (shouldRunTravelGuideWorkflow(message)) {
    return getSkillById(skills, 'travel_guide') ?? null
  }
  if (shouldRunOrderQueryWorkflow(message)) {
    return getSkillById(skills, 'order_query') ?? null
  }
  if (shouldRunShowScheduleWorkflow(message)) {
    return getSkillById(skills, 'scenic_recommend') ?? null
  }
  if (shouldRunInvoiceWorkflow(message)) {
    return getSkillById(skills, 'invoice_service') ?? null
  }
  if (shouldRunReviewWorkflow(message)) {
    return getSkillById(skills, 'review_service') ?? null
  }
  if (shouldRunProactiveMarketingWorkflow(message)) {
    return getSkillById(skills, 'proactive_marketing') ?? null
  }

  return null
}

export function shouldSkipLlmSkillRouting(message: string): boolean {
  if (shouldRunNewGuestCouponWorkflow(message)) return true
  if (shouldRunParkingPayWorkflow(message)) return true
  if (isTicketPurchaseIntent(message)) return true
  if (shouldRunTravelGuideWorkflow(message)) return true
  if (shouldRunOrderQueryWorkflow(message)) return true
  if (shouldRunShowScheduleWorkflow(message)) return true
  if (shouldRunInvoiceWorkflow(message)) return true
  if (shouldRunReviewWorkflow(message)) return true
  if (shouldRunProactiveMarketingWorkflow(message)) return true
  return false
}
