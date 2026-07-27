import { shouldRunWeatherSuitabilityWorkflow } from '@/utils/weatherSuitabilityIntent'
import { buildWeatherSuitabilityReply } from '@/utils/scenicWeather'
import { useScenicStore } from '@/store/scenicStore'
import type { LlmChatResult, ToolExecutionCallbacks } from '@/types'

export { shouldRunWeatherSuitabilityWorkflow }

export async function runWeatherSuitabilityWorkflow(
  _message: string,
  callbacks?: ToolExecutionCallbacks,
): Promise<LlmChatResult> {
  const scenicStore = useScenicStore()

  callbacks?.onToolStart?.('getScenicWeather', '查询当日天气与人流')
  const content = buildWeatherSuitabilityReply({
    scenicId: scenicStore.currentScenicId,
    scenicName: scenicStore.currentScenicName || undefined,
  })
  callbacks?.onToolDone?.('getScenicWeather', true)

  return {
    content,
    skillId: 'travel_guide',
    toolCallsUsed: ['getScenicWeather'],
  }
}
