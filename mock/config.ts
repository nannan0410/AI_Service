import type { MockMethod } from 'vite-plugin-mock'
import uiConfig from '../src/mock/assistant/ui_config.json'
import welcomeTemplates from '../src/mock/assistant/welcome_templates.json'
import recommendEntries from '../src/mock/assistant/recommend_entries.json'
import ticketProducts from '../src/mock/products/tickets.json'
import couponProducts from '../src/mock/products/coupon_products.json'
import retailProducts from '../src/mock/products/retail.json'
import contentBlocks from '../src/mock/content/blocks.json'
import tags from '../src/mock/tags.json'
import virtualQueue from '../src/mock/virtual_queue.json'
import quiz from '../src/mock/quiz.json'
import assistantSkills from '../src/mock/assistant/skills.json'
import fieldCatalog from '../src/mock/assistant/field_catalog.json'
import cardViews from '../src/mock/assistant/card_views.json'
import {
  buildRuleContext,
  evaluateRules,
  getPersonaFromHeaders,
  type RuleExpression,
} from './rules'

interface RecommendEntryRaw {
  entryId: string
  title: string
  icon: string
  target: string
  targetPath?: string
  skillId?: string
  promptHint?: string
  rules: RuleExpression[]
  priority: number
  enabled?: boolean
}

export default [
  {
    url: '/api/assistant/ui',
    method: 'get',
    response: () => ({ code: 200, data: uiConfig }),
  },
  {
    url: '/api/assistant/config',
    method: 'get',
    response: () => ({ code: 200, data: uiConfig }),
  },
  {
    url: '/api/assistant/welcome',
    method: 'get',
    response: ({ headers }: { headers: Record<string, unknown> }) => {
      const personaId = getPersonaFromHeaders(headers)
      if (!personaId) return { code: 401, message: '未登录', data: null }
      const template = welcomeTemplates.find((t) => t.personaId === personaId)
      const ctx = buildRuleContext(personaId)
      const body = template?.body.replace(/\{\{nickname\}\}/g, ctx.nickname) ?? ''
      return {
        code: 200,
        data: {
          ...template,
          body,
          ui: {
            dialogTitle: uiConfig.dialogTitle,
            assistantNickname: uiConfig.assistantNickname,
            assistantAvatarUrl: uiConfig.assistantAvatarUrl,
            defaultImageUrl: uiConfig.defaultImageUrl,
            chatBackgroundUrl: uiConfig.chatBackgroundUrl,
            primaryColor: uiConfig.primaryColor,
            primaryColorLight: uiConfig.primaryColorLight,
            primaryColorDark: uiConfig.primaryColorDark,
            greeting: uiConfig.greeting,
          },
        },
      }
    },
  },
  {
    url: '/api/assistant/recommend-entries',
    method: 'get',
    response: ({ headers }: { headers: Record<string, unknown> }) => {
      const personaId = getPersonaFromHeaders(headers)
      if (!personaId) return { code: 401, message: '未登录', data: null }
      const ctx = buildRuleContext(personaId)
      const list = (recommendEntries as RecommendEntryRaw[])
        .filter((e) => e.enabled !== false)
        .filter((e) => evaluateRules(e.rules, ctx))
        .sort((a, b) => b.priority - a.priority)
        .map(({ entryId, title, icon, target, targetPath, skillId, promptHint, priority }) => ({
          entryId,
          title,
          icon,
          target,
          targetPath,
          skillId,
          promptHint,
          priority,
        }))
      return { code: 200, data: list }
    },
  },
  {
    url: '/api/assistant/skills',
    method: 'get',
    response: () => ({ code: 200, data: assistantSkills }),
  },
  {
    url: '/api/admin/field-catalog',
    method: 'get',
    response: () => ({ code: 200, data: fieldCatalog }),
  },
  {
    url: '/api/admin/recommend-entries',
    method: 'get',
    response: () => ({ code: 200, data: recommendEntries }),
  },
  {
    url: '/api/admin/welcome-templates',
    method: 'get',
    response: () => ({ code: 200, data: welcomeTemplates }),
  },
  {
    url: '/api/admin/card-views',
    method: 'get',
    response: () => ({ code: 200, data: cardViews }),
  },
  {
    url: '/api/products/tickets',
    method: 'get',
    response: ({ query }: { query: Record<string, string> }) => {
      let list = [...ticketProducts]
      const channel = query.channel
      if (channel) {
        list = list.filter((p) => p.channels.includes(channel as 'self' | 'ota' | 'ta'))
      }
      return { code: 200, data: list }
    },
  },
  {
    url: '/api/products/coupons',
    method: 'get',
    response: () => ({ code: 200, data: couponProducts }),
  },
  {
    url: '/api/products/retail',
    method: 'get',
    response: () => ({ code: 200, data: retailProducts }),
  },
  {
    url: '/api/content/blocks',
    method: 'get',
    response: ({ query }: { query: Record<string, string> }) => {
      let list = [...contentBlocks]
      if (query.type) {
        list = list.filter((b) => b.type === query.type)
      }
      return { code: 200, data: list }
    },
  },
  {
    url: '/api/tags',
    method: 'get',
    response: () => ({ code: 200, data: tags }),
  },
  {
    url: '/api/member/tags',
    method: 'get',
    response: ({ headers }: { headers: Record<string, unknown> }) => {
      const personaId = getPersonaFromHeaders(headers)
      if (!personaId) return { code: 401, message: '未登录', data: null }
      const ctx = buildRuleContext(personaId)
      const userTags = tags.filter((t) => ctx.tags.includes(t.tagId))
      return { code: 200, data: userTags }
    },
  },
  {
    url: '/api/virtual-queue',
    method: 'get',
    response: () => ({ code: 200, data: virtualQueue }),
  },
  {
    url: '/api/quiz/current',
    method: 'get',
    response: () => ({ code: 200, data: quiz }),
  },
] as MockMethod[]
