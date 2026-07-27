import {
  fetchActivities,
  fetchMapConfig,
  fetchMapPois,
  fetchMemberProfileTags,
} from '@/api/business'
import { shouldRunProjectQueryWorkflow } from '@/utils/projectQueryIntent'
import {
  buildMapDeepLink,
  findPoiByActivityId,
  hasMapGuideForScenic,
  sortActivitiesNearArea,
} from '@/utils/mapGuide'
import {
  activityToCardPayload,
  buildActivityRecommendReason,
  pickRecommendActivities,
} from '@/utils/activityDisplay'
import { matchPoiByLocationLabel, buildSessionContext } from '@/utils/sessionContext'
import { useAuthStore } from '@/store/authStore'
import { useScenicStore } from '@/store/scenicStore'
import { DEFAULT_SCENIC_ID } from '@/utils/scenicScope'
import {
  hasFamilyLikeTag,
  hasSlowPreference,
  hasThrillPreference,
  resolveProfileRuleTagIds,
} from '@/utils/profileTags'
import type {
  Activity,
  ActivityCardPayload,
  LlmChatResult,
  MapActionCardPayload,
  PersonaId,
  ToolExecutionCallbacks,
} from '@/types'

export { shouldRunProjectQueryWorkflow }

function resolveScenicId(): string {
  try {
    return useScenicStore().currentScenicId || DEFAULT_SCENIC_ID
  } catch {
    return DEFAULT_SCENIC_ID
  }
}

async function loadProfileTagIds(): Promise<string[]> {
  try {
    const { data: res } = await fetchMemberProfileTags()
    if (res.code === 200 && res.data?.ruleTagIds?.length) {
      return res.data.ruleTagIds
    }
  } catch {
    /* 未登录时回落本地 Persona */
  }
  try {
    const personaId = useAuthStore().personaId as PersonaId | null
    if (personaId) return resolveProfileRuleTagIds(personaId)
  } catch {
    /* pinia 外调用忽略 */
  }
  return []
}

function matchActivityByMessage(message: string, list: Activity[]): Activity | null {
  const text = message.trim()
  const named = list.find((a) => text.includes(a.name) || a.name.includes(text.slice(0, 4)))
  if (named) return named
  const aliases: Array<{ re: RegExp; id: string }> = [
    { re: /过山车/, id: 'act_002' },
    { re: /漂流/, id: 'act_001' },
    { re: /萌宠/, id: 'act_004' },
    { re: /灯光秀/, id: 'act_003' },
    { re: /摩天轮/, id: 'act_014' },
    { re: /碰碰车/, id: 'act_011' },
    { re: /旋转木马/, id: 'act_010' },
    { re: /激流/, id: 'act_012' },
    { re: /花车/, id: 'act_009' },
    { re: /儿童城堡|城堡/, id: 'act_015' },
    { re: /4D|影院/, id: 'act_013' },
  ]
  for (const item of aliases) {
    if (item.re.test(text)) {
      return list.find((a) => a.activityId === item.id) ?? null
    }
  }
  return null
}

async function attachMapAction(
  activity: Activity,
  scenicId: string,
): Promise<{
  card: ActivityCardPayload
  mapCard?: {
    type: 'map_action'
    role: 'assistant'
    content: string
    payload: MapActionCardPayload
  }
}> {
  const [{ data: configRes }, { data: poisRes }] = await Promise.all([
    fetchMapConfig(scenicId),
    fetchMapPois(scenicId),
  ])
  const config = configRes.code === 200 ? configRes.data : null
  const pois = poisRes.code === 200 ? poisRes.data ?? [] : []
  const poi =
    findPoiByActivityId(pois, activity.activityId) ||
    (activity.mapPoiId
      ? pois.find((p) => p.poiId === activity.mapPoiId) ?? null
      : null)

  const card = activityToCardPayload(activity, {
    reason: buildActivityRecommendReason(activity),
    guideContext: 'in_park',
  })
  card.mapPoiId = poi?.poiId || activity.mapPoiId

  if (hasMapGuideForScenic(config) && poi) {
    const deepLink = buildMapDeepLink({ scenicId, poiId: poi.poiId })
    card.mapActions = [{ label: '查看位置', path: deepLink }]
    return {
      card,
      mapCard: {
        type: 'map_action',
        role: 'assistant',
        content: '',
        payload: {
          action: 'view_poi',
          title: `${activity.name} · 地图位置`,
          subtitle: poi.area ? `位于「${poi.area}」` : '点击在导览图中查看',
          poiId: poi.poiId,
          activityId: activity.activityId,
          activityName: activity.name,
          deepLink,
          buttonLabel: '查看位置',
          tag: '地图',
        },
      },
    }
  }

  return { card }
}

