import { llmConfig } from '@config/llm.config'
import { getLlmApiKey, getLlmModel, parseLlmApiError, requestLlmChatCompletion } from './llm/client'
import { executeTool, filterTools, toOpenAiToolSchemas } from './tools'
import { buildCardsFromToolResults, type ToolCallRecord, buildNewGuestCouponChatResult } from './tools/formatters'
import {
  buildCouponQueryRecommendResult,
} from '@/utils/couponRecommend'
import { routeSkillByKeywords } from './skills/router'
import { resolveSkillTools } from './skills/utils'
import { getRegisteredToolNames } from './tools/registry'
import { buildSystemPrompt } from './prompts/system'
import { buildGuideReplyByScope } from '@/utils/travelGuideText'
import {
  findNewGuestCoupon,
  isNewGuestCouponClaimIntent,
  NEW_GUEST_COUPON_COPY,
  NEW_GUEST_COUPON_PRODUCT_ID,
} from '@/utils/newGuestCoupon'
import {
  isEntryNoticeIntent,
  isFullTravelGuideIntent,
  isInParkRouteIntent,
  isRecommendTravelGuideIntent,
  isTrafficGuideIntent,
  resolveTravelGuideIntent,
  travelGuideIntentToScope,
} from '@/utils/travelGuideIntent'
import type {
  AssistantSkillConfig,
  AssistantUiConfig,
  Coupon,
  LlmChatResult,
  LlmMessage,
  SendChatOptions,
  ToolExecutionCallbacks,
} from '@/types'
import defaultSkills from '@/mock/assistant/skills.json'

interface ChatCompletionChoice {
  message?: LlmMessage
  finish_reason?: string
}

interface ChatCompletionResponse {
  choices?: ChatCompletionChoice[]
  error?: { message?: string }
  message?: string
  code?: number
}

const MAX_TOOL_ROUNDS = 6

