import { issueCoupon } from '@/api/business'
import {
  buildNewGuestCouponChatResult,
  type ToolCallRecord,
} from '@/ai/tools/formatters'
import {
  isNewGuestCouponClaimIntent,
  NEW_GUEST_COUPON_COPY,
  NEW_GUEST_COUPON_PRODUCT_ID,
  formatClaimWindowExpiredCopy,
} from '@/utils/newGuestCoupon'
import type { Coupon, LlmChatResult, ToolExecutionCallbacks } from '@/types'

export function shouldRunNewGuestCouponWorkflow(message: string): boolean {
  return isNewGuestCouponClaimIntent(message)
}

export async function runNewGuestCouponWorkflow(
  _message: string,
  callbacks?: ToolExecutionCallbacks,
): Promise<LlmChatResult> {
  const toolRecords: ToolCallRecord[] = []

  callbacks?.onToolStart?.('issueCoupon', '领取新客专享券')
  try {
    const { data: res } = await issueCoupon(NEW_GUEST_COUPON_PRODUCT_ID, 'claim')

    if (res.code !== 200 || !res.data) {
      callbacks?.onToolDone?.('issueCoupon', false)
      if (res.message === 'NOT_ELIGIBLE_PERSONA') {
        return {
          content: NEW_GUEST_COUPON_COPY.notEligiblePersona,
          skillId: null,
          toolCallsUsed: ['issueCoupon'],
        }
      }
      if (res.message === 'CLAIM_WINDOW_EXPIRED') {
        return {
          content: formatClaimWindowExpiredCopy(),
          skillId: null,
          toolCallsUsed: ['issueCoupon'],
        }
      }
      throw new Error(res.message || '领券失败')
    }

    toolRecords.push({ name: 'issueCoupon', result: { success: true, data: res.data } })
    callbacks?.onToolDone?.('issueCoupon', true)

    return {
      ...buildNewGuestCouponChatResult(res.data as Coupon, res.message),
      skillId: null,
      toolCallsUsed: toolRecords.map((item) => item.name),
    }
  } catch (error) {
    callbacks?.onToolDone?.('issueCoupon', false)
    const message = error instanceof Error ? error.message : '领券失败'
    if (/404|Network Error|Failed to fetch/i.test(message)) {
      throw new Error('领券服务暂不可用，请确认开发服务已启动并已重启（Mock 接口未加载）')
    }
    throw error instanceof Error ? error : new Error(message)
  }
}
