import type { AuthResult, PersonaId, UserInfo } from '@/types'

const DEMO_USERS: Record<PersonaId, UserInfo> = {
  demo_new: { memberId: '10001', personaId: 'demo_new', nickname: '新用户小明' },
  demo_mid: { memberId: '10002', personaId: 'demo_mid', nickname: '中级会员小红' },
  demo_vip: { memberId: '10003', personaId: 'demo_vip', nickname: '高级会员老王' },
}

export function isDemoPersonaId(value: string): value is PersonaId {
  return value === 'demo_new' || value === 'demo_mid' || value === 'demo_vip'
}

/** 与 mock/_utils createToken 格式一致，供 Mock 不可用时本地演示登录 */
export function createDemoAuthResult(personaId: PersonaId): AuthResult {
  return {
    token: `mock_token_${personaId}_${Date.now()}`,
    userInfo: { ...DEMO_USERS[personaId] },
  }
}

export function parsePersonaFromToken(token: string): PersonaId | null {
  const match = token.match(/^mock_token_(demo_(?:new|mid|vip))_/)
  return (match?.[1] as PersonaId) ?? null
}

export function getDemoUserInfo(personaId: PersonaId): UserInfo {
  return { ...DEMO_USERS[personaId] }
}
