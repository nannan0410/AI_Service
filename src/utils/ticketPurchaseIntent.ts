import { isTravelGuidePreferredOverTicket } from '@/utils/travelGuideIntent'
import { shouldRunNewGuestCouponWorkflow } from '@/ai/workflow/newGuestCoupon'
import { shouldRunOrderQueryWorkflow } from '@/utils/orderQueryIntent'
import { shouldRunInvoiceWorkflow } from '@/utils/invoiceIntent'
import { shouldRunReviewWorkflow } from '@/utils/reviewIntent'
import { shouldRunParkingPayWorkflow } from '@/utils/parkingPayIntent'
import { shouldRunProactiveMarketingWorkflow } from '@/utils/proactiveMarketingIntent'
import { shouldRunShowScheduleWorkflow } from '@/utils/showScheduleIntent'
import { shouldRunCheckinWorkflow } from '@/utils/checkinIntent'
import { shouldRunQueueRecommendWorkflow } from '@/utils/queueRecommendIntent'

export { isTravelGuidePreferredOverTicket } from '@/utils/travelGuideIntent'

/** 门票使用 / 入园时间等 FAQ，应走攻略而非购票 */
export function isTicketUsageOrEntryFaqIntent(message: string): boolean {
  const text = message.trim()
  if (!text) return false
  return (
    /门票怎么用|门票如何使用|门票.*(?:怎么|如何)使用|怎么使用门票|如何使用门票/.test(
      text,
    ) ||
    /几点可以入园|几点入园|何时入园|什么时候可以入园|入园几点/.test(text)
  )
}

/** 明确购票入口说法（冷启动）；人数/日期仅在会话内由 Workflow 解析，不在此判定 */
export function shouldRunTicketWorkflow(message: string): boolean {
  const text = message.trim()
  if (!text || isTicketUsageOrEntryFaqIntent(text)) return false
  if (isTravelGuidePreferredOverTicket(text)) return false

  return (
    /两大一小|2大1小|买票|购票|套票|家庭票|年卡|首次购票|购票指引/.test(text) ||
    /(?:买|购|订).{0,6}门票|门票.{0,6}(?:买|购|订)/.test(text)
  )
}

/**
 * 冷启动是否进入购票 Workflow。
 * 不再用「小孩/周末/出行」等人数日期启发式，避免误抢攻略/演出/闲聊。
 */
export function isTicketPurchaseIntent(message: string): boolean {
  const text = message.trim()
  if (!text || isTravelGuidePreferredOverTicket(text)) return false
  return shouldRunTicketWorkflow(text)
}

export function isTicketConfirmIntent(message: string): boolean {
  return /确认|就这个|可以|没问题|生成订单/.test(message)
}

/** 明确其它业务意图：应结束购票会话，避免续跑劫持 */
export function shouldInterruptPurchaseSession(message: string): boolean {
  const text = message.trim()
  if (!text) return false
  return (
    isTravelGuidePreferredOverTicket(text) ||
    shouldRunProactiveMarketingWorkflow(text) ||
    shouldRunParkingPayWorkflow(text) ||
    shouldRunOrderQueryWorkflow(text) ||
    shouldRunShowScheduleWorkflow(text) ||
    shouldRunInvoiceWorkflow(text) ||
    shouldRunReviewWorkflow(text) ||
    shouldRunCheckinWorkflow(text) ||
    shouldRunQueueRecommendWorkflow(text) ||
    shouldRunNewGuestCouponWorkflow(text)
  )
}
