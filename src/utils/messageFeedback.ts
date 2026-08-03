import type { ChatMessage, FavoriteRecord } from '@/types'

const SNIPPET_MAX = 160

export function buildAssistantSnippet(message: Pick<ChatMessage, 'content' | 'type'>): string {
  const text = message.content?.trim()
  if (text) {
    return text.length > SNIPPET_MAX ? `${text.slice(0, SNIPPET_MAX)}…` : text
  }
  return messageTypeLabel(message.type)
}

export function messageTypeLabel(type: string): string {
  const map: Record<string, string> = {
    text: '文本回复',
    ticket: '门票推荐',
    ticket_confirm: '订单确认',
    ticket_fallback: '购票兜底',
    coupon: '优惠券',
    order: '订单',
    guide: '游玩攻略',
    content: '内容卡片',
    activity: '项目推荐',
    scene_recommend: '演出/场景推荐',
    star_intro: '明星介绍',
    quiz: '答题',
    page_guide: '页面引导',
    map_action: '地图导航',
    review: '服务点评',
    visitor_pick: '选择游客',
    system: '系统消息',
  }
  return map[type] ?? type
}

export function buildPayloadSummary(message: ChatMessage): string | undefined {
  const payload = message.payload
  if (!payload || typeof payload !== 'object') return undefined
  const record = payload as Record<string, unknown>
  if (typeof record.ticketName === 'string') return record.ticketName
  if (typeof record.title === 'string') return record.title
  if (typeof record.name === 'string') return record.name
  if (Array.isArray(record.activities) && record.activities.length) {
    const first = record.activities[0] as { name?: string }
    return first?.name
      ? `${first.name} 等 ${record.activities.length} 项`
      : `${record.activities.length} 个项目`
  }
  if (Array.isArray(record.items) && record.items.length) {
    return `${record.items.length} 张优惠券`
  }
  return undefined
}

export function buildFavoriteRecord(options: {
  message: ChatMessage
  scenicId?: string | null
  scenicName?: string
}): FavoriteRecord {
  const { message, scenicId, scenicName } = options
  return {
    favoriteId: `fav_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    messageId: message.id,
    createdAt: new Date().toISOString(),
    scenicId,
    scenicName,
    messageType: message.type,
    contentSnippet: buildAssistantSnippet(message),
    payloadSummary: buildPayloadSummary(message),
    skillId: message.feedbackMeta?.skillId,
    userText: message.feedbackMeta?.userText,
    routeSource: message.feedbackMeta?.routeSource,
  }
}
