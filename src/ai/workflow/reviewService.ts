import { fetchOrders, fetchReviewEligibility, fetchReviewRecommendActivities } from '@/api/business'
import { shouldRunReviewWorkflow } from '@/utils/reviewIntent'
import { useScenicStore } from '@/store/scenicStore'
import type {
  LlmChatResult,
  ReviewCardPayload,
  ToolExecutionCallbacks,
} from '@/types'

export { shouldRunReviewWorkflow }

export async function runReviewServiceWorkflow(
  _message: string,
  callbacks?: ToolExecutionCallbacks,
  options?: { inPark?: boolean },
): Promise<LlmChatResult> {
  const scenicStore = useScenicStore()
  const scenicId = scenicStore.currentScenicId
  const scenicName = scenicStore.currentScenicName || '景区'

  callbacks?.onToolStart?.('getReviewEligibility', '确认今日是否可点评')
  let eligibility: Awaited<
    ReturnType<typeof fetchReviewEligibility>
  >['data']['data'] | null = null
  try {
    const { data: res } = await fetchReviewEligibility({
      inPark: options?.inPark,
    })
    callbacks?.onToolDone?.('getReviewEligibility', res.code === 200)
    if (res.code === 200) eligibility = res.data
  } catch {
    callbacks?.onToolDone?.('getReviewEligibility', false)
  }

  // 客户端自报在园：服务端快照可能仍为 false，用本地覆盖准入
  if (eligibility && !eligibility.canReview && options?.inPark && !eligibility.reviewedToday) {
    eligibility = {
      ...eligibility,
      canReview: true,
      reason: undefined,
    }
  }

  if (!eligibility?.canReview) {
    // 兜底：拉订单看是否有已核销
    callbacks?.onToolStart?.('getOrders', '查询游园凭证')
    try {
      const { data: res } = await fetchOrders()
      callbacks?.onToolDone?.('getOrders', res.code === 200)
      const hasCompleted =
        res.code === 200 && res.data.some((o) => o.status === 'completed')
      if (!hasCompleted && !options?.inPark) {
        return {
          content:
            eligibility?.reason ||
            '点评需在园内，或持有已核销订单/门票。可先在欢迎页确认在园状态哦～',
          skillId: 'review_service',
          toolCallsUsed: ['getReviewEligibility', 'getOrders'],
        }
      }
      if (eligibility?.reviewedToday) {
        return {
          content: eligibility.reason || '今天已经点评过啦，明天再来分享体验吧～',
          skillId: 'review_service',
          toolCallsUsed: ['getReviewEligibility'],
        }
      }
    } catch {
      callbacks?.onToolDone?.('getOrders', false)
      return {
        content: eligibility?.reason || '暂时无法确认点评资格，请稍后再试。',
        skillId: 'review_service',
        toolCallsUsed: ['getReviewEligibility'],
      }
    }
  }

  if (eligibility?.reviewedToday) {
    return {
      content: eligibility.reason || '今天已经点评过啦，明天再来分享体验吧～',
      skillId: 'review_service',
      toolCallsUsed: ['getReviewEligibility'],
    }
  }

  callbacks?.onToolStart?.('getReviewActivities', '加载可推荐项目')
  let recommendActivities: ReviewCardPayload['recommendActivities'] = []
  try {
    const { data: res } = await fetchReviewRecommendActivities()
    callbacks?.onToolDone?.('getReviewActivities', res.code === 200)
    if (res.code === 200) recommendActivities = res.data
  } catch {
    callbacks?.onToolDone?.('getReviewActivities', false)
  }

  const payload: ReviewCardPayload = {
    cardId: `review_${Date.now()}`,
    scenicId: scenicId || undefined,
    scenicName,
    recommendActivities,
  }

  return {
    content: '',
    skillId: 'review_service',
    toolCallsUsed: ['getReviewEligibility', 'getReviewActivities'],
    cards: [
      {
        type: 'review',
        role: 'assistant',
        content: `欢迎为「${scenicName}」留下今日游园点评～写满 20 字并上传至少 2 张图后，分享到社交平台可领优质评价礼。`,
        payload,
      },
    ],
  }
}
