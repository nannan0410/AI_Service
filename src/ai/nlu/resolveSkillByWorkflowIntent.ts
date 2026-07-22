import { getSkillById } from '@/ai/skills/router'
import { shouldRunNewGuestCouponWorkflow } from '@/ai/workflow/newGuestCoupon'
import { shouldRunOrderQueryWorkflow } from '@/utils/orderQueryIntent'
import { shouldRunInvoiceWorkflow } from '@/utils/invoiceIntent'
import { shouldRunReviewWorkflow } from '@/utils/reviewIntent'
import { shouldRunCheckinWorkflow } from '@/utils/checkinIntent'
import { shouldRunQueueRecommendWorkflow } from '@/utils/queueRecommendIntent'
import { shouldRunParkingPayWorkflow } from '@/utils/parkingPayIntent'
import { shouldRunProactiveMarketingWorkflow } from '@/utils/proactiveMarketingIntent'
import { shouldRunMemberOfferWorkflow } from '@/utils/memberOfferIntent'
import { shouldRunShowScheduleWorkflow } from '@/utils/showScheduleIntent'
import { shouldRunStarIntroWorkflow } from '@/utils/starIntent'
import {
  isTicketPurchaseIntent,
} from '@/utils/ticketPurchaseIntent'
import {
  isTravelGuidePreferredOverTicket,
  shouldRunTravelGuideWorkflow,
} from '@/utils/travelGuideIntent'
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
  // 入园 FAQ / 游玩推荐等优先于购票（避免「门票怎么用」误进选票）
  if (isTravelGuidePreferredOverTicket(message)) {
    return getSkillById(skills, 'travel_guide') ?? null
  }
  if (isTicketPurchaseIntent(message)) {
    return getSkillById(skills, 'ticket_purchase') ?? null
  }
  // 会员权益选品优先于泛查券营销
  if (shouldRunMemberOfferWorkflow(message)) {
    return getSkillById(skills, 'member_offer') ?? null
  }
  // 餐饮/零售/查券营销优先于宽泛攻略，避免美食询问落到 LLM 闲聊
  if (shouldRunProactiveMarketingWorkflow(message)) {
    return getSkillById(skills, 'proactive_marketing') ?? null
  }
  // 虚拟排队优先于园内路线攻略
  if (shouldRunQueueRecommendWorkflow(message)) {
    return getSkillById(skills, 'queue_recommend') ?? null
  }
  // 动物明星介绍优先于演出场次
  if (shouldRunStarIntroWorkflow(message)) {
    return getSkillById(skills, 'scenic_recommend') ?? null
  }
  // 演出项目 / 场次查询优先于宽泛游玩攻略（避免「演出项目推荐」进订单攻略）
  if (shouldRunShowScheduleWorkflow(message)) {
    return getSkillById(skills, 'scenic_recommend') ?? null
  }
  if (shouldRunTravelGuideWorkflow(message)) {
    return getSkillById(skills, 'travel_guide') ?? null
  }
  if (shouldRunOrderQueryWorkflow(message)) {
    return getSkillById(skills, 'order_query') ?? null
  }
  if (shouldRunInvoiceWorkflow(message)) {
    return getSkillById(skills, 'invoice_service') ?? null
  }
  if (shouldRunCheckinWorkflow(message)) {
    return getSkillById(skills, 'checkin_service') ?? null
  }
  if (shouldRunReviewWorkflow(message)) {
    return getSkillById(skills, 'review_service') ?? null
  }

  return null
}

export function shouldSkipLlmSkillRouting(message: string): boolean {
  if (shouldRunNewGuestCouponWorkflow(message)) return true
  if (shouldRunParkingPayWorkflow(message)) return true
  if (isTravelGuidePreferredOverTicket(message)) return true
  if (isTicketPurchaseIntent(message)) return true
  if (shouldRunMemberOfferWorkflow(message)) return true
  if (shouldRunProactiveMarketingWorkflow(message)) return true
  if (shouldRunStarIntroWorkflow(message)) return true
  if (shouldRunShowScheduleWorkflow(message)) return true
  if (shouldRunTravelGuideWorkflow(message)) return true
  if (shouldRunOrderQueryWorkflow(message)) return true
  if (shouldRunInvoiceWorkflow(message)) return true
  if (shouldRunCheckinWorkflow(message)) return true
  if (shouldRunQueueRecommendWorkflow(message)) return true
  if (shouldRunReviewWorkflow(message)) return true
  return false
}
