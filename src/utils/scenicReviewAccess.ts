import type { Order } from '../types'
import { qualifiesReviewReward } from './reviewForm'

export const REVIEW_SHARE_CHANNELS = [
  { key: 'wechat_moments', label: '朋友圈' },
  { key: 'xiaohongshu', label: '小红书' },
  { key: 'douyin', label: '抖音' },
  { key: 'dianping', label: '大众点评' },
] as const

export type ReviewShareChannelKey = (typeof REVIEW_SHARE_CHANNELS)[number]['key']

export const REVIEW_SHARE_DEMO_TOAST =
  '根据接口规则进行分享跳转并记录分享成功'

export const REVIEW_RECOMMEND_ACTIVITY_MAX = 5

/** 演示：已核销订单 ≈ 已核销票/单 */
export function hasVerifiedVisitSignal(orders: Order[]): boolean {
  return orders.some((order) => order.status === 'completed')
}

/**
 * 点评准入（OR）：已核销订单 ∨ 已核销票夹（演示同 completed）∨ 在园（含自报）。
 * 日限「今日是否已评」由服务端/运行时另判。
 */
export function canAccessScenicReview(input: {
  orders: Order[]
  inPark: boolean
}): boolean {
  if (input.inPark) return true
  return hasVerifiedVisitSignal(input.orders)
}

export function isQualityEligibleForReviewReward(
  content: string,
  imageCount: number,
): boolean {
  return qualifiesReviewReward(content, imageCount)
}

export function scenicDayKey(now = new Date()): string {
  // 演示近似景区时区自然日（正式按景区 TZ）
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
