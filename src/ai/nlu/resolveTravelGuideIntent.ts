import { classifyTravelGuideIntentWithLlm } from './classifyTravelGuideIntent'
import {
  isEntryNoticeIntent,
  isFullTravelGuideIntent,
  isInParkRouteIntent,
  isRecommendTravelGuideIntent,
  isTrafficGuideIntent,
  resolveTravelGuideIntent,
  type TravelGuideIntentKind,
} from '@/utils/travelGuideIntent'
import type { ToolExecutionCallbacks } from '@/types'

export type TravelGuideIntentSource = 'regex' | 'llm'

export interface ResolvedTravelGuideIntent {
  intent: TravelGuideIntentKind
  source: TravelGuideIntentSource
}

/** 正则已明确命中 traffic / entry / full / in_park / recommend 时不再调 LLM */
export function isSpecificTravelGuideRegex(message: string): boolean {
  return (
    isFullTravelGuideIntent(message) ||
    isTrafficGuideIntent(message) ||
    isEntryNoticeIntent(message) ||
    isInParkRouteIntent(message) ||
    isRecommendTravelGuideIntent(message)
  )
}

/**
 * 攻略子意图：正则优先 → 泛化说法由 LLM 细分（P0-3）
 */
export async function resolveTravelGuideIntentRoute(
  message: string,
  callbacks?: ToolExecutionCallbacks,
): Promise<ResolvedTravelGuideIntent> {
  const regexIntent = resolveTravelGuideIntent(message)

  if (isSpecificTravelGuideRegex(message)) {
    return { intent: regexIntent ?? 'recommend', source: 'regex' }
  }

  callbacks?.onToolStart?.('classifyTravelGuideIntent', '识别攻略类型')
  const llmResult = await classifyTravelGuideIntentWithLlm(message)
  callbacks?.onToolDone?.('classifyTravelGuideIntent', llmResult != null)

  if (llmResult) {
    return { intent: llmResult.intent, source: 'llm' }
  }

  return { intent: regexIntent ?? 'recommend', source: 'regex' }
}
