import { fetchCoupons } from '@/api/business'
import { shouldRunProactiveMarketingWorkflow } from '@/utils/proactiveMarketingIntent'
import { buildCouponQueryRecommendResult } from '@/utils/couponRecommend'
import type { LlmChatResult, ToolExecutionCallbacks } from '@/types'

export { shouldRunProactiveMarketingWorkflow }

export async function runProactiveMarketingWorkflow(
  _message: string,
  callbacks?: ToolExecutionCallbacks,
): Promise<LlmChatResult> {
  callbacks?.onToolStart?.('getCoupons', '查询可用优惠')
  try {
    const { data: res } = await fetchCoupons()
    callbacks?.onToolDone?.('getCoupons', res.code === 200)
    if (res.code !== 200) {
      return {
        content: '暂时无法获取优惠信息，请稍后在「优惠券」页查看。',
        skillId: 'proactive_marketing',
        toolCallsUsed: ['getCoupons'],
      }
    }

    const recommend = await buildCouponQueryRecommendResult(res.data)
    return {
      ...recommend,
      skillId: 'proactive_marketing',
      toolCallsUsed: ['getCoupons'],
    }
  } catch {
    callbacks?.onToolDone?.('getCoupons', false)
    return {
      content: '暂时无法获取优惠信息，请稍后在「优惠券」页查看。',
      skillId: 'proactive_marketing',
      toolCallsUsed: ['getCoupons'],
    }
  }
}