async function requestChatCompletion(
  messages: LlmMessage[],
  tools: ReturnType<typeof toOpenAiToolSchemas> | undefined,
  temperature: number,
): Promise<ChatCompletionChoice> {
  if (!tools?.length) {
    const message = await requestLlmChatCompletion(messages, {
      temperature,
      maxTokens: llmConfig.maxTokens,
    })
    return { message }
  }

  const apiKey = getLlmApiKey()
  if (!apiKey) {
    throw new Error('OFFLINE')
  }

  const body: Record<string, unknown> = {
    model: getLlmModel(),
    messages,
    temperature,
    max_tokens: llmConfig.maxTokens,
    tools,
    tool_choice: 'auto',
  }

  const response = await fetch(`${llmConfig.baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  const data = (await response.json()) as ChatCompletionResponse

  if (!response.ok) {
    throw new Error(parseLlmApiError(data, response.status))
  }

  const choice = data.choices?.[0]
  if (!choice?.message) {
    throw new Error('LLM 返回内容为空')
  }
  return choice
}

function formatToolResult(result: Awaited<ReturnType<typeof executeTool>>): string {
  return JSON.stringify(result)
}

async function runOfflineToolFallback(
  userMessage: string,
  skill: AssistantSkillConfig | null | undefined,
  callbacks?: ToolExecutionCallbacks,
): Promise<LlmChatResult | null> {
  const registry = new Set(getRegisteredToolNames())
  const routedSkill = skill ?? routeSkillByKeywords(userMessage, defaultSkills as AssistantSkillConfig[])
  let toolName: string | null = null

  if (routedSkill) {
    const allowed = resolveSkillTools(routedSkill, registry)
    if (/订单|订票记录|我的票|OTA|第三方/.test(userMessage) && allowed.includes('getOrders')) {
      toolName = 'getOrders'
    } else if (
      isNewGuestCouponClaimIntent(userMessage) &&
      allowed.includes('issueCoupon')
    ) {
      toolName = 'issueCoupon'
    } else if (/优惠券|券/.test(userMessage) && allowed.includes('getCoupons')) {
      toolName = 'getCoupons'
    } else if (/会员|积分|等级/.test(userMessage) && allowed.includes('getMemberInfo')) {
      toolName = 'getMemberInfo'
    } else if (/买票|购票|门票|票价|两大一小|套票/.test(userMessage) && allowed.includes('getProductCatalog')) {
      toolName = 'getProductCatalog'
    } else if (isTrafficGuideIntent(userMessage) && allowed.includes('getContentBlocks')) {
      toolName = 'getContentBlocks'
    } else if (isEntryNoticeIntent(userMessage) && allowed.includes('getContentBlocks')) {
      toolName = 'getContentBlocks'
    } else if (isInParkRouteIntent(userMessage) && allowed.includes('generateTravelGuide')) {
      toolName = 'generateTravelGuide'
    } else if (
      (isFullTravelGuideIntent(userMessage) ||
        isRecommendTravelGuideIntent(userMessage) ||
        /交通|攻略|入园|怎么去|路线|出行|出游|指南|停车/.test(userMessage)) &&
      allowed.includes('generateTravelGuide')
    ) {
      toolName = 'generateTravelGuide'
    } else if (/项目|活动|玩什么/.test(userMessage) && allowed.includes('getScenicActivities')) {
      toolName = 'getScenicActivities'
    } else if (allowed.length) {
      toolName = allowed[0]
    }
  } else {
    if (/订单|订票记录|我的票/.test(userMessage)) toolName = 'getOrders'
    else if (isNewGuestCouponClaimIntent(userMessage)) toolName = 'issueCoupon'
    else if (/优惠券|券/.test(userMessage)) toolName = 'getCoupons'
    else if (/会员|积分|等级/.test(userMessage)) toolName = 'getMemberInfo'
    else if (/买票|购票|门票|票价/.test(userMessage)) toolName = 'getProductCatalog'
    else if (isTrafficGuideIntent(userMessage) || isEntryNoticeIntent(userMessage)) toolName = 'getContentBlocks'
    else if (isInParkRouteIntent(userMessage)) toolName = 'generateTravelGuide'
    else if (
      isFullTravelGuideIntent(userMessage) ||
      isRecommendTravelGuideIntent(userMessage) ||
      /交通|攻略|入园|路线|出行|出游|指南/.test(userMessage)
    )
      toolName = 'generateTravelGuide'
    else if (/项目|活动|玩什么|推荐/.test(userMessage)) toolName = 'getScenicActivities'
  }

  if (!toolName) return null

  const argsJson = (() => {
    if (toolName === 'issueCoupon') {
      return JSON.stringify({
        couponProductId: NEW_GUEST_COUPON_PRODUCT_ID,
        purpose: 'claim',
      })
    }
    if (toolName === 'getContentBlocks') {
      const type = isTrafficGuideIntent(userMessage)
        ? 'traffic'
        : isEntryNoticeIntent(userMessage)
          ? 'entry_notice'
          : undefined
      return JSON.stringify(type ? { type } : {})
    }
    if (toolName === 'generateTravelGuide') {
      const intent = resolveTravelGuideIntent(userMessage) ?? 'recommend'
      return JSON.stringify({ scope: travelGuideIntentToScope(intent) })
    }
    return '{}'
  })()

  const result = await executeTool(toolName, argsJson, callbacks)
  if (!result.success) {
    return {
      content: result.error || '查询失败，请稍后重试',
      toolCallsUsed: [toolName],
      skillId: routedSkill?.skillId ?? null,
    }
  }

  if (toolName === 'issueCoupon') {
    return {
      ...buildNewGuestCouponChatResult(result.data as Coupon, result.issueReason),
      toolCallsUsed: [toolName],
      skillId: routedSkill?.skillId ?? null,
    }
  }

  if (toolName === 'getCoupons' && isNewGuestCouponClaimIntent(userMessage)) {
    const existing = findNewGuestCoupon(result.data as Coupon[])
    if (existing) {
      return {
        ...buildNewGuestCouponChatResult(existing, 'already_claimed'),
        toolCallsUsed: [toolName],
        skillId: routedSkill?.skillId ?? null,
      }
    }
  }

  if (toolName === 'getCoupons') {
    const recommend = await buildCouponQueryRecommendResult(result.data as Coupon[])
    return {
      ...recommend,
      toolCallsUsed: [toolName],
      skillId: routedSkill?.skillId ?? null,
    }
  }

  const cards = buildCardsFromToolResults([{ name: toolName, result }])
  if (toolName === 'getContentBlocks') {
    const blocks = result.data as Array<{ title: string }>
    if (blocks.length === 1) {
      return {
        content: '',
        toolCallsUsed: [toolName],
        skillId: routedSkill?.skillId ?? null,
        cards,
      }
    }
  }

  return {
    content: buildOfflineSummary(toolName, result.data, userMessage),
    toolCallsUsed: [toolName],
    skillId: routedSkill?.skillId ?? null,
    cards,
  }
}

function buildOfflineSummary(toolName: string, data: unknown, userMessage = ''): string {
  if (toolName === 'getOrders') {
    const orders = data as Array<{
      orderId: string
      ticketName: string
      status: string
      totalAmount: number
      source?: string
    }>
    if (!orders.length) return '您目前还没有订单。如需购票，可以直接告诉我「两大一小有优惠吗」。'
    const thirdParty = orders.filter((item) => item.source === 'ota' || item.source === 'ta')
    let content = `为您查到 ${orders.length} 笔订单，详见下方卡片。`
    if (thirdParty.length) {
      content += ` 其中 ${thirdParty.length} 笔为第三方订单，如需改签/退票请联系原购买平台。`
    }
    return content
  }

  if (toolName === 'getCoupons') {
    const coupons = data as Coupon[]
    const available = coupons.filter((item) => item.status === 'available')
    if (!available.length) return '您当前没有可用优惠券。'
    if (isNewGuestCouponClaimIntent(userMessage) && findNewGuestCoupon(coupons)) {
      return NEW_GUEST_COUPON_COPY.alreadyClaimed
    }
    return `已为您在账户里找到${available.length}张可用优惠券：`
  }

  if (toolName === 'issueCoupon') {
    return NEW_GUEST_COUPON_COPY.success
  }

  if (toolName === 'getMemberInfo') {
    const m = data as { nickname: string; level: string; points: number; balance: number }
    return `您好，${m.nickname}！您是${m.level}，当前积分 ${m.points}，余额 ¥${m.balance}。`
  }

  if (toolName === 'getContentBlocks') {
    const blocks = data as Array<{ title: string; body: string; type: string }>
    if (!blocks.length) return '暂未找到相关攻略内容。'
    if (blocks.length === 1) return `为您整理「${blocks[0].title}」，详见下方卡片。`
    return `为您整理 ${blocks.length} 条攻略信息，详见下方卡片：`
  }

  if (toolName === 'getProductCatalog') {
    const products = data as Array<{ name: string }>
    if (!products.length) return '暂无可售门票。'
    return `为您推荐 ${Math.min(products.length, 3)} 款自销门票，详见下方卡片：`
  }

  if (toolName === 'getScenicActivities') {
    const list = data as Array<{ name: string }>
    if (!list.length) return '暂未找到推荐项目。'
    return `为您推荐 ${Math.min(list.length, 4)} 个园区项目，详见下方卡片：`
  }

  if (toolName === 'generateTravelGuide') {
    const guide = data as Parameters<typeof buildGuideReplyByScope>[0]
    return buildGuideReplyByScope(guide)
  }

  return `【演示离线模式】已调用 ${toolName} 获取数据。配置 API Key 后可获得更自然的 AI 回复。`
}

function mergeNewGuestCouponReplyIfNeeded(
  result: LlmChatResult,
  toolRecords: ToolCallRecord[],
  userMessage: string,
): LlmChatResult {
  if (!isNewGuestCouponClaimIntent(userMessage)) return result

  const issueRecord = [...toolRecords]
    .reverse()
    .find((record) => record.name === 'issueCoupon' && record.result.success)
  if (issueRecord) {
    return {
      ...result,
      ...buildNewGuestCouponChatResult(
        issueRecord.result.data as Coupon,
        issueRecord.result.issueReason,
      ),
    }
  }

  const getRecord = [...toolRecords]
    .reverse()
    .find((record) => record.name === 'getCoupons' && record.result.success)
  if (getRecord) {
    const existing = findNewGuestCoupon(getRecord.result.data as Coupon[])
    if (existing) {
      return {
        ...result,
        ...buildNewGuestCouponChatResult(existing, 'already_claimed'),
      }
    }
  }

  return result
}

async function mergeCouponQueryReplyIfNeeded(
  result: LlmChatResult,
  toolRecords: ToolCallRecord[],
  userMessage: string,
): Promise<LlmChatResult> {
  if (isNewGuestCouponClaimIntent(userMessage)) {
    return mergeNewGuestCouponReplyIfNeeded(result, toolRecords, userMessage)
  }

  const getRecord = [...toolRecords]
    .reverse()
    .find((record) => record.name === 'getCoupons' && record.result.success)
  if (!getRecord) return result

  const recommend = await buildCouponQueryRecommendResult(getRecord.result.data as Coupon[])
  return {
    ...result,
    ...recommend,
  }
}

export async function chatCompletionWithTools(
  history: LlmMessage[],
  uiConfig: AssistantUiConfig,
  options?: SendChatOptions,
): Promise<LlmChatResult> {
  const skill = options?.skill ?? null
  const resolvedToolNames =
    options?.toolNames ??
    (skill ? resolveSkillTools(skill, new Set(getRegisteredToolNames())) : undefined)
  const tools = filterTools(resolvedToolNames)
  const toolSchemas = tools.length ? toOpenAiToolSchemas(tools) : undefined
  const temperature = options?.temperature ?? llmConfig.toolTemperature
  const toolCallsUsed: string[] = []
  const toolRecords: ToolCallRecord[] = []
  const lastUser = [...history].reverse().find((message) => message.role === 'user')

  const apiKey = getLlmApiKey()
  if (!apiKey) {
    const offline = await runOfflineToolFallback(lastUser?.content || '', skill, options)
    if (offline) return offline
    return {
      content:
        '【演示提示】请在项目根目录 .env 中设置 VITE_LLM_API_KEY（或 VITE_SILICONFLOW_API_KEY / VITE_DEEPSEEK_API_KEY）后重启 dev，即可启用真实 AI 对话。当前为离线占位回复。',
      skillId: skill?.skillId ?? null,
    }
  }

  const messages: LlmMessage[] = [
    { role: 'system', content: buildSystemPrompt(uiConfig, skill) },
    ...history.map((m) => ({ ...m })),
  ]

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const choice = await requestChatCompletion(messages, toolSchemas, temperature)
    const assistantMessage = choice.message!

    if (assistantMessage.tool_calls?.length) {
      messages.push({
        role: 'assistant',
        content: assistantMessage.content,
        tool_calls: assistantMessage.tool_calls,
      })

      for (const call of assistantMessage.tool_calls) {
        const toolName = call.function.name
        toolCallsUsed.push(toolName)
        const result = await executeTool(toolName, call.function.arguments, options)
        toolRecords.push({ name: toolName, result })
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          name: toolName,
          content: formatToolResult(result),
        })
      }
      continue
    }

    const content = assistantMessage.content?.trim()
    if (!content) {
      throw new Error('LLM 返回内容为空')
    }

    return mergeCouponQueryReplyIfNeeded(
      {
        content,
        toolCallsUsed,
        skillId: skill?.skillId ?? null,
        cards: buildCardsFromToolResults(toolRecords),
      },
      toolRecords,
      lastUser?.content || '',
    )
  }

  throw new Error('Tool 调用轮次过多，请简化问题后重试')
}

export async function chatCompletion(
  messages: LlmMessage[],
  uiConfig: AssistantUiConfig,
  options?: { temperature?: number },
): Promise<LlmChatResult> {
  return chatCompletionWithTools(messages, uiConfig, {
    toolNames: [],
    temperature: options?.temperature ?? llmConfig.temperature,
  })
}

/** 统一 AI 调用入口 — 所有 LLM 请求必须经此文件 */
export async function sendChatMessage(
  history: LlmMessage[],
  userMessage: string,
  uiConfig: AssistantUiConfig,
  options?: SendChatOptions,
): Promise<LlmChatResult> {
  const messages: LlmMessage[] = [...history, { role: 'user', content: userMessage }]
  return chatCompletionWithTools(messages, uiConfig, options)
}
