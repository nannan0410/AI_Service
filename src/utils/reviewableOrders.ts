import type { Order } from '@/types'

const REVIEW_WINDOW_MS = 90 * 24 * 60 * 60 * 1000

function orderReviewStatus(order: Order): 'none' | 'submitted' {
  return order.reviewStatus ?? 'none'
}

/** 90 天内已完成且未提交评价的订单 */
export function filterReviewableOrders(orders: Order[], now = Date.now()): Order[] {
  return orders.filter((order) => {
    if (order.status !== 'completed' || orderReviewStatus(order) !== 'none') return false
    const completed = order.completedAt ? new Date(order.completedAt).getTime() : 0
    return completed > 0 && now - completed <= REVIEW_WINDOW_MS
  })
}

/** 取最近一笔可评价订单（按完成时间倒序） */
export function pickLatestReviewableOrder(orders: Order[], now = Date.now()): Order | null {
  const reviewable = filterReviewableOrders(orders, now)
  if (!reviewable.length) return null
  return [...reviewable].sort((a, b) => {
    const ta = a.completedAt ? new Date(a.completedAt).getTime() : 0
    const tb = b.completedAt ? new Date(b.completedAt).getTime() : 0
    return tb - ta
  })[0]
}
