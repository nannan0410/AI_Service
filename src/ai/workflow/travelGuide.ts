import { fetchContentBlocks, fetchTravelGuide } from '@/api/business'
import {
  buildTravelGuideCards,
  formatToolResultToCards,
  type ToolCallRecord,
} from '@/ai/tools/formatters'
import { buildGuideReplyByScope } from '@/utils/travelGuideText'
import { resolveTravelGuideIntentRoute } from '@/ai/nlu/resolveTravelGuideIntent'
import {
  shouldRunTravelGuideWorkflow,
  travelGuideIntentToScope,
} from '@/utils/travelGuideIntent'
import type { LlmChatResult, PersonaId, ToolExecutionCallbacks, TravelGuideScope } from '@/types'

export { shouldRunTravelGuideWorkflow }

async function unwrapApi<T>(request: Promise<{ data: { code: number; data: T; message?: string } }>): Promise<T> {
  const { data: res } = await request
  if (res.code !== 200) throw new Error(res.message || '请求失败')
  return res.data
}

function buildGuideContent(
  guide: Parameters<typeof buildGuideReplyByScope>[0],
): string {
  return buildGuideReplyByScope(guide)
}

async function runScopedTravelGuideWorkflow(
  scope: TravelGuideScope,
  toolLabel: string,
  callbacks?: ToolExecutionCallbacks,
): Promise<LlmChatResult> {
  const toolRecords: ToolCallRecord[] = []

  callbacks?.onToolStart?.('generateTravelGuide', toolLabel)
  const guide = await unwrapApi(fetchTravelGuide(scope))
  toolRecords.push({ name: 'generateTravelGuide', result: { success: true, data: guide } })
  callbacks?.onToolDone?.('generateTravelGuide', true)

  const cards = buildTravelGuideCards(guide).map((card) => ({
    ...card,
    content: buildGuideContent(guide),
  }))

  return {
    content: '',
    skillId: 'travel_guide',
    toolCallsUsed: toolRecords.map((item) => item.name),
    cards,
  }
}

async function runSingleContentBlockWorkflow(
  blockType: 'traffic' | 'entry_notice',
  toolLabel: string,
  callbacks?: ToolExecutionCallbacks,
): Promise<LlmChatResult> {
  const toolRecords: ToolCallRecord[] = []

  callbacks?.onToolStart?.('getContentBlocks', toolLabel)
  const blocks = await unwrapApi(fetchContentBlocks(blockType))
  toolRecords.push({
    name: 'getContentBlocks',
    result: { success: true, data: blocks },
  })
  callbacks?.onToolDone?.('getContentBlocks', true)

  const cards = toolRecords.flatMap(({ name, result }) =>
    formatToolResultToCards(name, result),
  )

  return {
    content: '',
    skillId: 'travel_guide',
    toolCallsUsed: toolRecords.map((item) => item.name),
    cards,
  }
}

export async function runTravelGuideWorkflow(
  message: string,
  _personaId: PersonaId,
  callbacks?: ToolExecutionCallbacks,
): Promise<LlmChatResult> {
  const { intent } = await resolveTravelGuideIntentRoute(message, callbacks)

  if (intent === 'traffic') {
    return runSingleContentBlockWorkflow('traffic', '查询交通指南', callbacks)
  }
  if (intent === 'entry_notice') {
    return runSingleContentBlockWorkflow('entry_notice', '查询入园提醒', callbacks)
  }

  const scope = travelGuideIntentToScope(intent)
  const label =
    scope === 'in_park'
      ? '生成园内路线推荐'
      : scope === 'full'
        ? '生成完整出行攻略'
        : '生成游玩项目推荐'

  return runScopedTravelGuideWorkflow(scope, label, callbacks)
}
