import { fetchCheckinSpots } from '@/api/business'
import { shouldRunCheckinWorkflow } from '@/utils/checkinIntent'
import { isNearCheckinSpot } from '@/utils/checkinLocation'
import type {
  LlmChatResult,
  PageGuideCardPayload,
  ToolExecutionCallbacks,
} from '@/types'

export { shouldRunCheckinWorkflow }

const CHECKIN_PAGE_PATH = '/checkin'

export async function runCheckinWorkflow(
  _message: string,
  callbacks?: ToolExecutionCallbacks,
): Promise<LlmChatResult> {
  callbacks?.onToolStart?.('getScenicActivities', '查询打卡点位')
  try {
    const { data: res } = await fetchCheckinSpots()
    callbacks?.onToolDone?.('getScenicActivities', res.code === 200)
    if (res.code !== 200) {
      return {
        content: '暂时无法查询打卡点，请稍后再试。',
        skillId: 'checkin_service',
        toolCallsUsed: ['getScenicActivities'],
      }
    }

    const { inPark, currentLocation, spots, checkedCountToday } = res.data
    if (!inPark) {
      return {
        content: '您当前不在园区内，入园后即可到打卡点签到领积分与小券。',
        skillId: 'checkin_service',
        toolCallsUsed: ['getScenicActivities'],
      }
    }

    const remainSpots = spots.filter((s) => !s.checkedInToday)
    const remain = remainSpots.length
    const nearby = remainSpots.find((s) =>
      isNearCheckinSpot(currentLocation, s.location),
    )

    if (remain === 0) {
      return {
        content: '',
        skillId: 'checkin_service',
        toolCallsUsed: ['getScenicActivities'],
        cards: [
          {
            type: 'page_guide',
            role: 'assistant',
            content: `今日 ${spots.length} 个打卡点均已签到，明天再来打卡吧～`,
            payload: {
              title: '',
              path: CHECKIN_PAGE_PATH,
              buttonLabel: '查看打卡点',
            },
          },
        ],
      }
    }

    // 识别到附近点位：对话内一键打卡
    if (nearby) {
      const caption =
        `园区共有 ${spots.length} 个打卡点，今日已打 ${checkedCountToday} 个，还可打卡 ${remain} 个。\n` +
        `识别到您在「${nearby.name}」项目附近，要立刻打卡吗？`

      const payload: PageGuideCardPayload = {
        title: '',
        path: CHECKIN_PAGE_PATH,
        buttonLabel: '立刻打卡',
        inlineAction: 'checkin',
        spotId: nearby.spotId,
        spotName: nearby.name,
      }

      return {
        content: '',
        skillId: 'checkin_service',
        toolCallsUsed: ['getScenicActivities'],
        cards: [
          {
            type: 'page_guide',
            role: 'assistant',
            content: caption,
            payload,
          },
        ],
      }
    }

    // 在园但未匹配到附近点：引导去列表页
    const caption =
      `园区共有 ${spots.length} 个打卡点，今日已打 ${checkedCountToday} 个，还可打卡 ${remain} 个。` +
      `当前未识别到您在某个打卡点附近（位置：${currentLocation || '未知'}），可前往打卡页查看全部点位。`

    return {
      content: '',
      skillId: 'checkin_service',
      toolCallsUsed: ['getScenicActivities'],
      cards: [
        {
          type: 'page_guide',
          role: 'assistant',
          content: caption,
          payload: {
            title: '',
            path: CHECKIN_PAGE_PATH,
            buttonLabel: '查看打卡点',
          },
        },
      ],
    }
  } catch {
    callbacks?.onToolDone?.('getScenicActivities', false)
    return {
      content: '暂时无法查询打卡点，请稍后再试。',
      skillId: 'checkin_service',
      toolCallsUsed: ['getScenicActivities'],
    }
  }
}
