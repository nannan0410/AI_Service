import { AUTH_TOKEN_KEY, AUTH_USER_KEY } from './storageKeys'
import type { UserInfo } from '@/types'

/** 演示登录按标签页隔离；顺带清掉旧的跨标签 localStorage 登录态 */
function clearLegacyLocalAuth(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY)
  localStorage.removeItem(AUTH_USER_KEY)
}

clearLegacyLocalAuth()

export function getToken(): string | null {
  return sessionStorage.getItem(AUTH_TOKEN_KEY)
}

export function setToken(token: string): void {
  sessionStorage.setItem(AUTH_TOKEN_KEY, token)
}

export function clearToken(): void {
  sessionStorage.removeItem(AUTH_TOKEN_KEY)
}

export function getAuthUser(): UserInfo | null {
  const raw = sessionStorage.getItem(AUTH_USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as UserInfo
  } catch {
    return null
  }
}

export function setAuthUser(user: UserInfo): void {
  sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(user))
}

export function clearAuthUser(): void {
  sessionStorage.removeItem(AUTH_USER_KEY)
}

export function clearAuth(): void {
  clearToken()
  clearAuthUser()
  clearLegacyLocalAuth()
}

export function parsePersonaFromToken(token: string): string | null {
  const match = token.match(/^mock_token_(demo_(?:new|mid|vip))_/)
  return match?.[1] ?? null
}
