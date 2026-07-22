import type { MockMethod } from 'vite-plugin-mock'
import { parsePersonaFromAuthHeader } from './_utils'

type ConversationBody = {
  scenicId?: string
  forceNew?: boolean
  conversationId?: string
}

/** 演示版：会话由前端 LocalStorage 权威管理；本接口仅便于联调/验收 Header */
export default [
  {
    url: '/api/conversation',
    method: 'post',
    response: ({
      headers,
      body,
    }: {
      headers: Record<string, unknown>
      body: ConversationBody
    }) => {
      const personaId = parsePersonaFromAuthHeader(headers.authorization as string | undefined)
      if (!personaId) {
        return { code: 401, message: '请先登录演示账号', data: null }
      }
      const scenicId =
        (typeof body?.scenicId === 'string' && body.scenicId) ||
        (headers['x-scenic-id'] as string | undefined)
      if (!scenicId) {
        return { code: 400, message: '缺少 scenicId', data: null }
      }
      const now = new Date().toISOString()
      const conversationId =
        !body?.forceNew && typeof body?.conversationId === 'string' && body.conversationId
          ? body.conversationId
          : `conv_mock_${Date.now()}`
      return {
        code: 200,
        data: {
          conversationId,
          scenicId,
          personaId,
          createdAt: now,
          updatedAt: now,
        },
        message: 'ok',
      }
    },
  },
] as MockMethod[]
