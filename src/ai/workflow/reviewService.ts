import { fetchOrders } from '@/api/business'
import { filterReviewableOrders } from '@/utils/reviewableOrders'
import { shouldRunReviewWorkflow } from '@/utils/reviewIntent'
import type {
  LlmChatResult,
  Order,
  ReviewCardPayload,
  ToolExecutionCallbacks,
} from '@/types'

export { shouldRunReviewWorkflow }

function sortReviewableDesc(orders: Order[]): Order[] {
  return [...orders].sort((a, b) => {
    const ta = a.completedAt ? new Date(a.completedAt).getTime() : 0
    const tb = b.completedAt ? new Date(b.completedAt).getTime() : 0
    return tb - ta
  })
}

function buildReviewCardPayload(orders: Order[]): ReviewCardPayload {
  const sorted = sortReviewableDesc(orders)
  return {
    cardId: `review_${Date.now()}`,
    defaultOrderId: sorted[0]?.orderId,
    orders: sorted.map((order) => ({
      orderId: order.orderId,
      ticketName: order.ticketName,
      visitDate: order.visitDate,
      completedAt: order.completedAt,
      totalAmount: order.totalAmount,
    })),
  }
}

export async function runReviewServiceWorkflow(
  _message: string,
  callbacks?: ToolExecutionCallbacks,
): Promise<LlmChatResult> {
  callbacks?.onToolStart?.('getOrders', '查询可评价订单')
  let orders: Order[] = []
  try {
    const { data: res } = await fetchOrders()
    callbacks?.onToolDone?.('getOrders', res.code === 200)
    if (res.code === 200) orders = res.data
  } catch {
    callbacks?.onToolDone?.('getOrders', false)
    return {
      content: '暂时无法查询订单，请稍后再试。',
      skillId: 'review_service',
      toolCallsUsed: ['getOrders'],
    }
  }

  const reviewable = filterReviewableOrders(orders)
  if (!reviewable.length) {
    return {
      content:
        '您当前暂无已完成且未评价的订单。游玩结束后再来分享体验吧～可先前往「我的订单」确认订单状态。',
      skillId: 'review_service',
      toolCallsUsed: ['getOrders'],
    }
  }

  const count = reviewable.length
  const caption =
    count === 1
      ? `为您找到 1 笔可评价订单（${reviewable[0].ticketName}），请在下方填写评价。`
      : `为您找到 ${count} 笔可评价订单，请选择订单并在下方填写评价（每笔订单仅可评价一次）。`

  return {
    content: '',
    skillId: 'review_service',
    toolCallsUsed: ['getOrders'],
    cards: [
      {
        type: 'review',
        role: 'assistant',
        content: caption,
        payload: buildReviewCardPayload(reviewable),
      },
    ],
  }
}
