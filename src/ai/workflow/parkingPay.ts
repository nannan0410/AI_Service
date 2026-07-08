import { fetchPlate } from '@/api/business'
import type { LlmChatResult, PageGuideCardPayload, ToolExecutionCallbacks } from '@/types'
import { shouldRunParkingPayWorkflow } from '@/utils/parkingPayIntent'

export { shouldRunParkingPayWorkflow }

const PARKING_PAGE_PATH = '/parking'

export async function runParkingPayWorkflow(
  _message: string,
  callbacks?: ToolExecutionCallbacks,
): Promise<LlmChatResult> {
  callbacks?.onToolStart?.('getMemberInfo', '查询绑定车牌')
  let plateNo: string | null = null
  try {
    const { data: res } = await fetchPlate()
    callbacks?.onToolDone?.('getMemberInfo', res.code === 200)
    if (res.code === 200) {
      plateNo = res.data.plateNo
    }
  } catch {
    callbacks?.onToolDone?.('getMemberInfo', false)
  }

  const payload: PageGuideCardPayload = plateNo
    ? {
        title: '停车缴费',
        plateNo,
        path: `${PARKING_PAGE_PATH}?mode=pay`,
        buttonLabel: '前往停车缴费',
        tag: '游后服务',
      }
    : {
        title: '停车缴费',
        description: '演示版车牌仅可绑定一次，绑定后可查询时长与应付金额',
        path: `${PARKING_PAGE_PATH}?mode=bind`,
        buttonLabel: '前往绑定车牌并缴费',
        tag: '游后服务',
      }

  const caption = plateNo
    ? '您已绑定车牌，可在停车缴费页查询当前费用并完成支付；如有停车券可在页面内使用。'
    : '您尚未绑定车牌，请先绑定后再查询停车费用并完成支付。'

  return {
    content: '',
    skillId: 'parking_pay',
    toolCallsUsed: ['getMemberInfo'],
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
