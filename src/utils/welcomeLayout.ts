/** 欢迎页快捷服务（原「为您推荐」）展示上限 */
export const MAX_QUICK_SERVICES = 4

/** 游游推荐（原「猜你想问」）展示上限 */
export const MAX_WELCOME_RECOMMEND = 8

/** 游游推荐默认展示条数，其余「查看更多」展开 */
export const WELCOME_RECOMMEND_VISIBLE = 3

/** Hero 气泡能力文案（2×2） */
export const DEFAULT_ABILITY_ROWS: readonly (readonly [string, string])[] = [
  ['快速购票', '领取专属优惠'],
  ['查询排队', '规划游玩路线'],
] as const

/** 欢迎态 AI 状态条轮播文案 */
export const WELCOME_AI_STATUS_LINES = [
  '✨ 游游正在了解景区实时信息',
  '🌤 已同步天气和景区动态',
  '🎭 已获取今日演出安排',
  '🎫 已同步门票与优惠资讯',
] as const
