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
} as const
