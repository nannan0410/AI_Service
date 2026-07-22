import { fetchActivities } from '@/api/business'
import { activityToCardPayload } from '@/utils/activityDisplay'
import {
  buildShowScheduleReply,
  findRecommendedShowSlot,
  listTodayShowSlots,
  remainingTimesForActivity,
  type ShowSlot,
} from '@/utils/showSchedule'
import {
  resolveShowDayKind,
  shouldRunShowScheduleWorkflow,
  showDayLabel,
  type ShowDayKind,
} from '@/utils/showScheduleIntent'
import { resolveShowQuizInvite } from '@/utils/quizInvite'
import type {
  Activity,
  ChatMessageDraft,
  LlmChatResult,
  SceneRecommendPayload,
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

function buildShowActivityReason(
  activity: Activity,
  options: {
    dayKind: ShowDayKind
    recommended?: ShowSlot
    slots: ShowSlot[]
    ref: Date
  },
): string {
  const { dayKind, recommended, slots, ref } = options
  const allTimes = activity.showStartTimes?.join('、') ?? ''
  const isRecommended =
    recommended != null &&
    recommended.activityId === activity.activityId &&
    activity.showStartTimes?.includes(recommended.startTime)

  if (dayKind === 'today') {
    const remaining = remainingTimesForActivity(activity.activityId, slots, ref)
    if (!remaining.length) {
      return `今日场次已结束 · 回顾 ${allTimes}`
    }
    if (isRecommended) {
      return `推荐：下一场 ${recommended!.startTime} 开始，建议提前 10 分钟到场 · 今日剩余 ${remaining.join('、')}`
    }
    return `今日剩余场次 ${remaining.join('、')} · 全日 ${allTimes}`
  }

  if (dayKind === 'general') {
    if (isRecommended) {
      return `推荐优先：${recommended!.startTime} 场 · 场次 ${allTimes}`
    }
    return `场次 ${allTimes}`
  }

  if (isRecommended) {
    return `推荐：${showDayLabel(dayKind)}最早一场 ${recommended!.startTime} · 场次 ${allTimes}`
  }
  return `${showDayLabel(dayKind)}场次 ${allTimes}`
}

function buildShowScheduleCard(
  activities: Activity[],
  options: {
    dayKind: ShowDayKind
    slots: ShowSlot[]
    recommended?: ShowSlot
    intro: string
    ref: Date
    quizInvite?: SceneRecommendPayload['quizInvite']
  },
): ChatMessageDraft {
  const { dayKind, slots, recommended, intro, ref, quizInvite } = options
  const showActivities = activities.filter(
    (item) => item.category === 'show' && item.showStartTimes?.length,
  )

  const payload: SceneRecommendPayload = {
    scene: 'show',
    dayKind,
    hasRemainingSlots: dayKind === 'today' ? recommended != null : true,
    activities: showActivities.map((activity) =>
      activityToCardPayload(activity, {
        reason: buildShowActivityReason(activity, {
          dayKind,
          recommended,
          slots,
          ref,
        }),
        guideContext: 'in_park',
      }),
    ),
    quizInvite,
  }

  return {
    type: 'scene_recommend',
    role: 'assistant',
    content: intro,
    payload,
  }
}

export async function runShowScheduleWorkflow(
  message: string,
  callbacks?: ToolExecutionCallbacks,
): Promise<LlmChatResult> {
  const dayKind = resolveShowDayKind(message)
  const day = showDayLabel(dayKind)

  callbacks?.onToolStart?.('getScenicActivities', `查询${day}演出`)
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
  const recommended = findRecommendedShowSlot(slots, dayKind, ref)
  const intro = buildShowScheduleReply(slots, { dayKind, ref })
  const quizInvite = await resolveShowQuizInvite(activities)

  if (!slots.length) {
    return {
      content: intro,
      skillId: 'scenic_recommend',
      toolCallsUsed: ['getScenicActivities'],
    }
  }

  return {
    content: '',
    skillId: 'scenic_recommend',
    toolCallsUsed: ['getScenicActivities'],
    cards: [
      buildShowScheduleCard(activities, {
        dayKind,
        slots,
        recommended,
        intro,
        ref,
        quizInvite,
      }),
    ],
  }
}
