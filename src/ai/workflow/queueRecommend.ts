import { fetchVirtualQueueCatalog } from '@/api/business'
import {
  FREE_QUEUE_DEMO_IDS,
  PAID_QUEUE_DEMO_ID,
  matchVirtualQueueActivityByName,
  resolveQueueRecommendKind,
  shouldRunQueueRecommendWorkflow,
} from '@/utils/queueRecommendIntent'
import { activityToCardPayload } from '@/utils/activityDisplay'
import type {
  Activity,
  ActivityCardPayload,
  LlmChatResult,
  SceneRecommendPayload,
  ToolExecutionCallbacks,
} from '@/types'

export { shouldRunQueueRecommendWorkflow }

const TAKE_PATH = '/queue/take'
const PAY_PATH = '/queue/pay'

function freeActionLabel(): string {
  return '立即取号排队'
}

function paidActionLabel(price?: number): string {
  const yuan = price ?? 10
  return `¥${yuan}元快速排队`
}

function withQueueAction(activity: Activity): ActivityCardPayload {
  const card = activityToCardPayload(activity, { guideContext: 'in_park' })
  const vq = activity.virtualQueue
  if (!vq?.enabled) return card
  if (vq.isFree) {
    return {
      ...card,
      queueAction: {
        label: freeActionLabel(),
        path: `${TAKE_PATH}?activityId=${encodeURIComponent(activity.activityId)}`,
      },
    }
  }
  return {
    ...card,
    queueAction: {
      label: paidActionLabel(vq.queuePrice),
      path: `${PAY_PATH}?activityId=${encodeURIComponent(activity.activityId)}`,
    },
  }
}

function buildQueueCard(
  content: string,
  activities: Activity[],
): LlmChatResult {
  const payload: SceneRecommendPayload = {
    scene: 'queue',
    activities: activities.map(withQueueAction),
  }
  return {
    content: '',
    skillId: 'queue_recommend',
    toolCallsUsed: ['getScenicActivities'],
    cards: [
      {
        type: 'scene_recommend',
        role: 'assistant',
        content,
        payload,
      },
    ],
  }
}

function buildNamedActivityResult(
  activity: Activity,
  inPark: boolean,
): LlmChatResult {
  if (!inPark) {
    return {
      content: `已为您找到「${activity.name}」。入园后可使用虚拟排队取号。`,
      skillId: 'queue_recommend',
      toolCallsUsed: ['getScenicActivities'],
      cards: [
        {
          type: 'activity',
          role: 'assistant',
          content: '',
          payload: activityToCardPayload(activity, {
            guideContext: 'pre_visit',
          }),
        },
      ],
    }
  }
  const isFree = activity.virtualQueue?.isFree
  const content = isFree
    ? `「${activity.name}」支持免费虚拟排队，可立即取号。`
    : `「${activity.name}」支持付费快速排队（¥${activity.virtualQueue?.queuePrice ?? 10}）。`
  return buildQueueCard(content, [activity])
}

export async function runQueueRecommendWorkflow(
  message: string,
  callbacks?: ToolExecutionCallbacks,
): Promise<LlmChatResult> {
  callbacks?.onToolStart?.('getScenicActivities', '查询虚拟排队项目')
  try {
    const { data: res } = await fetchVirtualQueueCatalog()
    callbacks?.onToolDone?.('getScenicActivities', res.code === 200)
    if (res.code !== 200) {
      return {
        content: '暂时无法查询虚拟排队项目，请稍后再试。',
        skillId: 'queue_recommend',
        toolCallsUsed: ['getScenicActivities'],
      }
    }

    const { inPark, activities } = res.data
    const namedInScenic = matchVirtualQueueActivityByName(message, {
      candidates: activities,
    })
    const kind = namedInScenic
      ? ('named' as const)
      : resolveQueueRecommendKind(message)

    if (kind === 'named') {
      const activity = namedInScenic
      if (!activity?.virtualQueue?.enabled) {
        return {
          content:
            '当前景区未找到支持虚拟排队的对应项目，可说「虚拟排队」查看可取号推荐。',
          skillId: 'queue_recommend',
          toolCallsUsed: ['getScenicActivities'],
        }
      }
      return buildNamedActivityResult(activity, inPark)
    }

    if (!inPark) {
      return {
        content: '您当前不在园区内，入园后即可使用虚拟排队取号。',
        skillId: 'queue_recommend',
        toolCallsUsed: ['getScenicActivities'],
      }
    }

    const byId = new Map(activities.map((item) => [item.activityId, item]))

    if (kind === 'paid_single') {
      const paid =
        byId.get(PAID_QUEUE_DEMO_ID) ??
        activities.find(
          (item) => item.virtualQueue?.enabled && item.virtualQueue.isFree === false,
        )
      if (!paid) {
        return {
          content: '暂无可用的付费快速排队项目。',
          skillId: 'queue_recommend',
          toolCallsUsed: ['getScenicActivities'],
        }
      }
      const price = paid.virtualQueue?.queuePrice ?? 10
      return buildQueueCard(
        `为您推荐付费快速排队：${paid.name}（约排队 ${paid.waitMinutes ?? '-'} 分钟，¥${price} 可快速入队）。`,
        [paid],
      )
    }

    // free_bundle 默认
    const freeList = FREE_QUEUE_DEMO_IDS.map((id) => byId.get(id)).filter(
      (item): item is Activity => Boolean(item?.virtualQueue?.isFree),
    )
    const fallbackFree = activities
      .filter((item) => item.virtualQueue?.enabled && item.virtualQueue.isFree)
      .slice(0, 2)
    const picked = freeList.length >= 2 ? freeList : fallbackFree
    if (!picked.length) {
      return {
        content: '暂无可用的免费虚拟排队项目。',
        skillId: 'queue_recommend',
        toolCallsUsed: ['getScenicActivities'],
      }
    }
    const names = picked.map((item) => item.name).join('、')
    return buildQueueCard(
      `为您推荐 ${picked.length} 个免费虚拟排队项目：${names}。每个项目可单独取号。`,
      picked,
    )
  } catch {
    callbacks?.onToolDone?.('getScenicActivities', false)
    return {
      content: '暂时无法查询虚拟排队项目，请稍后再试。',
      skillId: 'queue_recommend',
      toolCallsUsed: ['getScenicActivities'],
    }
  }
}
