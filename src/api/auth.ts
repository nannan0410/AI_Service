import request from './request'
import type { ApiResponse, AuthResult, PersonaId, UserInfo } from '@/types'

export function wechatMockLogin(personaId: PersonaId) {
  return request.post<ApiResponse<AuthResult>>('/api/auth/wechat/mock', { personaId })
}

export function fetchMe() {
  return request.get<ApiResponse<UserInfo>>('/api/auth/me')
}

export function logout() {
  return request.post<ApiResponse<boolean>>('/api/auth/logout')
}
