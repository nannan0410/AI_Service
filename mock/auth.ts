import type { MockMethod } from 'vite-plugin-mock'
import {
  bindPlate,
  createToken,
  getSnapshot,
  getUserInfo,
  parsePersonaFromAuthHeader,
} from './_utils'
import type { PersonaId } from '../src/types/index'

function requirePersona(headers: Record<string, unknown>): PersonaId | null {
  const auth = headers.authorization as string | undefined
  return parsePersonaFromAuthHeader(auth)
}

export default [
  {
    url: '/api/auth/wechat/mock',
    method: 'post',
    response: ({ body }: { body: { personaId?: PersonaId } }) => {
      const personaId = body?.personaId
      if (!personaId || !['demo_new', 'demo_mid', 'demo_vip'].includes(personaId)) {
        return { code: 400, message: '无效的演示账号', data: null }
      }
      const token = createToken(personaId)
      return {
        code: 200,
        data: {
          token,
          userInfo: getUserInfo(personaId),
        },
      }
    },
  },
  {
    url: '/api/auth/me',
    method: 'get',
    response: ({ headers }: { headers: Record<string, unknown> }) => {
      const personaId = requirePersona(headers)
      if (!personaId) {
        return { code: 401, message: '未登录', data: null }
      }
      return { code: 200, data: getUserInfo(personaId) }
    },
  },
  {
    url: '/api/auth/logout',
    method: 'post',
    response: () => ({ code: 200, data: true, message: '已登出' }),
  },
  {
    url: '/api/member/info',
    method: 'get',
    response: ({ headers }: { headers: Record<string, unknown> }) => {
      const personaId = requirePersona(headers)
      if (!personaId) return { code: 401, message: '未登录', data: null }
      return { code: 200, data: getSnapshot(personaId).memberInfo }
    },
  },
  {
    url: '/api/member/plate',
    method: 'get',
    response: ({ headers }: { headers: Record<string, unknown> }) => {
      const personaId = requirePersona(headers)
      if (!personaId) return { code: 401, message: '未登录', data: null }
      const { boundPlateNo } = getSnapshot(personaId).visitorState
      return { code: 200, data: { plateNo: boundPlateNo } }
    },
  },
  {
    url: '/api/member/plate/bind',
    method: 'post',
    response: ({
      headers,
      body,
    }: {
      headers: Record<string, unknown>
      body: { plateNo?: string }
    }) => {
      const personaId = requirePersona(headers)
      if (!personaId) return { code: 401, message: '未登录', data: null }
      const plateNo = body?.plateNo?.trim()
      if (!plateNo) return { code: 400, message: '请输入车牌号', data: null }
      const result = bindPlate(personaId, plateNo)
      if (!result.ok) return { code: 409, message: result.message, data: null }
      return { code: 200, data: { plateNo }, message: '绑定成功' }
    },
  },
] as MockMethod[]
