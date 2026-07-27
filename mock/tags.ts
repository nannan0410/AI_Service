import type { MockMethod } from 'vite-plugin-mock'
import { getPersonaFromHeaders } from './rules'
import { upsertAiChatTag } from '../src/utils/aiChatTagRuntime'
import type { AiChatPreferenceTagId } from '../src/utils/aiChatTagIntent'
import {
  buildPersonaTagPreview,
  buildUserProfileTags,
  flattenProfileTags,
  getTagCatalog,
  getTagRules,
} from '../src/utils/profileTags'
import type { PersonaId } from '../src/types'

export default [
  {
    url: '/api/tags',
    method: 'get',
    response: () => ({
      code: 200,
      data: getTagCatalog().map((t) => ({
        tagId: t.tagId,
        name: t.name,
        description: t.description,
        category: t.category,
        defaultConfidence: t.defaultConfidence,
      })),
    }),
  },
  {
    url: '/api/member/tags',
    method: 'get',
    response: ({ headers }: { headers: Record<string, unknown> }) => {
      const personaId = getPersonaFromHeaders(headers) as PersonaId | null
      if (!personaId) return { code: 401, message: '未登录', data: null }
      const profile = buildUserProfileTags(personaId)
      const flat = flattenProfileTags(profile)
      return {
        code: 200,
        data: flat.map((t) => ({
          tagId: t.tagId,
          name: t.name,
          description: t.evidence || t.category,
        })),
      }
    },
  },
  {
    url: '/api/member/profile-tags',
    method: 'get',
    response: ({ headers }: { headers: Record<string, unknown> }) => {
      const personaId = getPersonaFromHeaders(headers) as PersonaId | null
      if (!personaId) return { code: 401, message: '未登录', data: null }
      return { code: 200, data: buildUserProfileTags(personaId) }
    },
  },
  {
    url: '/api/member/ai-chat-tags',
    method: 'post',
    response: ({
      headers,
      body,
    }: {
      headers: Record<string, unknown>
      body: { tagId?: string; evidence?: string; confidence?: number }
    }) => {
      const personaId = getPersonaFromHeaders(headers) as PersonaId | null
      if (!personaId) return { code: 401, message: '未登录', data: null }
      const tagId = body?.tagId as AiChatPreferenceTagId | undefined
      if (
        !tagId ||
        !['prefer_thrill', 'prefer_photo', 'prefer_slow'].includes(tagId)
      ) {
        return { code: 400, message: '无效 tagId', data: null }
      }
      const evidence = body?.evidence?.trim() || `对话写回：${tagId}`
      const list = upsertAiChatTag(
        personaId,
        tagId,
        evidence,
        body?.confidence ?? 0.75,
      )
      const profile = buildUserProfileTags(personaId)
      return {
        code: 200,
        data: {
          tags: list,
          profile,
        },
        message: '已更新 AI 偏好标签',
      }
    },
  },
  {
    url: '/api/admin/tag-catalog',
    method: 'get',
    response: () => ({ code: 200, data: getTagCatalog() }),
  },
  {
    url: '/api/admin/tag-rules',
    method: 'get',
    response: () => ({ code: 200, data: getTagRules() }),
  },
  {
    url: '/api/admin/persona-preview',
    method: 'get',
    response: ({ query }: { query: Record<string, string> }) => {
      const personaId = (query.personaId || 'demo_vip') as PersonaId
      if (!['demo_new', 'demo_mid', 'demo_vip'].includes(personaId)) {
        return { code: 400, message: '无效 personaId', data: null }
      }
      return { code: 200, data: buildPersonaTagPreview(personaId) }
    },
  },
] as MockMethod[]
