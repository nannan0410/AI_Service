import { fetchMapConfig, fetchMapPois } from '@/api/business'
import { shouldRunMapGuideWorkflow } from '@/utils/mapGuideIntent'
import { buildMapDeepLink, hasMapGuideForScenic } from '@/utils/mapGuide'
import { useScenicStore } from '@/store/scenicStore'
import { DEFAULT_SCENIC_ID } from '@/utils/scenicScope'
import type { LlmChatResult, MapActionCardPayload, ToolExecutionCallbacks } from '@/types'

export { shouldRunMapGuideWorkflow }

function resolveScenicId(): string {
  try {
    return useScenicStore().currentScenicId || DEFAULT_SCENIC_ID
  } catch {
    return DEFAULT_SCENIC_ID
  }
}

export async function runMapGuideWorkflow(
  _message: string,
  callbacks?: ToolExecutionCallbacks,
): Promise<LlmChatResult> {
  const scenicId = resolveScenicId()
  callbacks?.onToolStart?.('getMapConfig', '查询导览地图')
  try {
    const [{ data: configRes }, { data: poisRes }] = await Promise.all([
      fetchMapConfig(scenicId),
      fetchMapPois(scenicId),
    ])
    callbacks?.onToolDone?.('getMapConfig', configRes.code === 200)

    const config = configRes.code === 200 ? configRes.data : null
    const pois = poisRes.code === 200 ? poisRes.data ?? [] : []

    if (!hasMapGuideForScenic(config)) {
      return {
        content: '当前景区暂未配置导览地图，请换至「上海奇趣乐园」体验地图打点演示。',
        skillId: 'map_guide',
        toolCallsUsed: ['getMapConfig'],
      }
    }

    const deepLink = buildMapDeepLink({ scenicId })
    const payload: MapActionCardPayload = {
      action: 'open_map',
      title: '打开园区导览地图',
      subtitle: `共 ${pois.length} 个点位，可查看项目位置与排队`,
      deepLink,
      buttonLabel: '打开地图',
      tag: '地图',
    }

    return {
      content: '',
      skillId: 'map_guide',
      toolCallsUsed: ['getMapConfig', 'getMapPoi'],
      cards: [
        {
          type: 'map_action',
          role: 'assistant',
          content: '可以在导览图上查看各项目位置与当前排队情况。',
          payload,
        },
      ],
    }
  } catch {
    callbacks?.onToolDone?.('getMapConfig', false)
    return {
      content: '暂时无法打开地图，请稍后再试。',
      skillId: 'map_guide',
      toolCallsUsed: ['getMapConfig'],
    }
  }
}
