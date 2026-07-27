import type { MockMethod } from 'vite-plugin-mock'
import uiConfig from '../src/mock/assistant/ui_config.json'
import welcomeTemplates from '../src/mock/assistant/welcome_templates.json'
import welcomeQuestions from '../src/mock/assistant/welcome_questions.json'
import recommendEntries from '../src/mock/assistant/recommend_entries.json'
import ticketProducts from '../src/mock/products/tickets.json'
import couponProducts from '../src/mock/products/coupon_products.json'
import retailProducts from '../src/mock/products/retail.json'
import contentBlocks from '../src/mock/content/blocks.json'
import quiz from '../src/mock/quiz.json'
import assistantSkills from '../src/mock/assistant/skills.json'
import fieldCatalog from '../src/mock/assistant/field_catalog.json'
import cardViews from '../src/mock/assistant/card_views.json'
import scenicList from '../src/mock/scenic/list.json'
import {
  buildRuleContext,
  evaluateRules,
  getPersonaFromHeaders,
  getScenicIdFromHeaders,
  type RuleExpression,
} from './rules'
import { getVirtualQueueOrders } from './_utils'
import {
  filterByBusinessScenicId,
  filterCouponsByScenic,
} from '../src/utils/scenicScope'

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
  scenicId?: string
  scenicIds?: string[]
}

function matchesScenicScope(
  item: { scenicId?: string; scenicIds?: string[] },
  scenicId: string | null,
): boolean {
  if (!scenicId) return true
  if (item.scenicId && item.scenicId !== scenicId) return false
  if (item.scenicIds?.length && !item.scenicIds.includes(scenicId)) return false
  return true
}

function resolveScenicName(scenicId: string | null): string {
  if (!scenicId) return '景区'
  const hit = (scenicList as Array<{ scenicId: string; name: string }>).find(
    (item) => item.scenicId === scenicId,
  )
  return hit?.name ?? '景区'
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
      const scenicId = getScenicIdFromHeaders(headers)
      const template = welcomeTemplates.find((t) => t.personaId === personaId)
      const ctx = buildRuleContext(personaId, { scenicId })
      const scenicName = resolveScenicName(scenicId)
      const body =
        template?.body
          .replace(/\{\{nickname\}\}/g, ctx.nickname)
          .replace(/\{\{scenicName\}\}/g, scenicName) ?? ''
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
      const scenicId = getScenicIdFromHeaders(headers)
      const ctx = buildRuleContext(personaId, { scenicId })
      const list = (recommendEntries as RecommendEntryRaw[])
        .filter((e) => e.enabled !== false)
        .filter((e) => matchesScenicScope(e, scenicId))
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
    url: '/api/admin/welcome-questions',
    method: 'get',
    response: () => ({ code: 200, data: welcomeQuestions }),
  },
  {
    url: '/api/admin/card-views',
    method: 'get',
    response: () => ({ code: 200, data: cardViews }),
  },
  {
    url: '/api/products/tickets',
    method: 'get',
    response: ({
      headers,
      query,
    }: {
      headers: Record<string, unknown>
      query: Record<string, string>
    }) => {
      const scenicId = getScenicIdFromHeaders(headers)
      let list = filterByBusinessScenicId([...ticketProducts], scenicId)
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
    response: ({ headers }: { headers: Record<string, unknown> }) => ({
      code: 200,
      data: filterCouponsByScenic([...couponProducts], getScenicIdFromHeaders(headers)),
    }),
  },
  {
    url: '/api/products/retail',
    method: 'get',
    response: () => ({ code: 200, data: retailProducts }),
  },
  {
    url: '/api/content/blocks',
    method: 'get',
    response: ({
      headers,
      query,
    }: {
      headers: Record<string, unknown>
      query: Record<string, string>
    }) => {
      const scenicId = getScenicIdFromHeaders(headers)
      let list = filterByBusinessScenicId([...contentBlocks], scenicId)
      if (query.type) {
        list = list.filter((b) => b.type === query.type)
      }
      return { code: 200, data: list }
    },
  },
  {
    url: '/api/virtual-queue',
    method: 'get',
    response: ({ headers }: { headers: Record<string, unknown> }) => {
      const personaId = getPersonaFromHeaders(headers)
      if (!personaId) return { code: 401, message: '未登录', data: null }
      return { code: 200, data: getVirtualQueueOrders(personaId) }
    },
  },
  {
    url: '/api/quiz/current',
    method: 'get',
    response: () => {
      const list = Array.isArray(quiz) ? quiz : [quiz]
      return { code: 200, data: list[0] ?? null }
    },
  },
] as MockMethod[]
