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
} as const

/** 按景区分桶的聊天记录 suffix */
export function chatStorageSuffix(scenicId: string): string {
  return `${STORAGE_SUFFIX.CHAT}_${scenicId}`
}
