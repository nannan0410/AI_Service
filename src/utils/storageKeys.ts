export const AUTH_TOKEN_KEY = 'scenic_auth_token'
export const AUTH_USER_KEY = 'scenic_auth_user'

export function storageKey(userId: string, suffix: string): string {
  return `scenic_${userId}_${suffix}`
}

export const STORAGE_SUFFIX = {
  CHAT: 'chat_messages',
  VISITOR: 'visitor_state',
  ORDERS: 'orders',
  RECEIPTS: 'receipt_records',
  LAST_SCENIC_ID: 'last_scenic_id',
  LAST_CITY_ID: 'last_city_id',
  CONVERSATION: 'conversation',
  /** 收藏快照（与聊天分桶，清聊天不清收藏） */
  FAVORITES: 'message_favorites',
  /** 赞/踩/收藏结构化事件（演示本地；正式版应上报服务端） */
  FEEDBACK_EVENTS: 'message_feedback_events',
} as const

/** 按景区分桶的聊天记录 suffix */
export function chatStorageSuffix(scenicId: string): string {
  return `${STORAGE_SUFFIX.CHAT}_${scenicId}`
}
