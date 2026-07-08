import { fetchActivities } from '@/api/business'
import {
  activityToCardPayload,
  buildActivityRecommendReason,
} from '@/utils/activityDisplay'
import {
  buildShowScheduleReply,
  findNextShowSlot,
  listTodayShowSlots,
} from '@/utils/showSchedule'
import { shouldRunShowScheduleWorkflow } from '@/utils/showScheduleIntent'
import type {
  Activity,
  ChatMessageDraft,
  LlmChatResult,
  ToolExecutionCallbacks,
} from '@/types'

export { shouldRunShowScheduleWorkflow }

async function unwrapApi<T>(
  request: Promise<{ data: { code: number; data: T; message?: string } }>,
): Promise<T> {
  const { data: res } = await request
  if (res.code !== 200) throw new Error(res.message || '请求失败')
  return res.data
}

function buildShowScheduleCards(
  activities: Activity[],
  nextSlot?: ReturnType<typeof findNextShowSlot>,
): ChatMessageDraft[] {
  return activities.map((activity) => {
    const isNextShow =
      nextSlot?.activityId === activity.activityId &&
      activity.showStartTimes?.includes(nextSlot.startTime)
    const reason = isNextShow
      ? `下一场 ${nextSlot!.startTime} 开始，建议提前 10 分钟到场`
      : buildActivityRecommendReason(activity, { guideContext: 'in_park' })
    return {
      type: 'activity' as const,
      role: 'assistant' as const,
      payload: activityToCardPayload(activity, {
        reason,
        guideContext: 'in_park',
      }),
    }
  })
}

export async function runShowScheduleWorkflow(
  _message: string,
  callbacks?: ToolExecutionCallbacks,
): Promise<LlmChatResult> {
  callbacks?.onToolStart?.('getScenicActivities', '查询今日演出')
  let activities: Activity[] = []
  try {
    activities = await unwrapApi(fetchActivities({ category: 'show' }))
    callbacks?.onToolDone?.('getScenicActivities', true)
  } catch {
    callbacks?.onToolDone?.('getScenicActivities', false)
    return {
      content: '暂时无法获取演出安排，请稍后再试或询问现场工作人员。',
      skillId: 'scenic_recommend',
      toolCallsUsed: ['getScenicActivities'],
    }
  }

  const ref = new Date()
  const slots = listTodayShowSlots(activities, ref)
  const nextSlot = findNextShowSlot(slots, ref)
  const content = buildShowScheduleReply(slots, ref)

  return {
    content,
    skillId: 'scenic_recommend',
    toolCallsUsed: ['getScenicActivities'],
    cards: buildShowScheduleCards(activities, nextSlot),
  }
}
