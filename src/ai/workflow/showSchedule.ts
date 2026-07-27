import { fetchActivities, fetchMapConfig, fetchMapPois } from '@/api/business'
import { activityToCardPayload } from '@/utils/activityDisplay'
import {
  buildShowScheduleReply,
  findRecommendedShowSlot,
  listTodayShowSlots,
  remainingTimesForActivity,
  type ShowSlot,
} from '@/utils/showSchedule'
import {
  matchShowActivityByName,
  resolveShowDayKind,
  shouldRunShowScheduleWorkflow,
  showDayLabel,
  type ShowDayKind,
} from '@/utils/showScheduleIntent'
import { resolveShowQuizInvite } from '@/utils/quizInvite'
import {
  enrichInParkActivityCard,
  loadCheckinContext,
} from '@/utils/enrichInParkActivityCard'
import {
  buildMapDeepLink,
  findPoiByActivityId,
  hasMapGuideForScenic,
} from '@/utils/mapGuide'
import { useScenicStore } from '@/store/scenicStore'
import { DEFAULT_SCENIC_ID } from '@/utils/scenicScope'
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

async function buildShowScheduleCard(
  activities: Activity[],
  options: {
    dayKind: ShowDayKind
    slots: ShowSlot[]
    recommended?: ShowSlot
    intro: string
    ref: Date
    quizInvite?: SceneRecommendPayload['quizInvite']
    inPark: boolean
    spotsByActivityId: Map<string, import('@/types').CheckinSpot>
  },
): Promise<ChatMessageDraft> {
  const { dayKind, slots, recommended, intro, ref, quizInvite, inPark, spotsByActivityId } =
    options
  const showActivities = activities.filter(
    (item) => item.category === 'show' && item.showStartTimes?.length,
  )

  const scenicStore = useScenicStore()
  const scenicId = scenicStore.currentScenicId || DEFAULT_SCENIC_ID
  const mapPathByActivity = new Map<string, string>()
  if (inPark) {
    try {
      const [{ data: configRes }, { data: poisRes }] = await Promise.all([
        fetchMapConfig(scenicId),
        fetchMapPois(scenicId),
      ])
      const config = configRes.code === 200 ? configRes.data : null
      const pois = poisRes.code === 200 ? poisRes.data ?? [] : []
      if (hasMapGuideForScenic(config)) {
        for (const activity of showActivities) {
          const poi =
            findPoiByActivityId(pois, activity.activityId) ||
            (activity.mapPoiId
              ? pois.find((p) => p.poiId === activity.mapPoiId)
              : undefined)
          if (poi) {
            mapPathByActivity.set(
              activity.activityId,
              buildMapDeepLink({ scenicId, poiId: poi.poiId }),
            )
          }
        }
      }
    } catch {
      /* ignore */
    }
  }

  const payload: SceneRecommendPayload = {
    scene: 'show',
    dayKind,
    hasRemainingSlots: dayKind === 'today' ? recommended != null : true,
    activities: showActivities.map((activity) => {
      const card = activityToCardPayload(activity, {
        reason: buildShowActivityReason(activity, {
          dayKind,
          recommended,
          slots,
          ref,
        }),
        guideContext: inPark ? 'in_park' : 'pre_visit',
      })
      const mapPath = mapPathByActivity.get(activity.activityId)
      if (mapPath) {
        card.mapActions = [{ label: '地图查看', path: mapPath }]
      }
      const remaining =
        dayKind === 'today'
          ? remainingTimesForActivity(activity.activityId, slots, ref)
          : []
      return enrichInParkActivityCard(card, {
        inPark,
        spotsByActivityId,
        remainingShowTimes: remaining,
        mapPath,
        activity,
        now: ref,
      })
    }),
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
  const scenicStore = useScenicStore()
  const dayKind = resolveShowDayKind(message)
  const day = showDayLabel(dayKind)
  const namedShow = matchShowActivityByName(message, {
    scenicId: scenicStore.currentScenicId,
  })

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

  // 点名具体演出时只展示该项目（再按当前景区 API 结果校准一次）
  const focused =
    namedShow &&
    (matchShowActivityByName(message, {
      candidates: activities,
      scenicId: scenicStore.currentScenicId,
    }) ??
      activities.find((item) => item.activityId === namedShow.activityId))
  if (focused) {
    activities = [focused]
  }

  const ref = new Date()
  const slots = listTodayShowSlots(activities, ref)
  const recommended = findRecommendedShowSlot(slots, dayKind, ref)
  let intro = buildShowScheduleReply(slots, { dayKind, ref })
  if (focused && slots.length) {
    const times = focused.showStartTimes?.join('、') ?? ''
    intro =
      dayKind === 'general'
        ? `已为您找到「${focused.name}」（${focused.location}），场次 ${times}。建议提前 10 分钟到场。`
        : intro
  }
  const quizInvite = await resolveShowQuizInvite(activities)
  const checkinCtx = await loadCheckinContext()

  if (!slots.length) {
    return {
      content: focused
        ? `当前景区未查到「${focused.name}」的演出场次，可换个说法问问「今天有哪些演出」。`
        : intro,
      skillId: 'scenic_recommend',
      toolCallsUsed: ['getScenicActivities'],
    }
  }

  return {
    content: '',
    skillId: 'scenic_recommend',
    toolCallsUsed: ['getScenicActivities'],
    cards: [
      await buildShowScheduleCard(activities, {
        dayKind,
        slots,
        recommended,
        intro,
        ref,
        quizInvite,
        inPark: checkinCtx.inPark,
        spotsByActivityId: checkinCtx.spotsByActivityId,
      }),
    ],
  }
}
