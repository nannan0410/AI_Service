/** 服务点评快捷标签（对话卡 / 假页共用） */
export const REVIEW_TAG_OPTIONS = [
  '服务态度好',
  '设施完善',
  '性价比高',
  '排队体验佳',
  '交通便利',
  '餐饮不错',
  '演出精彩',
  '排队时间长',
  '人多拥挤',
] as const

export const REVIEW_CONTENT_MAX = 200

/** 优质评价奖励：文案 > 20 字且图片 ≥ 2 张 */
export const REVIEW_REWARD_MIN_CONTENT = 20
export const REVIEW_REWARD_MIN_IMAGES = 2

export function qualifiesReviewReward(content: string, imageCount: number): boolean {
  return content.trim().length > REVIEW_REWARD_MIN_CONTENT && imageCount >= REVIEW_REWARD_MIN_IMAGES
}
