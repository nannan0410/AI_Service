import type {
  ChatMessageDraft,
  SceneRecommendPayload,
  TicketCardPayload,
} from '@/types'
import { isCouponRecommendPayload } from '@/utils/couponRecommend'

/** 同框子卡级联间隔（毫秒） */
export const ASSISTANT_CARD_CASCADE_GAP_MS = 450

/**
 * 一条卡片消息内可逐条揭示的子卡数量。
 * scene_recommend：券 + 各活动 + 答题邀请
 * coupon 推荐列表：各券
 * ticket + offerCoupon：营销券 + 票卡
 * 其它：1（整卡一次出完）
 */
export function countCardRevealSlots(card: ChatMessageDraft): number {
  if (card.type === 'scene_recommend' && card.payload) {
    const payload = card.payload as SceneRecommendPayload
    return (
      (payload.coupon ? 1 : 0) +
      (payload.activities?.length ?? 0) +
      (payload.quizInvite ? 1 : 0)
    )
  }
  if (card.type === 'coupon' && isCouponRecommendPayload(card.payload)) {
    return card.payload.items.length
  }
  if (card.type === 'ticket' && card.payload) {
    const payload = card.payload as TicketCardPayload
    return payload.offerCoupon ? 2 : 1
  }
  return 1
}

/** undefined / 未设置 = 全部展示（历史消息） */
export function resolveRevealCount(
  revealCount: number | undefined,
  totalSlots: number,
): number {
  if (revealCount == null) return totalSlots
  return Math.max(0, Math.min(revealCount, totalSlots))
}
