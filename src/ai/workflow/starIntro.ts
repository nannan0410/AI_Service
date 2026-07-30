import { matchStar } from '@/api/quiz'
import { shouldRunStarIntroWorkflow } from '@/utils/starIntent'
import type {
  ChatMessageDraft,
  LlmChatResult,
  StarIntroPayload,
  ToolExecutionCallbacks,
} from '@/types'

export { shouldRunStarIntroWorkflow }

export async function runStarIntroWorkflow(
  message: string,
  callbacks?: ToolExecutionCallbacks,
): Promise<LlmChatResult> {
  callbacks?.onToolStart?.('getScenicActivities', '查询动物明星介绍')
  try {
    const { data: res } = await matchStar(message)
    callbacks?.onToolDone?.('getScenicActivities', res.code === 200)
    const star = res.data
    // 校验 name 而非仅判空：接口返回结构异常时也走兜底文案，避免卡片渲染出 undefined
    if (res.code !== 200 || !star?.name) {
      return {
        content:
          '暂时没有匹配到对应的动物明星介绍。演示版可询问「企鹅」或「白鲸」（上海海洋公园）。',
        skillId: 'star_intro',
      }
    }

    const payload: StarIntroPayload = {
      starId: star.starId,
      name: star.name,
      species: star.species,
      location: star.location,
      intro: star.intro,
      quizInvite: star.quizInvite,
    }

    const card: ChatMessageDraft = {
      type: 'star_intro',
      role: 'assistant',
      content: `为您介绍海洋明星「${star.name}」（${star.species}）：`,
      payload,
    }

    return {
      content: '',
      skillId: 'star_intro',
      toolCallsUsed: ['getScenicActivities'],
      cards: [card],
    }
  } catch {
    callbacks?.onToolDone?.('getScenicActivities', false)
    return {
      content: '暂时无法获取明星介绍，请稍后再试。',
      skillId: 'star_intro',
    }
  }
}
