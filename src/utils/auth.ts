import { AUTH_TOKEN_KEY, AUTH_USER_KEY } from './storageKeys'
import type { UserInfo } from '@/types'

export function getToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY)
}

export function getAuthUser(): UserInfo | null {
  const raw = localStorage.getItem(AUTH_USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as UserInfo
  } catch {
    return null
  }
}

export function setAuthUser(user: UserInfo): void {
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user))
}

export function clearAuthUser(): void {
  localStorage.removeItem(AUTH_USER_KEY)
}

export function clearAuth(): void {
  clearToken()
  clearAuthUser()
}

export function parsePersonaFromToken(token: string): string | null {
  const match = token.match(/^mock_token_(demo_(?:new|mid|vip))_/)
  return match?.[1] ?? null
}