export async function runProjectQueryWorkflow(
  message: string,
  callbacks?: ToolExecutionCallbacks,
): Promise<LlmChatResult> {
  const scenicId = resolveScenicId()
  callbacks?.onToolStart?.('getScenicActivities', '查询园区项目')
  try {
    const { data: actRes } = await fetchActivities()
    callbacks?.onToolDone?.('getScenicActivities', actRes.code === 200)
    if (actRes.code !== 200) {
      return {
        content: '暂时无法查询项目，请稍后再试。',
        skillId: 'project_query',
        toolCallsUsed: ['getScenicActivities'],
      }
    }

    const list = actRes.data ?? []
    const hit = matchActivityByMessage(message, list)

    if (hit) {
      const { card, mapCard } = await attachMapAction(hit, scenicId)
      const desc =
        hit.description ||
        `${hit.name}位于「${hit.location}」，开放时间 ${hit.timeRange}。` +
          (hit.waitMinutes != null && hit.queueStatus === 'waiting'
            ? `当前排队约 ${hit.waitMinutes} 分钟。`
            : '')
      const cards: LlmChatResult['cards'] = [
        {
          type: 'activity',
          role: 'assistant',
          content: desc,
          payload: card,
        },
      ]
      if (mapCard) cards.push(mapCard)
      return {
        content: '',
        skillId: 'project_query',
        toolCallsUsed: ['getScenicActivities', 'getMapPoi'],
        cards,
      }
    }

    // 附近 / 列表推荐
    let locationLabel = ''
    try {
      const { fetchCheckinSpots } = await import('@/api/business')
      const { data: checkinRes } = await fetchCheckinSpots()
      if (checkinRes.code === 200) {
        locationLabel = checkinRes.data.currentLocation || ''
      }
    } catch {
      /* 未登录时忽略 */
    }

    const { data: poisRes } = await fetchMapPois(scenicId)
    const pois = poisRes.code === 200 ? poisRes.data ?? [] : []
    const nearPoi = matchPoiByLocationLabel(locationLabel, pois)
    const session = buildSessionContext({
      scenicId,
      visitorState: {
        inPark: Boolean(locationLabel),
        currentLocation: locationLabel,
      },
      intent: 'nearby_projects',
      activeSkillId: 'project_query',
      locationPoi: nearPoi,
    })

    const area = session.location.area || session.location.label
    const profileTagIds = await loadProfileTagIds()
    const familyLike = hasFamilyLikeTag(profileTagIds)
    const preferThrill = hasThrillPreference(profileTagIds)
    const preferSlow = hasSlowPreference(profileTagIds)
    const nearPool = sortActivitiesNearArea(
      list.filter((a) => a.category === 'ride' || a.category === 'show'),
      area,
    )
    const picked = pickRecommendActivities(
      nearPool.length ? nearPool.slice(0, 8) : list,
      {
        limit: 4,
        guideContext: locationLabel ? 'in_park' : undefined,
        hasChildren: familyLike,
        profileTagIds,
      },
    )

    if (!picked.length) {
      return {
        content: '当前景区暂无推荐项目，可稍后再试。',
        skillId: 'project_query',
        toolCallsUsed: ['getScenicActivities'],
      }
    }

    const { data: configRes } = await fetchMapConfig(scenicId)
    const config = configRes.code === 200 ? configRes.data : null
    const hasMap = hasMapGuideForScenic(config)

    const caption = area
      ? `根据您当前位置「${area}」与画像偏好，为您推荐附近好玩的项目：`
      : familyLike || preferThrill || preferSlow
        ? '结合您的画像偏好，为您推荐这些好玩的项目：'
        : '为您推荐这些好玩的项目：'

    const activityCards = await Promise.all(
      picked.map(async (activity) => {
        const { card } = await attachMapAction(activity, scenicId)
        if (!hasMap) card.mapActions = undefined
        const nearReason =
          area &&
          (activity.location === area || activity.location.includes(area))
            ? `距您当前位置「${area}」较近`
            : null
        const tagReason = buildActivityRecommendReason(activity, {
          guideContext: locationLabel ? 'in_park' : undefined,
          hasChildren: familyLike,
          preferThrill,
          preferSlow,
        })
        return {
          type: 'activity' as const,
          role: 'assistant' as const,
          content: '',
          payload: {
            ...card,
            reason:
              nearReason && tagReason !== nearReason
                ? `${nearReason} · ${tagReason}`
                : nearReason || tagReason,
          },
        }
      }),
    )

    return {
      content: caption,
      skillId: 'project_query',
      toolCallsUsed: ['getScenicActivities', 'getMapPoi'],
      cards: activityCards,
    }
  } catch {
    callbacks?.onToolDone?.('getScenicActivities', false)
    return {
      content: '查询项目时出了点问题，请稍后再试。',
      skillId: 'project_query',
      toolCallsUsed: ['getScenicActivities'],
    }
  }
}
