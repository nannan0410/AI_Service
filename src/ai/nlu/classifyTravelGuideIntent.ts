import { llmConfig } from '@config/llm.config'
import { isLlmAvailable, requestLlmChatCompletion } from '@/ai/llm/client'
import type { TravelGuideIntentKind } from '@/utils/travelGuideIntent'

export interface TravelGuideIntentClassification {
  intent: TravelGuideIntentKind
  confidence: number
}

const MIN_CONFIDENCE = 0.5
const VALID_INTENTS: TravelGuideIntentKind[] = [
  'traffic',
  'entry_notice',
  'full',
  'in_park',
  'recommend',
]

function buildSystemPrompt(): string {
  return `你是景区游玩攻略助手的子意图分类器。根据用户一句话，判断需要哪类攻略回复。

可选 intent（必须从中选一个）：
- traffic：仅交通/怎么去/停车/路线/自驾公交地铁
- entry_notice：仅入园准备/入园须知/要带什么/几点到
- in_park：用户已在景区内，根据当前位置或排队推荐今日路线、先玩哪里（不含交通与入园）
- recommend：游玩攻略、规划路线、推荐玩什么/项目，不含交通与入园
- full：按订单/待出行/出行计划生成完整攻略（含交通+入园+项目）

规则：
1. 只问怎么去、交通、停车 → traffic
2. 只问入园要带什么、注意事项、几点到 → entry_notice
3. 已在园内、现在先玩哪里、根据排队推荐 → in_park
4. 游玩攻略、一天怎么玩、推荐项目/路线，且未要求交通入园 → recommend
5. 按订单做攻略、出行计划、近期出游、明确要完整出行信息 → full
6. confidence 为 0~1

仅输出 JSON：
{"intent":"traffic|entry_notice|in_park|recommend|full","confidence":number}`
}

function parseClassification(content: string): TravelGuideIntentClassification | null {
  const trimmed = content.trim()
  const jsonText = trimmed.startsWith('{') ? trimmed : trimmed.match(/\{[\s\S]*\}/)?.[0]
  if (!jsonText) return null

  try {
    const raw = JSON.parse(jsonText) as Record<string, unknown>
    const intent = raw.intent
    if (!VALID_INTENTS.includes(intent as TravelGuideIntentKind)) return null

    const confidenceRaw = raw.confidence
    const confidence =
      typeof confidenceRaw === 'number' && Number.isFinite(confidenceRaw)
        ? Math.min(Math.max(confidenceRaw, 0), 1)
        : 0

    return {
      intent: intent as TravelGuideIntentKind,
      confidence,
    }
  } catch {
    return null
  }
}

function isTravelGuideNluEnabled(): boolean {
  const flag = import.meta.env.VITE_ENABLE_TRAVEL_GUIDE_NLU
  if (flag === 'false' || flag === '0') return false
  return Boolean(llmConfig.nlu.travelGuideIntent)
}

/** LLM 分类攻略子意图；失败或未启用时返回 null */
export async function classifyTravelGuideIntentWithLlm(
  message: string,
): Promise<TravelGuideIntentClassification | null> {
  if (!isTravelGuideNluEnabled() || !isLlmAvailable()) return null

  const text = message.trim()
  if (!text) return null

  try {
    const response = await requestLlmChatCompletion(
      [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: text },
      ],
      {
        temperature: llmConfig.nlu.travelGuideIntentTemperature,
        maxTokens: 96,
        responseFormat: 'json_object',
      },
    )

    const parsed = parseClassification(response.content ?? '')
    if (!parsed || parsed.confidence < MIN_CONFIDENCE) return null
    return parsed
  } catch {
    return null
  }
}

export { isTravelGuideNluEnabled, MIN_CONFIDENCE as TRAVEL_GUIDE_INTENT_MIN_CONFIDENCE }
